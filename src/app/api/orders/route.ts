import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createOrder, queryOrder, createTopUp } from "@/lib/esim-access";
import { sendEmail, getOrderConfirmationHtml, getOrderConfirmationAdminHtml } from "@/lib/email";
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

import { createCommission } from "@/lib/affiliate";

// Backend-only price calculation to prevent price manipulation
function calculateOrderPrice(
  plan: { id: string; priceUsd: number; retailPriceUsd: number; durationDays: number; supportTopUpType: number },
  topupMode: boolean,
  selectedDuration: number | undefined,
  quantity: number
): { price: number; extraDays: number; basePlanDays: number; topupPackageCode: string | null } {
  let itemPrice = plan.priceUsd;
  let extraDays = 0;
  let basePlanDays = plan.durationDays;
  let topupPackageCode: string | null = null;

  // Use retail price if available (customer-facing price)
  if (plan.retailPriceUsd > 0) {
    itemPrice = plan.retailPriceUsd;
  }

  // Handle top-up mode: Calculate extra days
  // Note: actual topupPackageCode is fetched in main handler to avoid multiple DB calls
  if (topupMode && selectedDuration && selectedDuration > 0) {
    extraDays = selectedDuration - plan.durationDays;
    // topupPackageCode will be fetched from DB in the main handler
  }

  const totalPrice = itemPrice * quantity;
  
  return { price: totalPrice, extraDays, basePlanDays, topupPackageCode };
}

// Process top-up after base order is created
async function processTopUp(
  orderItemId: number,
  iccid: string,
  extraDays: number,
  topupPackageCode: string
): Promise<{ success: boolean; error?: string; topupResult?: unknown }> {
  try {
    console.log(`[TopUp] Starting for orderItem=${orderItemId}, extraDays=${extraDays}, packageCode=${topupPackageCode}`);
    
    // Call the top-up API
    const topupResult = await createTopUp({
      packageCode: topupPackageCode,
      iccid: iccid,
      periodNum: String(extraDays), // The number of extra days
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

    return { success: true, topupResult };
  } catch (error) {
    console.error(`[TopUp] Failed for orderItem=${orderItemId}:`, error);
    return { success: false, error: String(error) };
  }
}

export async function POST(request: Request) {
  try {
    // 1. Get session from shared helper (handles both legacy token and NextAuth)
    const session = await getSessionFromRequest(request);

    // 2. Parse request body
    const {
      items,
      customerName,
      customerEmail: bodyCustomerEmail,
      status,
      // Top-up mode fields
      isTopupMode = false,
      selectedDuration,
    } = await request.json();

    // 3. Determine identity: use session if available, fallback to email in body
    let userId: number | null = null;
    let userEmail: string | null = null;

    if (session?.user) {
      userEmail = session.user.email || userEmail;
      if (session.user.id !== null && session.user.id !== undefined) {
        userId = Number(session.user.id);
      }
      // Fallback: if session has email but no id, query by email
      if (!userId && userEmail) {
        const dbUser = await prisma.user.findUnique({ where: { email: userEmail } });
        if (dbUser) userId = dbUser.id;
      }
    }

    // 3. If still no userId, try to find user by email from body
    if (!userId && bodyCustomerEmail) {
      const dbUser = await prisma.user.findUnique({ where: { email: bodyCustomerEmail } });
      if (dbUser) userId = dbUser.id;
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "No items" }, { status: 400 });
    }

    // If user is authenticated, clean up any existing pending orders for the same plan(s)
    // to avoid duplicate pending orders when user retries payment
    if (userId) {
      for (const item of items) {
        if (item.planId) {
          const existingPending = await prisma.order.findFirst({
            where: {
              userId,
              status: "pending",
              orderItems: {
                some: { planId: item.planId }
              }
            },
            include: { orderItems: true }
          });
          if (existingPending) {
            console.log(`[Orders] Cleaning up duplicate pending order ${existingPending.id} for plan ${item.planId}`);
            await prisma.order.delete({ where: { id: existingPending.id } });
          }
        }
      }
    }

    let totalAmount = 0;
    let totalExtraDays = 0;
    let hasTopupMode = false;
    const orderItemsData: {
      planId: string | null;
      planName: string;
      price: number;
      quantity: number;
      extraDays?: number;
      basePlanDays?: number;
      topupPackageCode?: string | null;
    }[] = [];

    for (const item of items) {
      const plan = await prisma.plan.findUnique({
        where: { id: item.planId },
      });

      if (!plan) {
        return NextResponse.json(
          { error: `Plan not found: ${item.planId}` },
          { status: 400 }
        );
      }

      // Determine chosen days (total duration selected) with proper casting
      const chosenDays = Number(item.selectedDuration || item.days || selectedDuration || plan.durationDays);
      const baseDays = Number(plan.durationDays);
      const extraDays = Math.max(0, chosenDays - baseDays);
      
      // If extraDays > 0, this order includes top-up
      if (extraDays > 0) {
        hasTopupMode = true;
        totalExtraDays = Math.max(totalExtraDays, extraDays);
      }

      let topupPackageCode: string | null = null;
      let topupRetailPrice = 0;

      // If top-up needed (extraDays > 0), find topup package
      if (extraDays > 0) {
        // Prefer provided topupPackageCode (from resumed pending order or cart)
        if (item.topupPackageCode) {
          // Look up by packageCode regardless of plan to honor user's selected package
          const specifiedPkg = await prisma.topupPackage.findFirst({
            where: { packageCode: item.topupPackageCode, isActive: true },
          });
          if (specifiedPkg) {
            topupPackageCode = specifiedPkg.packageCode;
            topupRetailPrice = specifiedPkg.retailPriceUsd > 0 ? specifiedPkg.retailPriceUsd : specifiedPkg.priceUsd;
          }
        }
        // If no specific package provided or not found, fallback to any flexible active package for this plan
        if (!topupPackageCode) {
          const topupPkg = await prisma.topupPackage.findFirst({
            where: { planId: plan.id, isActive: true, isFlexible: true },
          });
          if (topupPkg) {
            topupPackageCode = topupPkg.packageCode;
            topupRetailPrice = topupPkg.retailPriceUsd > 0 ? topupPkg.retailPriceUsd : topupPkg.priceUsd;
          }
        }
      }

      // Calculate price: Base price + (extraDays * topupPrice) - Backend-only calculation
      let itemPrice = plan.priceUsd;
      if (plan.retailPriceUsd > 0) {
        itemPrice = plan.retailPriceUsd;
      }
      
      // Add top-up cost if applicable
      if (extraDays > 0 && topupRetailPrice > 0) {
        itemPrice = itemPrice + (extraDays * topupRetailPrice);
      }

      const itemTotal = itemPrice * (item.quantity || 1);
      totalAmount += itemTotal;

      orderItemsData.push({
        planId: plan.id,
        planName: plan.name,
        price: itemPrice,
        quantity: item.quantity || 1,
        extraDays: extraDays > 0 ? extraDays : undefined,
        basePlanDays: plan.durationDays,
        topupPackageCode,
      });
    }

     // Determine order status: ALWAYS create as pending, will be activated after payment
     // For admin gifts or free orders, use a separate flag or endpoint
     const orderStatus = "pending";
    
    // Debug log before creating order
    console.log("DEBUG ORDER:", {
      totalAmount,
      basePlanDays: orderItemsData[0]?.basePlanDays,
      extraDays: hasTopupMode ? totalExtraDays : null,
      isTopupMode: hasTopupMode,
      topupPackageCode: hasTopupMode ? orderItemsData[0]?.topupPackageCode : null,
      selectedDuration: selectedDuration || null,
      orderItemsData
    });

    const order = await prisma.order.create({
      data: {
        userId,
        totalAmount,
        status: orderStatus,
        customerName: customerName || null,
        customerEmail: bodyCustomerEmail || null,
        // Top-up metadata
        isTopupMode: hasTopupMode,
        selectedDuration: selectedDuration || null,
        // Always save basePlanDays (duration of the base plan)
        basePlanDays: orderItemsData[0]?.basePlanDays || null,
        extraDays: hasTopupMode ? totalExtraDays : null,
        topupPackageCode: hasTopupMode ? orderItemsData[0]?.topupPackageCode : null,
        orderItems: {
          create: orderItemsData,
        },
     },
     include: {
       orderItems: true,
     },
   });
   console.log("Created order:", order);

   // Return the created order
   return NextResponse.json({ order }, { status: 201 });

   // Skip eSIM creation for pending orders - will be activated after payment confirmation
   // eSIM creation is handled by payment webhook (PayPal, LemonSqueezy, etc.) or admin gift flow
 } catch (error) {
     console.error("Order creation error:", error);
     const errorMessage = error instanceof Error ? error.message : "Order failed";
     return NextResponse.json({ error: errorMessage }, { status: 500 });
   }
}

