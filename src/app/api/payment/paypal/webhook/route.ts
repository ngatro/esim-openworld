import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { activateEsimAndEmailCentralized } from "@/lib/esim-activation";
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
    console.log("[PayPal Webhook]", event.event_type);

    if (event.event_type !== "PAYMENT.CAPTURE.COMPLETED") {
      return NextResponse.json({ received: true });
    }

    const paypalOrderId =
      event.resource?.supplementary_data?.related_ids?.order_id;
    if (!paypalOrderId) {
      return NextResponse.json({ received: true });
    }

    // --- Verify with PayPal ---
    const token = await getAccessToken();
    const verifyRes = await fetch(
      `${PAYPAL_API}/v2/checkout/orders/${paypalOrderId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const orderData = await verifyRes.json();

    if (!verifyRes.ok || orderData.status !== "COMPLETED") {
      return NextResponse.json({ received: true });
    }

    // --- Parse custom_id (planId encoded as JSON) ---
    const customId = orderData.purchase_units?.[0]?.custom_id;
    let planId = "";
    let isTopupMode = false;
    let selectedDuration: number | undefined;
    let topupPackageCode: string | undefined;

    try {
      const parsed = JSON.parse(customId || "{}");
      planId = parsed.planId || "";
      isTopupMode = parsed.isTopupMode || false;
      selectedDuration = parsed.selectedDuration;
      topupPackageCode = parsed.topupPackageCode;
    } catch {
      /* best-effort */
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

    // --- Upsert order record ---
    try {
      await prisma.order.upsert({
        where: { esimaccessOrderId: paypalOrderId },
        update: {},
        create: {
          totalAmount: amount,
          status: "completed",
          customerEmail: orderData.payer?.email_address || "",
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
                  ? (await prisma.plan.findUnique({
                      where: { id: planId },
                    }))?.packageCode || null
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
    } catch (dbErr: any) {
      // Concurrent request already created this order → skip activation here
      if (dbErr.code === "P2002") {
        return NextResponse.json({ received: true, alreadyProcessed: true });
      }
      throw dbErr;
    }

    // --- Activate eSIM (centralised, idempotent, atomic lock) ---
    const order = await prisma.order.findFirst({
      where: { esimaccessOrderId: paypalOrderId },
    });
    if (order) {
      try {
        await activateEsimAndEmailCentralized({
          orderId: order.id,
          planId,
          quantity: 1,
          isTopupMode,
          extraDays,
          topupPackageCode: topupPkgCode,
        });
      } catch (activationErr) {
        console.error(
          "[PayPal Webhook] Activation failed after order creation:",
          activationErr,
        );
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[PayPal Webhook] Error:", error);
    return NextResponse.json(
      { error: "Webhook failed" },
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

    // --- Idempotency key for capture ---
    const captureIdempotencyKey = `capture-${orderId}-${Date.now()}`;

    // Amount from PayPal response (always present — either direct or after capture)
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
              verifyData.payer?.email_address || pendingOrder.customerEmail || "",
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
        const upsertedOrder = await prisma.order.upsert({
          where: { esimaccessOrderId: orderId },
          update: {},
          create: {
            totalAmount: amount,
            status: "completed",
            customerEmail: verifyData.payer?.email_address || "",
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
      }
    } else {
      const upsertedOrder = await prisma.order.upsert({
        where: { esimaccessOrderId: orderId },
        update: {},
        create: {
          totalAmount: amount,
          status: "completed",
          customerEmail: verifyData.payer?.email_address || "",
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
