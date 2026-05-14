import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createOrder as createEsimOrder, createTopUp } from "@/lib/esim-access";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
// Helper function to get session from cookies
async function getSessionFromRequest(request: Request) {
  const cookie = request.headers.get("cookie");
  const token = cookie?.match(/auth-token=([^;]+)/)?.[1];
  
  if (token) {
    // For legacy auth (email/password), get user from token
    const userId = parseInt(token);
    if (!isNaN(userId)) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        return { user: { id: user.id, email: user.email, name: user.name, role: user.role } };
      }
    }
  }
  
  // For NextAuth (Google OAuth), try to get session from JWT
  // This is a simplified version - in production, you should verify the JWT properly
  const nextAuthSession = request.headers.get("cookie")?.match(/next-auth.session-token=([^;]+)/)?.[1];
  if (nextAuthSession) {
    // Decode JWT (simplified - in production, verify the signature)
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
    } catch (e) {
      console.error("Failed to decode JWT:", e);
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

// Process top-up after base eSIM is created
async function processTopUp(
  orderItemId: number,
  iccid: string,
  extraDays: number,
  topupPackageCode: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`[TopUp] Starting for orderItem=${orderItemId}, extraDays=${extraDays}, packageCode=${topupPackageCode}`);
    
    const topupResult = await createTopUp({
      packageCode: topupPackageCode,
      iccid: iccid,
      periodNum: String(extraDays),
    });

    console.log(`[TopUp] Success for orderItem=${orderItemId}:`, topupResult);

    // Update order item with top-up info
    await prisma.orderItem.update({
      where: { id: orderItemId },
      data: {
        extraDays: extraDays,
        topupPackageCode: topupPackageCode,
      },
    });

    return { success: true };
  } catch (error) {
    console.error(`[TopUp] Failed for orderItem=${orderItemId}:`, error);
    return { success: false, error: String(error) };
  }
}

