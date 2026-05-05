import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createOrder as createEsimOrder } from "@/lib/esim-access";

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

export async function POST(request: Request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { userId, userEmail, packageCode, quantity = 1, customerName } = await request.json();

    if (!packageCode) {
      return NextResponse.json({ error: "Package code is required" }, { status: 400 });
    }

    // Find the plan by packageCode
    const plan = await prisma.plan.findUnique({
      where: { packageCode: packageCode },
    });

    if (!plan) {
      return NextResponse.json({ error: "Plan not found with this package code" }, { status: 404 });
    }

    // Determine user
    let user = null;
    if (userId) {
      user = await prisma.user.findUnique({ where: { id: parseInt(userId) } });
    } else if (userEmail) {
      user = await prisma.user.findUnique({ where: { email: userEmail } });
    }

     // Create the order with "completed" status (free gift, already paid)
     const order = await prisma.order.create({
       data: {
         userId: user?.id || null,
         totalAmount: 0, // Free
         currency: "USD",
         status: "completed", // Mark as completed since it's a free gift
         customerName: customerName || user?.name || "Admin Gift",
         customerEmail: user?.email || userEmail || null,
         esimaccessOrderStatus: "gift",
         orderItems: {
           create: {
             planId: plan.id,
             planName: plan.name,
             packageCode: plan.packageCode,
             quantity: quantity,
             price: 0, // Free
           },
         },
       },
       include: {
         orderItems: true,
       },
     });

      // Create the eSIM from the eSIM Access API (immediate for admin gift)
      const esimOrder = await createEsimOrder({
        packageCode: plan.packageCode,
        count: quantity,
      });

      // Update order item with eSIM data
      const orderItem = order.orderItems[0];
      await prisma.orderItem.update({
        where: { id: orderItem.id },
        data: {
          esimIccid: esimOrder.iccid || null,
          esimEid: esimOrder.eid || null,
          esimTranNo: esimOrder.esimTranNo || null,
          esimQrCode: esimOrder.qrCode || null,
          esimQrImage: esimOrder.qrCodeUrl || null,
          esimLpaString: esimOrder.ac || esimOrder.lpaString || null,
          activationCode: esimOrder.activationCode || null,
          totalVolume: esimOrder.totalVolume || null,
          smdpStatus: esimOrder.smdpStatus || null,
          esimStatus: esimOrder.esimStatus || null,
        },
      });

      // Update order with eSIM order info
      await prisma.order.update({
        where: { id: order.id },
        data: {
          esimaccessOrderId: esimOrder.orderNo || esimOrder.iccid,
          esimaccessOrderStatus: "gift_completed",
        },
      });

      return NextResponse.json({
        success: true,
        order: {
          id: order.id,
          status: order.status,
          totalAmount: order.totalAmount,
          customerEmail: order.customerEmail,
          customerName: order.customerName,
        },
        esim: {
          iccid: esimOrder.iccid,
          qrCode: esimOrder.qrCode,
          qrImage: esimOrder.qrCodeUrl,
          activationCode: esimOrder.activationCode,
          lpaString: esimOrder.ac,
          totalVolume: esimOrder.totalVolume,
          esimStatus: esimOrder.esimStatus,
          orderNo: esimOrder.orderNo,
        },
      });
  } catch (error) {
    console.error("[Admin Gift eSIM] Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// GET: Fetch available package codes for admin reference
export async function GET(request: Request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      select: {
        packageCode: true,
        name: true,
        destination: true,
      },
      orderBy: { name: "asc" },
      take: 100,
    });

    return NextResponse.json({ plans });
  } catch (error) {
    console.error("[Admin Gift eSIM] Get plans error:", error);
    return NextResponse.json({ error: "Failed to fetch plans" }, { status: 500 });
  }
}