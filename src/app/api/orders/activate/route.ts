import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createOrder as createEsimOrder, createTopUp } from "@/lib/esim-access";

// Helper to get user from request (same as orders route)
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
  
  const nextAuthSession = request.headers.get("cookie")?.match(/next-auth.session-token=([^;]+)/)?.[1];
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
    } catch (e) {
      console.error("Failed to decode JWT:", e);
    }
  }
  
  return null;
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

// Activate eSIM for a completed order (called after payment confirmed or for free/gift orders)
export async function POST(
  request: Request,
  { params }: { params: Promise<{}> }
) {
  try {
    const body = await request.json().catch(() => ({}));
    const { orderId, force = false } = body;

    const orderIdNum = parseInt(orderId);
    if (isNaN(orderIdNum)) {
      return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
    }

// Get user from request - same as orders route
const session = await getSessionFromRequest(request);
let userId: number | null = null;

if (session?.user) {
  if (session.user.id !== null && session.user.id !== undefined) {
    userId = Number(session.user.id);
  }
  if (!userId && session.user.email) {
    const dbUser = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (dbUser) userId = dbUser.id;
  }
}

// For activation, user must be authenticated (order belongs to someone)
if (!userId) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

// Find the order (must belong to user unless admin)
const order = await prisma.order.findFirst({
  where: { 
    id: orderIdNum,
    // Allow if order belongs to user OR user is admin (checked later)
  },
  include: { orderItems: true, user: true },
});

if (!order) {
  return NextResponse.json({ error: "Order not found" }, { status: 404 });
}

    // Check ownership or admin role
    const isAdmin = session?.user?.role === "admin";
    const isOwner = order.userId === userId;

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Unauthorized - not your order" }, { status: 403 });
    }

    // If order is still pending, mark as completed/paid before activation
    if (order.status === "pending" || order.status === "awaiting_payment") {
      await prisma.order.update({
        where: { id: orderIdNum },
        data: { status: "completed" },
      });
    }

    // Check if order is already activated (has eSIM data)
    const hasEsimData = order.orderItems.some(item => item.esimIccid);
    if (hasEsimData && !force) {
      return NextResponse.json({ 
        success: true, 
        order, 
        message: "Order already activated" 
      });
    }

    // Only allow activation for completed or gift orders (or force override)
    const canActivate = order.status === "completed" || 
                       order.status === "paid" || 
                       order.esimaccessOrderStatus === "gift" ||
                       force;
    
    if (!canActivate && !force) {
      return NextResponse.json({ 
        error: `Cannot activate order with status: ${order.status}` 
      }, { status: 400 });
    }

    // Activate eSIM for each order item
    const esimResults: {
      orderItem: number;
      status: string;
      orderNo: string;
      topupStatus?: string;
      topupError?: string;
    }[] = [];

    for (const orderItem of order.orderItems) {
      const plan = await prisma.plan.findUnique({
        where: { id: orderItem.planId || "" },
      });

      if (plan?.packageCode) {
        try {
          // Step 1: Create base eSIM order
          console.log(`[Activate] Creating eSIM for orderItem ${orderItem.id}, packageCode=${plan.packageCode}`);
          const esimOrder = await createEsimOrder({
            packageCode: plan.packageCode,
            count: orderItem.quantity,
          });

          const qrCodeUrl = esimOrder.qrCodeUrl || esimOrder.qrCode || null;

          await prisma.orderItem.update({
            where: { id: orderItem.id },
            data: {
              esimIccid: esimOrder.iccid || null,
              esimEid: esimOrder.eid || null,
              esimTranNo: esimOrder.esimTranNo || null,
              esimQrCode: qrCodeUrl,
              esimQrImage: qrCodeUrl,
              esimLpaString: esimOrder.ac || esimOrder.lpaString || null,
              activationCode: esimOrder.activationCode || null,
              totalVolume: esimOrder.totalVolume || null,
              smdpStatus: "ENABLED",
              esimStatus: esimOrder.esimStatus || "ACTIVATED",
              enabledAt: new Date(),
            },
          });

          const baseOrderResult = {
            orderItem: orderItem.id,
            status: esimOrder.esimStatus || "created",
            orderNo: esimOrder.orderNo || "",
          };

          // Step 2: Process top-up if needed
          let topupStatus = "not_needed";
          let topupError: string | undefined;
          
          if (orderItem.extraDays && orderItem.extraDays > 0 && orderItem.topupPackageCode && esimOrder.iccid) {
            const topupResult = await processTopUp(
              orderItem.id,
              esimOrder.iccid,
              orderItem.extraDays,
              orderItem.topupPackageCode
            );
            
            if (topupResult.success) {
              topupStatus = "success";
            } else {
              topupStatus = "failed";
              topupError = topupResult.error;
              console.error(`[Activate] Top-up failed for orderItem ${orderItem.id}: ${topupResult.error}`);
            }
          }

          esimResults.push({
            ...baseOrderResult,
            topupStatus,
            topupError,
          });

          if (esimOrder.orderNo) {
            await prisma.order.update({
              where: { id: orderIdNum },
              data: {
                esimaccessOrderId: esimOrder.orderNo,
                esimaccessOrderStatus: esimOrder.esimStatus || esimOrder.orderStatus || "ACTIVATED",
              },
            });
          }
        } catch (esimError) {
          console.error("[Activate] eSIM error:", esimError);
          esimResults.push({
            orderItem: orderItem.id,
            status: "error",
            orderNo: "",
            topupStatus: "not_needed",
            topupError: String(esimError),
          });
        }
      }
    }

    // Send confirmation email if order has eSIM data
    const updatedOrder = await prisma.order.findUnique({
      where: { id: orderIdNum },
      include: { orderItems: true },
    });

    const hasEsim = updatedOrder?.orderItems.some(i => i.esimIccid);
    if (updatedOrder?.customerEmail && hasEsim) {
      try {
        const { sendEmail, getOrderConfirmationHtml, getOrderConfirmationAdminHtml } = await import("@/lib/email");

        await sendEmail({
          to: updatedOrder.customerEmail,
          subject: `OW SIM Order #${updatedOrder.id} - Your eSIM is ready!`,
          html: getOrderConfirmationHtml({
            id: updatedOrder.id,
            totalAmount: updatedOrder.totalAmount,
            customerName: updatedOrder.customerName,
            items: updatedOrder.orderItems.map((item) => ({
              planName: item.planName,
              price: item.price,
              quantity: item.quantity,
              qrImage: item.esimQrImage,
              activationCode: item.activationCode,
              iccid: item.esimIccid,
            })),
          }),
        });
        console.log(`[Activate] Email sent to ${updatedOrder.customerEmail}`);

        const adminEmail = process.env.ADMIN_EMAIL;
        if (adminEmail) {
          await sendEmail({
            to: adminEmail,
            subject: `New Order #${updatedOrder.id} - ${updatedOrder.totalAmount.toFixed(2)}`,
            html: getOrderConfirmationAdminHtml({
              id: updatedOrder.id,
              totalAmount: updatedOrder.totalAmount,
              customerName: updatedOrder.customerName,
              customerEmail: updatedOrder.customerEmail,
              items: updatedOrder.orderItems.map((item) => ({
                planName: item.planName,
                price: item.price,
              })),
            }),
          });
        }
      } catch (emailErr) {
        console.error("[Activate] Email failed:", emailErr);
      }
    }

    // Create commission for referrer
    if (order.userId) {
      const user = await prisma.user.findUnique({
        where: { id: order.userId },
        select: { referredById: true },
      });

      if (user?.referredById) {
        try {
          const { createCommission } = await import("@/lib/affiliate");
          await createCommission(
            user.referredById,
            order.userId,
            order.id,
            String(order.id),
            order.totalAmount
          );
        } catch (commissionError) {
          console.error("[Activate] Commission error:", commissionError);
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      order: updatedOrder, 
      esimResults 
    });
  } catch (error) {
    console.error("[Activate] Error:", error);
    return NextResponse.json({ error: "Activation failed" }, { status: 500 });
  }
}