// PUT: Retry payment for pending order
export async function PUT(request: Request) {
   try {
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

     if (!userId) {
       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
     }
    
    const { orderId, paymentMethod } = await request.json();
    
    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
    }
    
    // Find the pending order
    const order = await prisma.order.findFirst({
      where: { 
        id: orderId,
        userId: userId,
        status: "pending",
      },
      include: { orderItems: true },
    });
    
    if (!order) {
      return NextResponse.json({ error: "Pending order not found" }, { status: 404 });
    }
    
    // Mark as awaiting payment
    await prisma.order.update({
      where: { id: orderId },
      data: { status: "awaiting_payment" },
    });
    
    return NextResponse.json({ success: true, order, message: "Ready for payment" });
  } catch (error) {
    console.error("Order creation error:", error);
    const errorMessage = error instanceof Error ? error.message : "Order failed";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}



export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const emailParam = url.searchParams.get("email");

    // 1. Lấy session từ NextAuth (Dành cho Google OAuth)
    const session = await getSessionFromRequest(request);
    
    // Determine identity: session (verified) or email param (guest)
    let userId: number | null = null;
    let userEmail: string | null = emailParam;

    if (session?.user) {
      userEmail = session.user.email || userEmail;
      if (session.user.id !== null && session.user.id !== undefined) {
        userId = Number(session.user.id);
      }
      if (!userId && userEmail) {
        const dbUser = await prisma.user.findUnique({ where: { email: userEmail } });
        if (dbUser) userId = dbUser.id;
      }
    }

    if (!userId && !userEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 4. TRUY VẤN ĐƠN HÀNG: Tìm theo ID user HOẶC Email khách hàng để tránh sót đơn
    const where: any = {
      OR: [
        userId ? { userId } : null,
        userEmail ? { customerEmail: userEmail } : null
      ].filter(Boolean)
    };

    const orders = await prisma.order.findMany({
      where,
      include: {
        orderItems: {
          include: {
            plan: { select: { id: true, supportTopUpType: true, name: true } },
          },
        },
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    console.log("[Orders API] Found", orders.length, "orders");

    return NextResponse.json({ orders }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (error) {
    console.error("Lỗi GET Order:", error);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}