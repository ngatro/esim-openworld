import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { activateEsimAndEmailCentralized } from "@/lib/esim-activation";

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

// Activate eSIM for a completed order — delegates to the centralized activation handler.
export async function POST(
  request: Request,
  _params: { params: Promise<{}> },
) {
  try {
    const body = await request.json().catch(() => ({}));
    const { orderId, force = false } = body;

    const orderIdNum = parseInt(orderId as string);
    if (isNaN(orderIdNum)) {
      return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
    }

    // ── Auth ───────────────────────────────────────────────────────────────────
    const session = await getSessionFromRequest(request);
    let userId: number | null = null;

    if (session?.user) {
      userId = session.user.id != null ? Number(session.user.id) : null;
      if (!userId && session.user.email) {
        const dbUser = await prisma.user.findUnique({ where: { email: session.user.email } });
        if (dbUser) userId = dbUser.id;
      }
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── Fetch order ─────────────────────────────────────────────────────────────
    const order = await prisma.order.findFirst({
      where: { id: orderIdNum },
      include: { orderItems: true, user: true },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // ── Authorization ───────────────────────────────────────────────────────────
    const isAdmin = session?.user?.role === "admin";
    const isOwner = order.userId === userId;

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Unauthorized - not your order" }, { status: 403 });
    }

    // ── Mark pending orders as completed before activation ───────────────────────
    if (order.status === "pending" || order.status === "awaiting_payment") {
      await prisma.order.update({ where: { id: orderIdNum }, data: { status: "completed" } });
    }

    // ── Idempotency short-circuit ───────────────────────────────────────────────
    const hasEsimData = order.orderItems.some((item) => item.esimIccid);
    if (hasEsimData && !force) {
      return NextResponse.json({ success: true, order, message: "Order already activated" });
    }

    // ── Resolve plan + top-up metadata from orderItem ────────────────────────────
    // The order's first (and usually only) item carries the planId / top-up info.
    const orderItem = order.orderItems[0];
    const itemPlanId: string | undefined = orderItem?.planId ?? undefined;
    const itemExtraDays: number = orderItem?.extraDays ?? 0;
    const itemTopupPackageCode: string | undefined = orderItem?.topupPackageCode ?? undefined;

    // ── Delegate ALL activation work to the centralized handler ──────────────────
    // The handler acquires its own atomic lock via updateMany, uses orderId as the
    // idempotency key for the partner API, and resets smdpStatus → null on any error.
    await activateEsimAndEmailCentralized({
      orderId: orderIdNum,
      planId: itemPlanId ?? null,
      quantity: orderItem?.quantity ?? 1,
      isTopupMode:
        itemExtraDays > 0 || itemTopupPackageCode != null,
      extraDays: itemExtraDays,
      topupPackageCode: itemTopupPackageCode ?? null,
    });

    // ── Return updated order ────────────────────────────────────────────────────
    const updatedOrder = await prisma.order.findUnique({
      where: { id: orderIdNum },
      include: { orderItems: true },
    });

    if (!updatedOrder) {
      return NextResponse.json({ error: "Order not found after activation" }, { status: 404 });
    }

    const esimResults = updatedOrder.orderItems.map((item) => ({
      orderItem: item.id,
      status: item.smdpStatus ?? (item.esimIccid ? "ENABLED" : "error"),
      orderNo: item.esimTranNo ?? "",
      esimIccid: item.esimIccid,
      smdpStatus: item.smdpStatus,
    }));

    return NextResponse.json({ success: true, order: updatedOrder, esimResults });
  } catch (error) {
    console.error("[Activate] Error:", error);
    return NextResponse.json({ error: "Activation failed" }, { status: 500 });
  }
}
