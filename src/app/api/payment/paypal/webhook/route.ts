import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { activateEsimAndEmailCentralized, _alertAdminFailed } from "@/lib/esim-activation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { sendEmail, getOrderConfirmationHtml, getOrderConfirmationAdminHtml } from "@/lib/email";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getSessionFromRequest(request: Request) {
  const cookie = request.headers.get("cookie");
  const token = cookie?.match(/auth-token=([^;]+)/)?.[1];

  if (token) {
    const userId = parseInt(token);
    if (!isNaN(userId)) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        return { user: { id: user.id, email: user.email, name: user.name, role: user.role } };
      }
    }
  }

  const nextAuthSession = cookie?.match(/next-auth.session-token=([^;]+)/)?.[1];
  if (nextAuthSession) {
    try {
      const parts = nextAuthSession.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());
        if (payload.email) {
          const user = await prisma.user.findUnique({ where: { email: payload.email } });
          if (user) {
            return { user: { id: user.id, email: user.email, name: user.name, role: user.role } };
          }
        }
      }
    } catch {
      /* best-effort */
    }
  }

  return null;
}

const PAYPAL_API = process.env.PAYPAL_SANDBOX === "true"
  ? "https://api-m.sandbox.paypal.com"
  : "https://api-m.paypal.com";

async function getAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("PayPal not configured");

  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await res.json();
  return data.access_token;
}