// Shared: activate eSIM after payment (with optional top-up)
async function activateEsimAndEmail(
  orderId: number, 
  planId: string | null, 
  quantity: number,
  isTopupMode: boolean = false,
  extraDays: number = 0,
  topupPackageCode: string | null = null
) {
  // Lock: Only one process can activate this order
  const lockResult = await prisma.orderItem.updateMany({
    where: {
      orderId,
      esimIccid: null,
      smdpStatus: { not: "PROCESSING" },
    },
    data: { smdpStatus: "PROCESSING" },
  });

  if (lockResult.count === 0) {
    console.log(`[AUTO] Order ${orderId}: Already being processed by another request, skipping`);
    return;
  }

  // Idempotency: Check if already activated (double-check after acquiring lock)
  const existingOrderItem = await prisma.orderItem.findFirst({ where: { orderId } });
  if (existingOrderItem?.esimIccid) {
    console.log(`[AUTO] Order ${orderId}: Already activated (has ICCID ${existingOrderItem.esimIccid}), skipping`);
    return;
  }

  const plan = planId ? await prisma.plan.findUnique({ where: { id: planId } }) : null;
  const packageCode = plan?.packageCode;

  console.log(`[AUTO] Order ${orderId}: plan=${planId}, packageCode=${packageCode}, isTopupMode=${isTopupMode}, extraDays=${extraDays}`);

  if (!packageCode) {
    console.error(`[AUTO] Order ${orderId}: No packageCode found`);
    return;
  }

  try {
    // Step 1: Call eSIM Access - Create base order
    console.log(`[AUTO] Calling eSIM Access: ${packageCode}`);
    const esimOrder = await createEsimOrder({ packageCode, count: quantity, orderId: String(orderId) });
    console.log(`[AUTO] eSIM Response: iccid=${esimOrder.iccid}, orderNo=${esimOrder.orderNo}`);

    // Get order item to check for top-up data
    const orderItem = await prisma.orderItem.findFirst({ where: { orderId } });
    
    // Use orderItem data if provided, otherwise use parameters
    const itemExtraDays = orderItem?.extraDays || extraDays;
    const itemTopupPackageCode = orderItem?.topupPackageCode || topupPackageCode;

    // Update order item with eSIM data
    await prisma.orderItem.update({
      where: { id: orderItem?.id },
      data: {
        esimIccid: esimOrder.iccid || null,
        esimQrCode: esimOrder.qrCode || null,
        esimQrImage: esimOrder.qrCodeUrl || null,
        esimLpaString: esimOrder.ac || esimOrder.lpaString || null,
        activationCode: esimOrder.activationCode || null,
        esimStatus: esimOrder.esimStatus || "ACTIVATED",
        smdpStatus: "ENABLED",
        enabledAt: new Date(),
      },
    });

    // Step 2: Process top-up if needed (after getting ICCID)
    let topupStatus = "not_needed";
    if (itemExtraDays && itemExtraDays > 0 && itemTopupPackageCode && esimOrder.iccid) {
      topupStatus = "processing";
      const topupResult = await processTopUp(
        orderItem!.id,
        esimOrder.iccid,
        itemExtraDays,
        itemTopupPackageCode
      );
      
      if (topupResult.success) {
        topupStatus = "success";
        console.log(`[AUTO] Order ${orderId}: Top-up completed successfully`);
      } else {
        topupStatus = "failed";
        console.error(`[AUTO] Order ${orderId}: Top-up FAILED - ${topupResult.error}`);
        // Send alert to admin about failed top-up
        try {
          const adminEmail = process.env.ADMIN_EMAIL;
          if (adminEmail) {
            const { sendEmail } = await import("@/lib/email");
            await sendEmail({
              to: adminEmail,
              subject: `[URGENT] Top-up Failed - Order #${orderId}`,
              html: `
                <h2>Top-up Failed</h2>
                <p>Order ID: ${orderId}</p>
                <p>ICCID: ${esimOrder.iccid}</p>
                <p>Extra Days: ${itemExtraDays}</p>
                <p>Package Code: ${itemTopupPackageCode}</p>
                <p>Error: ${topupResult.error}</p>
                <p>Please process manually!</p>
              `,
            });
          }
        } catch (emailErr) {
          console.error(`[AUTO] Failed to send admin alert:`, emailErr);
        }
      }
    }

    // Update order status
    await prisma.order.update({
      where: { id: orderId },
      data: {
        esimaccessOrderStatus: topupStatus === "failed" ? "partial" : esimOrder.esimStatus || esimOrder.orderStatus || "ACTIVATED",
      },
    });

    console.log("[AUTO] Order " + orderId + ": eSIM activated successfully" + (topupStatus !== "not_needed" ? `, top-up: ${topupStatus}` : ""));

    // Send email
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { orderItems: true },
    });

    if (order?.customerEmail) {
      try {
        const { sendEmail, getOrderConfirmationHtml, getOrderConfirmationAdminHtml } = await import("@/lib/email");

        await sendEmail({
          to: order.customerEmail,
          subject: `OW SIM Order #${order.id} - Your eSIM is ready!`,
          html: getOrderConfirmationHtml({
            id: order.id,
            totalAmount: order.totalAmount,
            customerName: order.customerName,
            items: order.orderItems.map((item) => ({
              planName: item.planName,
              price: item.price,
              quantity: item.quantity,
              qrImage: item.esimQrImage,
              activationCode: item.activationCode,
              iccid: item.esimIccid,
            })),
          }),
        });
        console.log(`[AUTO] Order ${orderId}: Email sent to ${order.customerEmail}`);

        const adminEmail = process.env.ADMIN_EMAIL;
        if (adminEmail) {
          await sendEmail({
            to: adminEmail,
            subject: `New Order #${order.id} - ${order.totalAmount.toFixed(2)}`,
            html: getOrderConfirmationAdminHtml({
              id: order.id,
              totalAmount: order.totalAmount,
              customerName: order.customerName,
              customerEmail: order.customerEmail,
              items: order.orderItems.map((item) => ({ planName: item.planName, price: item.price })),
            }),
          });
        }
      } catch (emailErr) {
        console.error(`[AUTO] Order ${orderId}: Email failed:`, emailErr);
      }
    }
  } catch (esimErr) {
    console.error(`[AUTO] Order ${orderId}: eSIM activation FAILED:`, esimErr);
  }
}