// ---------------------------------------------------------------------------
// PayPal Webhook  (POST — called by PayPal)
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const event = JSON.parse(body);
    console.log("[PayPal Webhook] event_type:", event.event_type);

    if (
      event.event_type !== "PAYMENT.CAPTURE.COMPLETED" &&
      event.event_type !== "CHECKOUT.ORDER.APPROVED"
    ) {
      console.log("[PayPal Webhook] SKIP: unsupported event_type, returning 200");
      return NextResponse.json({ received: true });
    }

    const paypalOrderId =
      event.resource?.supplementary_data?.related_ids?.order_id;
    if (!paypalOrderId) {
      console.warn("[PayPal Webhook] SKIP: missing paypalOrderId from event");
      return NextResponse.json({ received: true });
    }

    // --- Verify with PayPal ---
    const token = await getAccessToken();
    console.log("[PayPal Webhook] verify GET /v2/checkout/orders/" + paypalOrderId);
    const verifyRes = await fetch(
      `${PAYPAL_API}/v2/checkout/orders/${paypalOrderId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const orderData = await verifyRes.json();
    console.log("[PayPal Webhook] verify http=" + verifyRes.status, "orderData.status=" + orderData.status);

    if (!verifyRes.ok || (orderData.status !== "COMPLETED" && orderData.status !== "APPROVED")) {
      console.warn("[PayPal Webhook] SKIP: verify not ok or status invalid:", {
        ok: verifyRes.ok,
        status: orderData.status,
      });
      return NextResponse.json({ received: true });
    }

    // --- Auto-capture nếu event là APPROVED ---
    if (orderData.status === "APPROVED") {
      console.log("[PayPal Webhook] >>> Auto-capturing APPROVED order", paypalOrderId);
      const captureRes = await fetch(
        `${PAYPAL_API}/v2/checkout/orders/${paypalOrderId}/capture`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );
      if (!captureRes.ok) {
        const capErr = await captureRes.text();
        console.error("[PayPal Webhook] <<< Auto-capture HTTP error:", captureRes.status, capErr);
        return NextResponse.json(
          { error: "Capture failed (http " + captureRes.status + "): " + capErr },
          { status: 500 },
        );
      }
      const captureData = await captureRes.json();
      console.log("[PayPal Webhook] <<< Auto-capture RESPONSE:", JSON.stringify(captureData).substring(0, 500));
      if (captureData.status !== "COMPLETED") {
        console.error("[PayPal Webhook] <<< Auto-capture not COMPLETED, status:", captureData.status);
        return NextResponse.json(
          { error: "Capture not completed: " + captureData.status },
          { status: 400 },
        );
      }
      console.log("[PayPal Webhook] >>> Auto-capture succeeded → merging captured payload");
      Object.assign(orderData, captureData);
    } else {
      console.log("[PayPal Webhook] orderData.status is COMPLETED, skip auto-capture");
    }

    // --- Parse custom_id (planId + email + topup metadata) ---
    const customId = orderData.purchase_units?.[0]?.custom_id;
    let planId = "";
    let isTopupMode = false;
    let selectedDuration: number | undefined;
    let topupPackageCode: string | undefined;
    let customerEmailFromFxPA = orderData.payer?.email_address || "";

    try {
      const parsed = JSON.parse(customId || "{}");
      planId = parsed.planId || "";
      isTopupMode = parsed.isTopupMode || false;
      selectedDuration = parsed.selectedDuration;
      topupPackageCode = parsed.topupPackageCode;
      if (typeof parsed.email === "string" && parsed.email) {
        customerEmailFromFxPA = parsed.email;
      }
    } catch (e) {
      console.warn("[PayPal Webhook] custom_id parse failed:", e);
    }

    // --- Top-up metadata ---
    let extraDays = 0;
    let topupPkgCode: string | null = topupPackageCode || null;
    let basePlanDays: number | null = null;

    if (isTopupMode && planId) {
      const plan = await prisma.plan.findUnique({ where: { id: planId } });
      if (plan && selectedDuration) {
        extraDays = selectedDuration - plan.durationDays;
        basePlanDays = plan.durationDays;
        if (extraDays > 0 && !topupPkgCode) {
          const topupPkg = await prisma.topupPackage.findFirst({
            where: { planId: plan.id, isActive: true, isFlexible: true },
          });
          topupPkgCode = topupPkg?.packageCode || null;
        }
      }
    }

    const amount = parseFloat(
      orderData.purchase_units?.[0]?.amount?.value || "0",
    );

    // --- Upsert order record (ASYNC PATH — trả về 200 ngay sau upsert) ---
    const orderRow = await prisma.order.upsert({
      where: { esimaccessOrderId: paypalOrderId },
      update: {},
      create: {
        totalAmount: amount,
        status: "completed",
        customerEmail: customerEmailFromFxPA,
        customerName:
          `${orderData.payer?.name?.given_name || ""} ${
            orderData.payer?.name?.surname || ""
          }`.trim(),
        esimaccessOrderId: paypalOrderId,
        esimaccessOrderStatus: "paid",
        isTopupMode,
        selectedDuration: selectedDuration || null,
        basePlanDays,
        extraDays: extraDays > 0 ? extraDays : null,
        topupPackageCode,
        orderItems: {
          create: [
            {
              planId,
              planName: orderData.purchase_units?.[0]?.description || "eSIM",
              packageCode: planId
                ? (await prisma.plan.findUnique({ where: { id: planId } }))?.packageCode || null
                : null,
              price: amount,
              quantity: 1,
              extraDays: extraDays > 0 ? extraDays : null,
              basePlanDays,
              topupPackageCode,
            },
          ],
        },
      },
    });

    // ── Race-condition guard: concurrent caller might have upserted between our parse and db upsert,
    //    or the PUT handler might be running right now and hit P2002 instead of the early-exit check.
    //    Either way we have a valid orderRow now — return fast regardless.
    if (!orderRow) {
      console.error("[PayPal Webhook] CRITICAL: upsert returned null — returning 200, activation will be handled by next retry");
      return NextResponse.json({ received: true });
    }

    console.log("[PayPal Webhook] <<< upsert OK orderId=" + orderRow.id, "esimaccessOrderId=" + paypalOrderId, "amount=" + amount);

    // ── TRẢ VỀ 200 NGAY — không await activate eSIM ──────────────────────────
    // Kick off activation in the background; client / PayPal get 200 immediately.
    // The activation is fully idempotent (lock + esimIccid guard) so it's safe to run
    // concurrently with the response being sent.
    (async () => {
      try {
        await activateEsimAndEmailCentralized({
          orderId: orderRow.id,
          planId,
          quantity: 1,
          isTopupMode,
          extraDays,
          topupPackageCode: topupPkgCode,
        });
        console.log("[BG] activateEsimAndEmailCentralized OK orderId=" + orderRow.id);
      } catch (bgErr) {
        console.error("[BG] activateEsimAndEmailCentralized FAILED orderId=" + orderRow.id + ":", bgErr);
        _alertAdminFailed(orderRow.id, bgErr);
      }
    })();

    // Order đã "completed" → frontend poll thấy status sẽ hiển thị QR
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[PayPal Webhook] FATAL:", error);
    return NextResponse.json(
      { error: "Webhook failed: " + String(error) },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Order Confirmation  (PUT — frontend polls this after PayPal redirect)
// ---------------------------------------------------------------------------

export async function PUT(request: Request) {
  try {
    const {
      orderId,
      planId,
      quantity = 1,
      isTopupMode = false,
      selectedDuration,
      topupPackageCode,
      pendingOrderId,
    } = await request.json();

    if (!orderId) {
      return NextResponse.json(
        { error: "Order ID required" },
        { status: 400 },
      );
    }

    // --- Auth ---
    const session = await getSessionFromRequest(request);
    let userId: number | null = null;

    if (session?.user) {
      if (session.user.id !== null && session.user.id !== undefined) {
        userId = Number(session.user.id);
      }
      if (!userId && session.user.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: session.user.email },
        });
        if (dbUser) userId = dbUser.id;
      }
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // --- Idempotency: already processed by this PayPal order? ---
    const existingOrder = await prisma.order.findFirst({
      where: { esimaccessOrderId: orderId },
      include: { orderItems: true },
    });

    // Best-effort email recovery: extract from URL params if the current query used a guest email param
    // (avoids a silent mismatch when 'customerEmail' is empty on the order record)
    const queryCustomerEmail = new URL(request.url).searchParams.get("email") || "";
    const effectiveEmail = existingOrder?.customerEmail || queryCustomerEmail || "";

    if (existingOrder) {
      console.log("[PayPal Confirm] Order already exists: " + existingOrder.id);
      return NextResponse.json({
        success: true,
        order: existingOrder,
        alreadyProcessed: true,
      });
    }

    // --- Verify with PayPal ---
    const accessToken = await getAccessToken();
    const verifyRes = await fetch(
      `${PAYPAL_API}/v2/checkout/orders/${orderId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    const verifyData = await verifyRes.json();

    if (!verifyRes.ok) {
      return NextResponse.json(
        { error: "Failed to verify PayPal order" },
        { status: 500 },
      );
    }

    // Best-effort email recovery: parse customerEmail from custom_id (stored by POST /api/payment/paypal)
    // when PayPal does not return payer.email_address (sandbox / guest checkout)
    let customerEmailFromCustomId: string | null = null;
    try {
      const idCustomId = verifyData.purchase_units?.[0]?.custom_id;
      if (typeof idCustomId === "string") {
        const idParsed = JSON.parse(idCustomId);
        if (typeof idParsed.email === "string" && idParsed.email) {
          customerEmailFromCustomId = idParsed.email;
        }
      }
    } catch {
      /* best-effort */
    }

    // --- Idempotency key for capture ---
    const captureIdempotencyKey = `capture-${orderId}-${Date.now()}`;

    // --- Amount from PayPal response ---
    const amount = parseFloat(
      verifyData.purchase_units?.[0]?.amount?.value || "0",
    );

    // --- Capture payment ---
    let captureStatus = verifyData.status;

    if (verifyData.status === "APPROVED") {
      const captureRes = await fetch(
        `${PAYPAL_API}/v2/checkout/orders/${orderId}/capture`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "PayPal-Request-Id": captureIdempotencyKey,
          },
        },
      );

      if (!captureRes.ok) {
        if (captureRes.status === 422) {
          captureStatus = "COMPLETED";
        } else {
          const captureData = await captureRes.json();
          return NextResponse.json(
            { error: captureData.message || "Capture failed" },
            { status: 500 },
          );
        }
      } else {
        const captureData = await captureRes.json();
        captureStatus = captureData.status;
      }
    }

    // --- Payment must be completed ---
    if (captureStatus !== "COMPLETED") {
      return NextResponse.json(
        { error: "Payment not completed", status: captureStatus },
        { status: 400 },
      );
    }

    // --- Look up plan ---
    const plan = await prisma.plan.findUnique({
      where: { id: planId || "" },
    });

    // --- Top-up metadata ---
    let extraDays = 0;
    let topupPkgCode: string | null = topupPackageCode || null;
    let basePlanDays: number | null = null;

    if (isTopupMode && plan && selectedDuration) {
      extraDays = selectedDuration - plan.durationDays;
      basePlanDays = plan.durationDays;

      if (extraDays > 0) {
        if (!topupPkgCode) {
          const topupPkg = await prisma.topupPackage.findFirst({
            where: { planId: plan.id, isActive: true, isFlexible: true },
          });
          topupPkgCode = topupPkg?.packageCode || null;
        }
      }

      if (topupPkgCode) {
        const topupPkgInfo = await prisma.topupPackage.findUnique({
          where: { packageCode: topupPkgCode },
        });
        console.log("[PayPal Confirm] Fetched topupPackage:", topupPkgInfo);
      }
    }

    // --- Pending-order merge path ---
    let order: {
      id: number;
      orderItems: { id: number }[];
    };

    if (pendingOrderId) {
      console.log("[PayPal Confirm] Updating pending order " + pendingOrderId);
      const pendingOrder = await prisma.order.findUnique({
        where: { id: Number(pendingOrderId) },
        include: { orderItems: true },
      });

      if (pendingOrder && pendingOrder.status === "pending") {
        const updatedOrder = await prisma.order.update({
          where: { id: Number(pendingOrderId) },
          data: {
            totalAmount: amount,
            status: "completed",
              customerEmail:
                verifyData.payer?.email_address ||
                pendingOrder.customerEmail ||
                "",
            customerName:
              `${verifyData.payer?.name?.given_name || ""} ${
                verifyData.payer?.name?.surname || ""
              }`.trim() || pendingOrder.customerName,
            esimaccessOrderId: orderId,
            esimaccessOrderStatus: "paid",
            isTopupMode,
            selectedDuration: selectedDuration || null,
            basePlanDays,
            extraDays: extraDays > 0 ? extraDays : null,
            topupPackageCode,
            orderItems: {
              update: pendingOrder.orderItems.map((item) => ({
                where: { id: item.id },
                data: {
                  planId,
                  planName:
                    verifyData.purchase_units?.[0]?.description || item.planName,
                  packageCode: plan?.packageCode || item.packageCode,
                  price: amount,
                  quantity: 1,
                  extraDays: extraDays > 0 ? extraDays : null,
                  basePlanDays,
                  topupPackageCode,
                },
              })),
            },
          },
          include: { orderItems: true },
        });
        order = updatedOrder;
      } else {
        console.log(
          "[PayPal Confirm] Pending order " +
            pendingOrderId +
            " not found or not pending, upserting",
        );
        // Concurrent POST webhook may have already created the order for this
        // esimaccessOrderId; catch P2002 and fall back to a read.
        try {
          const upsertedOrder = await prisma.order.upsert({
            where: { esimaccessOrderId: orderId },
            update: {},
            create: {
              totalAmount: amount,
              status: "completed",
              customerEmail: verifyData.payer?.email_address || customerEmailFromCustomId || "",
              customerName:
                `${verifyData.payer?.name?.given_name || ""} ${
                  verifyData.payer?.name?.surname || ""
                }`.trim(),
              esimaccessOrderId: orderId,
              esimaccessOrderStatus: "paid",
              isTopupMode,
              selectedDuration: selectedDuration || null,
              basePlanDays,
              extraDays: extraDays > 0 ? extraDays : null,
              topupPackageCode,
              orderItems: {
                create: [
                  {
                    planId,
                    planName: verifyData.purchase_units?.[0]?.description || "eSIM",
                    packageCode: plan?.packageCode || null,
                    price: amount,
                    quantity: 1,
                    extraDays: extraDays > 0 ? extraDays : null,
                    basePlanDays,
                    topupPackageCode,
                  },
                ],
              },
            },
            include: { orderItems: true },
          });
          order = upsertedOrder;
        } catch (e: any) {
          if (e.code === "P2002") {
            const existing = await prisma.order.findFirst({
              where: { esimaccessOrderId: orderId },
              include: { orderItems: true },
            });
            if (existing) {
              console.log("[PayPal Confirm] P2002 recovery: order already existed, returning " + existing.id);
              order = existing;
            } else {
              throw e;
            }
          } else {
            throw e;
          }
        }
      }
    } else {
      try {
        const upsertedOrder = await prisma.order.upsert({
          where: { esimaccessOrderId: orderId },
          update: {},
          create: {
            totalAmount: amount,
            status: "completed",
            customerEmail: verifyData.payer?.email_address || customerEmailFromCustomId || "",
            customerName:
              `${verifyData.payer?.name?.given_name || ""} ${
                verifyData.payer?.name?.surname || ""
              }`.trim(),
            esimaccessOrderId: orderId,
            esimaccessOrderStatus: "paid",
            isTopupMode,
            selectedDuration: selectedDuration || null,
            basePlanDays,
            extraDays: extraDays > 0 ? extraDays : null,
            topupPackageCode,
            orderItems: {
              create: [
                {
                  planId,
                  planName: verifyData.purchase_units?.[0]?.description || "eSIM",
                  packageCode: plan?.packageCode || null,
                  price: amount,
                  quantity: 1,
                  extraDays: extraDays > 0 ? extraDays : null,
                  basePlanDays,
                  topupPackageCode,
                },
              ],
            },
          },
          include: { orderItems: true },
        });
        order = upsertedOrder;
      } catch (e: any) {
        // POST webhook may have already created the order for this esimaccessOrderId
        if (e?.code === "P2002") {
          const existing = await prisma.order.findFirst({
            where: { esimaccessOrderId: orderId },
            include: { orderItems: true },
          });
          if (existing) {
            console.log("[PayPal Confirm] P2002 recovery: order already existed, returning " + existing.id);
            order = existing;
          } else {
            throw e;
          }
        } else {
          throw e;
        }
      }
    }

    const updatedOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: { orderItems: true },
    });

    if (!updatedOrder) {
      return NextResponse.json(
        { error: "Order not found after save" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error("[PayPal Confirm] Error:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 },
    );
  }
}