// PayPal webhook (called by PayPal)
export async function POST(request: Request) {
  try {
    const body = await request.text();
    const event = JSON.parse(body);
    console.log("[PayPal Webhook]", event.event_type);

    if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
      const paypalOrderId = event.resource?.supplementary_data?.related_ids?.order_id;
if (paypalOrderId) {
         const token = await getAccessToken();
         const verifyRes = await fetch(`${PAYPAL_API}/v2/checkout/orders/${paypalOrderId}`, {
           headers: { "Authorization": `Bearer ${token}` },
         });
         const orderData = await verifyRes.json();

         if (orderData.status === "COMPLETED") {
            // Create order using upsert to prevent duplicates from concurrent webhook + frontend requests
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
           } catch {}

           // Get top-up metadata if in top-up mode
           let extraDays = 0;
           let topupPkgCode: string | null = topupPackageCode || null;
           let basePlanDays: number | null = null;

           if (isTopupMode && planId) {
             const plan = await prisma.plan.findUnique({ where: { id: planId } });
             if (plan && selectedDuration) {
               extraDays = selectedDuration - plan.durationDays;
               basePlanDays = plan.durationDays;
               if (extraDays > 0) {
                 // Use passed topupPackageCode, or fetch from DB as fallback
                 if (!topupPkgCode) {
                   const topupPkg = await prisma.topupPackage.findFirst({
                     where: { planId: plan.id, isActive: true, isFlexible: true },
                   });
                   topupPkgCode = topupPkg?.packageCode || null;
                 }
               }
             }
           }

           const amount = parseFloat(orderData.purchase_units?.[0]?.amount?.value || "0");

           try {
             const order = await prisma.order.upsert({
               where: { esimaccessOrderId: paypalOrderId },
               update: {}, // Already exists, do nothing
               create: {
                 totalAmount: amount,
                 status: "completed",
                 customerEmail: orderData.payer?.email_address || "",
                 customerName: `${orderData.payer?.name?.given_name || ""} ${orderData.payer?.name?.surname || ""}`.trim(),
                 esimaccessOrderId: paypalOrderId,
                 esimaccessOrderStatus: "paid",
                 // Top-up metadata
                 isTopupMode,
                 selectedDuration: selectedDuration || null,
                 basePlanDays,
                 extraDays: extraDays > 0 ? extraDays : null,
                 topupPackageCode,
                 orderItems: {
                   create: [{
                     planId,
                     planName: orderData.purchase_units?.[0]?.description || "eSIM",
                     packageCode: planId ? (await prisma.plan.findUnique({ where: { id: planId } }))?.packageCode || null : null,
                     price: amount,
                     quantity: 1,
                     extraDays: extraDays > 0 ? extraDays : null,
                     basePlanDays,
                     topupPackageCode,
                   }],
                 },
               },
             });

             // Auto-activate eSIM (idempotent - skips if already activated)
             await activateEsimAndEmail(order.id, planId, 1, isTopupMode, extraDays, topupPkgCode);
           } catch (dbErr: any) {
             // Handle race condition: unique constraint already satisfied by concurrent request
             if (dbErr.code === 'P2002') {
               console.log("[PayPal Webhook] Order already created by concurrent request for PayPal order", paypalOrderId);
               return NextResponse.json({ received: true, alreadyProcessed: true });
             }
             throw dbErr;
           }
}
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[PayPal Webhook] Error:", error);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}

// Frontend confirmation (after PayPal redirect)
export async function PUT(request: Request) {
  try {
    const { orderId, planId, quantity = 1, isTopupMode = false, selectedDuration, topupPackageCode, pendingOrderId } = await request.json();
    if (!orderId) return NextResponse.json({ error: "Order ID required" }, { status: 400 });

    // Get userId from NextAuth session (Google OAuth) or legacy token
    const session = await getSessionFromRequest(request);
    let userId: number | null = null;

    if (session?.user) {
      // Try to get id directly from session
      if (session.user.id !== null && session.user.id !== undefined) {
        userId = Number(session.user.id);
      }
      // Fallback: query by email
      if (!userId && session.user.email) {
        const dbUser = await prisma.user.findUnique({ where: { email: session.user.email } });
        if (dbUser) userId = dbUser.id;
      }
    }



    // Idempotency: Check if order already exists by PayPal order ID
    const existingOrder = await prisma.order.findFirst({
      where: { esimaccessOrderId: orderId },
      include: { orderItems: true },
    });

    if (existingOrder) {
      console.log("[PayPal Confirm] Order already exists: " + existingOrder.id);
      return NextResponse.json({
        success: true,
        order: existingOrder,
        alreadyProcessed: true
      });
    }

     // Verify with PayPal (check order status)
     const accessToken = await getAccessToken();
     const verifyRes = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderId}`, {
       headers: { "Authorization": `Bearer ${accessToken}` },
     });
     const verifyData = await verifyRes.json();

     if (!verifyRes.ok) {
       return NextResponse.json({ error: "Failed to verify PayPal order" }, { status: 500 });
     }

     // Determine amount from order data
     const amount = parseFloat(verifyData.purchase_units?.[0]?.amount?.value || "0");

// Idempotency key for capture - prevents duplicate captures if request is retried
      const captureIdempotencyKey = `capture-${orderId}-${Date.now()}`;

      // Handle capture idempotently
      let captureStatus = verifyData.status; // "COMPLETED" or "APPROVED"

      if (verifyData.status === "APPROVED") {
        // Need to capture payment
        const captureRes = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderId}/capture`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "PayPal-Request-Id": captureIdempotencyKey,
          },
        });

        const captureData = await captureRes.json();

        if (!captureRes.ok) {
          // If already captured (422 error), treat as success
          if (captureRes.status === 422) {
            console.log("[PayPal Confirm] Duplicate capture (422), order likely already captured");
            captureStatus = "COMPLETED";
          } else {
            return NextResponse.json({ error: captureData.message || "Capture failed" }, { status: 500 });
          }
        } else {
          captureStatus = captureData.status;
          // Use captured amount if available
          const capturedAmount = parseFloat(captureData.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value || "0");
          if (capturedAmount > 0) {
            // amount remains from verify (should be same)
          }
        }
      }

      // Only proceed if payment is completed
      if (captureStatus !== "COMPLETED") {
        return NextResponse.json({ error: "Payment not completed", status: captureStatus }, { status: 400 });
      }

      // Use verifyData for payer info
      const plan = await prisma.plan.findUnique({ where: { id: planId || "" } });

     // Get top-up metadata if in top-up mode
     let extraDays = 0;
     let topupPkgCode: string | null = topupPackageCode || null;
     let basePlanDays: number | null = null;
     let itemPrice = amount;

     if (isTopupMode && plan && selectedDuration) {
       extraDays = selectedDuration - plan.durationDays;
       basePlanDays = plan.durationDays;

       if (extraDays > 0) {
         // Use passed topupPackageCode, or fetch from DB as fallback
         if (!topupPkgCode) {
           const topupPkg = await prisma.topupPackage.findFirst({
             where: { planId: plan.id, isActive: true, isFlexible: true },
           });
           topupPkgCode = topupPkg?.packageCode || null;
         }

         if (topupPkgCode) {
           // Get package for price calculation - must handle null case
           const topupPkgInfo = await prisma.topupPackage.findUnique({
             where: { packageCode: topupPkgCode },
           });
           // Recalculate price to match backend calculation
           const basePrice = plan.retailPriceUsd > 0 ? plan.retailPriceUsd : plan.priceUsd;
           const topupCost = topupPkgInfo ? (topupPkgInfo.retailPriceUsd > 0 ? topupPkgInfo.retailPriceUsd : topupPkgInfo.priceUsd) : 0;
           itemPrice = basePrice + (extraDays * topupCost);
         }
       }
     }

     let order: { id: number; orderItems: { id: number }[] };

     // If pendingOrderId is provided, update the existing pending order instead of creating new
     if (pendingOrderId) {
       console.log(`[PayPal Confirm] Updating pending order ${pendingOrderId}`);
       const pendingOrder = await prisma.order.findUnique({
         where: { id: Number(pendingOrderId) },
         include: { orderItems: true },
       });

       if (pendingOrder && pendingOrder.status === "pending") {
         // Update the pending order to completed with payment info
         const updatedOrder = await prisma.order.update({
           where: { id: Number(pendingOrderId) },
           data: {
             status: "completed",
             totalAmount: amount,
              customerEmail: verifyData.payer?.email_address || pendingOrder.customerEmail,
              customerName: `${verifyData.payer?.name?.given_name || ""} ${verifyData.payer?.name?.surname || ""}`.trim() || pendingOrder.customerName,
             esimaccessOrderId: orderId,
             esimaccessOrderStatus: "paid",
             // Top-up metadata
             isTopupMode,
             selectedDuration: selectedDuration || null,
             basePlanDays,
             extraDays: extraDays > 0 ? extraDays : null,
             topupPackageCode,
             // Update order items if needed (for top-up price recalculation)
             orderItems: {
               update: pendingOrder.orderItems.map(item => ({
                 where: { id: item.id },
                 data: {
                   price: itemPrice,
                   extraDays: extraDays > 0 ? extraDays : null,
                   basePlanDays,
                   topupPackageCode,
                 },
               })),
             },
           },
           include: { orderItems: true }, // Include orderItems in response
         });
         order = updatedOrder;
       } else {
         // Pending order not found or already processed, use upsert to avoid duplicates
         console.log(`[PayPal Confirm] Pending order ${pendingOrderId} not found or not pending, upserting order`);
         const upsertedOrder = await prisma.order.upsert({
           where: { esimaccessOrderId: orderId },
           update: {}, // Already exists, do nothing
           create: {
             userId,
             totalAmount: amount,
             status: "completed",
              customerEmail: verifyData.payer?.email_address || "",
              customerName: `${verifyData.payer?.name?.given_name || ""} ${verifyData.payer?.name?.surname || ""}`.trim(),
             esimaccessOrderId: orderId,
             esimaccessOrderStatus: "paid",
             // Top-up metadata
             isTopupMode,
             selectedDuration: selectedDuration || null,
             basePlanDays,
             extraDays: extraDays > 0 ? extraDays : null,
             topupPackageCode,
             orderItems: {
               create: [{
                 planId: planId || null,
                 planName: plan?.name || "eSIM Plan",
                 packageCode: plan?.packageCode || null,
                 price: itemPrice,
                 quantity,
                 extraDays: extraDays > 0 ? extraDays : null,
                 basePlanDays,
                 topupPackageCode,
               }],
             },
           },
           include: { orderItems: true },
         });
         order = upsertedOrder;
       }
     } else {
       // No pendingOrderId: use upsert to prevent duplicates (direct checkout or fallback)
       console.log("[PayPal Confirm] No pending order ID, upserting order");
       const upsertedOrder = await prisma.order.upsert({
         where: { esimaccessOrderId: orderId },
         update: {}, // Already exists, do nothing
         create: {
           userId,
           totalAmount: amount,
           status: "completed",
            customerEmail: verifyData.payer?.email_address || "",
            customerName: `${verifyData.payer?.name?.given_name || ""} ${verifyData.payer?.name?.surname || ""}`.trim(),
           esimaccessOrderId: orderId,
           esimaccessOrderStatus: "paid",
           // Top-up metadata
           isTopupMode,
           selectedDuration: selectedDuration || null,
           basePlanDays,
           extraDays: extraDays > 0 ? extraDays : null,
           topupPackageCode,
           orderItems: {
             create: [{
               planId: planId || null,
               planName: plan?.name || "eSIM Plan",
               packageCode: plan?.packageCode || null,
               price: itemPrice,
               quantity,
               extraDays: extraDays > 0 ? extraDays : null,
               basePlanDays,
               topupPackageCode,
             }],
           },
         },
         include: { orderItems: true },
       });
       order = upsertedOrder;
     }

     // Auto-activate eSIM + send email (with top-up processing)
     await activateEsimAndEmail(order.id, planId, quantity, isTopupMode, extraDays, topupPkgCode);

    const updatedOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: { orderItems: true },
    });

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error("[PayPal Confirm] Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}