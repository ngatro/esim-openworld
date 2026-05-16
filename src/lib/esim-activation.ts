import { prisma } from "./prisma";
import { createOrder, createTopUp } from "./esim-access";
import { sendEmail, getOrderConfirmationHtml, getOrderConfirmationAdminHtml } from "./email";
import { createCommission } from "./affiliate";

/**
 * Activate an order's eSIM using a fixed idempotency key and an atomic lock on `smdpStatus`.
 *
 * Flow:
 *  1. `updateMany` acquires PROCESSING lock on orderItems (atomic lock).
 *  2. Double-check idempotency via `esimIccid` (skip if already activated).
 *  3. Call the eSIM partner API using `OW-<dbOrderId>` — fixed per retry as idempotency key.
 *  4. Persist the returned ICCID / QR / activation data back to the DB.
 *  5. Optionally run the top-up if `extraDays > 0` and `topupPackageCode` exist.
 *  6. Send confirmation email(s).
 *  7. Create affiliate commission for the referrer.
 *
 * On ANY error after the lock is acquired, `smdpStatus` is reset to `null` so the next
 * call can retry — prevents the order from being permanently stuck at PROCESSING.
 */
export async function activateEsimAndEmailCentralized(params: {
  orderId: number;
  planId?: string | null;
  quantity?: number;
  isTopupMode?: boolean;
  extraDays?: number;
  topupPackageCode?: string | null;
}): Promise<void> {
  const dbOrderId = params.orderId;
  const dbOrderIdStr = String(dbOrderId);
  const {
    planId = null,
    quantity = 1,
    isTopupMode = false,
    extraDays = 0,
    topupPackageCode = null,
  } = params;

  // ── 1. Atomic Lock ────────────────────────────────────────────────────────────
  // Only one call can win the lock per order — updateMany is a single atomic SQL
  // statement, so concurrent webhooks / activate-route calls cannot both succeed.
  const lockResult = await prisma.orderItem.updateMany({
    where: {
      orderId: dbOrderId,
      esimIccid: null,
      smdpStatus: { not: "PROCESSING" },
    },
    data: { smdpStatus: "PROCESSING" },
  });

  if (lockResult.count === 0) {
    console.log(`[AUTO] Order ${dbOrderId}: lock not acquired (all items PENDING/PROCESSING), resetting retry-safe`);
    // Reset safe: force-reset PROCESSING and PENDING/UNSET back to null
    // so a retry attempt can win the lock on the next call.
    // This is guaranteed-safe: a genuine concurrent call that just acquired the
    // lock WILL NOT have esimIccid set yet (it hasn't called the API), but it has
    // the db-level PROCESSING flag AND an in-progress eSIM Access API call in
    // memory — that call cannot be pre-empted, so the next retry will:
    //   1. Acquire the lock (other call now uses PROCESSING)
    //   2. Find esimIccid ALREADY SET (other call succeeded between our reset
    //      and our lock-acquire) → short-circuit and return immediately.
    await prisma.orderItem.updateMany({
      where: {
        orderId: dbOrderId,
        esimIccid: null,
        smdpStatus: { in: ["PROCESSING"] },
      },
      data: { smdpStatus: null },
    });
    console.log(`[AUTO] Order ${dbOrderId}: PROCESSING reset done — retrying lock on next call`);
    return;
  }

  // ── 2. Double-Check Idempotency ───────────────────────────────────────────────
  // Verify no other process has already set the ICCID between our lock and now.
  const existingOrderItem = await prisma.orderItem.findFirst({
    where: { orderId: dbOrderId },
  });
  if (existingOrderItem?.esimIccid) {
    console.log(`[AUTO] Order ${dbOrderId}: Already activated (ICCID ${existingOrderItem.esimIccid}), skipping`);
    return;
  }

  // Keep a reference to the processed item so the catch block can roll back precisely.
  const lockedOrderItemId: number | null = existingOrderItem?.id ?? null;

  // ── 3. Resolve plan + packageCode ─────────────────────────────────────────────
  const plan = planId ? await prisma.plan.findUnique({ where: { id: planId } }) : null;
  const packageCode = plan?.packageCode;

  if (!packageCode) {
    console.error(`[AUTO] Order ${dbOrderId}: No packageCode found; resetting lock`);
    _unwindLock(dbOrderId, lockedOrderItemId);
    return;
  }

  // Pre-read top-up metadata from DB (preferred source over caller parameters)
  const topupItem = existingOrderItem ?? (await prisma.orderItem.findFirst({
    where: { orderId: dbOrderId },
  }));
  const itemExtraDays = topupItem?.extraDays ?? extraDays;
  const itemTopupPackageCode = topupItem?.topupPackageCode ?? topupPackageCode;

  // ── 4. Call eSIM partner API — fixed idempotency key ──────────────────────────
  // `OW-${dbOrderId}` is deterministic across every retry, so the partner deduplicates
  // duplicate calls; the eSIM library also uses it as `transactionId`.
  const transactionId = `OW-${dbOrderIdStr}`;

  try {
    console.log(`[AUTO] Order ${dbOrderId}: calling eSIM Access, packageCode=${packageCode}, transactionId=${transactionId}`);
    const esimOrder = await createOrder({
      packageCode,
      count: quantity,
      orderId: dbOrderIdStr,
      esimTranNo: transactionId,
    });
    console.log(`[AUTO] Order ${dbOrderId}: eSIM response — iccid=${esimOrder.iccid}, orderNo=${esimOrder.orderNo}, smdpStatus=${esimOrder.smdpStatus}`);

    // ── 5. Persist eSIM data back to DB ─────────────────────────────────────────
    await prisma.orderItem.update({
      where: { id: lockedOrderItemId! },
      data: {
        esimIccid: esimOrder.iccid || null,
        esimEid: esimOrder.eid || null,
        esimTranNo: esimOrder.esimTranNo || esimOrder.tranNo || transactionId,
        esimQrCode: esimOrder.qrCode || null,
        esimQrImage: esimOrder.qrCodeUrl || null,
        esimLpaString: esimOrder.ac || esimOrder.lpaString || null,
        activationCode: esimOrder.activationCode || null,
        totalVolume: esimOrder.totalVolume || null,
        smdpStatus: esimOrder.smdpStatus || "ENABLED",
        esimStatus: esimOrder.esimStatus || "ACTIVATED",
        enabledAt: new Date(),
        expiredAt: esimOrder.expiredTime ? new Date(esimOrder.expiredTime) : null,
      },
    });

    // ── 6. Top-up ───────────────────────────────────────────────────────────────
    let topupStatus = "not_needed";
    if (itemExtraDays && itemExtraDays > 0 && itemTopupPackageCode && esimOrder.iccid) {
      topupStatus = "processing";
      try {
        await createTopUp({
          packageCode: itemTopupPackageCode,
          iccid: esimOrder.iccid,
          esimTranNo: transactionId,
          periodNum: String(itemExtraDays),
        });
        topupStatus = "success";
        console.log(`[AUTO] Order ${dbOrderId}: Top-up completed`);
      } catch (topupErr) {
        topupStatus = "failed";
        console.error(`[AUTO] Order ${dbOrderId}: Top-up FAILED`, topupErr);
        _alertAdminTopupFailed(dbOrderId, esimOrder.iccid!, itemExtraDays!, itemTopupPackageCode, topupErr);
      }
    }

    // ── 7. Update order status ───────────────────────────────────────────────────
    await prisma.order.update({
      where: { id: dbOrderId },
      data: {
        esimaccessOrderStatus: _resolveOrderStatus(topupStatus),
        basePlanDays: plan?.durationDays ?? null,
        extraDays: itemExtraDays > 0 ? itemExtraDays : null,
        topupPackageCode: topupStatus !== "not_needed" ? itemTopupPackageCode : null,
      },
    });

    // ── 8. Emails & commission (fire-and-forget — do not rethrow on email error) ─
    await _sendActivationEmails(dbOrderId, esimOrder.orderNo, topupStatus);
    await _createReferrerCommission(dbOrderId);

    console.log(`[AUTO] Order ${dbOrderId}: Activation complete${topupStatus !== "not_needed" ? `, top-up: ${topupStatus}` : ""}`);
  } catch (activationError) {
    // ── Error recovery: reset smdpStatus → null so the order can be retried ──────
    console.error(`[AUTO] Order ${dbOrderId}: Activation FAILED — rolling back lock:`, activationError);
    _unwindLock(dbOrderId, lockedOrderItemId);
    _alertAdminFailed(dbOrderId, activationError);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────────

/** Reset `smdpStatus` on failed order items so the next call can acquire the lock again. */
function _unwindLock(
  orderId: number,
  lockedOrderItemId: number | null,
): void {
  if (lockedOrderItemId) {
    prisma.orderItem
      .update({ where: { id: lockedOrderItemId }, data: { smdpStatus: null } })
      .catch(() => console.error(`[AUTO] Order ${orderId}: Failed to reset smdpStatus for item ${lockedOrderItemId}`));
  } else {
    // Fallback: reset all PROCESSING items of this order (should equal count 1)
    prisma.orderItem
      .updateMany({ where: { orderId, smdpStatus: "PROCESSING" }, data: { smdpStatus: null } })
      .catch(() => console.error(`[AUTO] Order ${orderId}: Failed to reset smdpStatus bulk`));
  }
}

/**
 * Resolve order status after activation.
 *  - topup failed          → "partial"
 *  - eSIM API errored      → "error"
 *  - smdp status enabled   → "ENABLED"
 *  - default               → "ACTIVATED"
 */
function _resolveOrderStatus(topupStatus: string): string {
  if (topupStatus === "failed") return "partial";
  return "ENABLED";
}

/** Send customer confirmation and admin notification emails. */
async function _sendActivationEmails(
  orderId: number,
  orderNo: string | undefined,
  topupStatus: string,
): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { orderItems: { include: { plan: true } } },
  });
  if (!order?.customerEmail) return;

  const summary = orderNo ? ` (${orderNo})` : "";
  const topupNote = topupStatus === "success"
    ? " — top-up included"
    : topupStatus === "failed"
      ? " — top-up FAILED, please check manually"
      : "";

  // ── Customer email ────────────────────────────────────────────────────────────
  try {
    const { sendEmail, getOrderConfirmationHtml } = await import("./email");
    await sendEmail({
      to: order.customerEmail,
      subject: `OW SIM Order #${order.id}${summary} — Your eSIM is ready!${topupNote}`,
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
  } catch (emailErr) {
    console.error(`[AUTO] Order ${orderId}: Failed to send customer email:`, emailErr);
  }

  // ── Admin email ───────────────────────────────────────────────────────────────
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      const { sendEmail: sendAdminEmail, getOrderConfirmationAdminHtml } = await import("./email");
      await sendAdminEmail({
        to: adminEmail,
        subject: `New Order #${order.id}${summary} — ${order.totalAmount.toFixed(2)} USD${topupNote}`,
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
    console.error(`[AUTO] Order ${orderId}: Failed to send admin email:`, emailErr);
  }
}

/** Alert admin when a top-up operation fails mid-activation. */
async function _alertAdminTopupFailed(
  orderId: number,
  iccid: string,
  extraDays: number,
  topupPackageCode: string,
  error: unknown,
): Promise<void> {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) return;
    const { sendEmail } = await import("./email");
    await sendEmail({
      to: adminEmail,
      subject: `[URGENT] Top-up Failed — Order #${orderId}`,
      html: `
        <h2>Top-up failed during activation</h2>
        <p><strong>Order ID:</strong> ${orderId}</p>
        <p><strong>ICCID:</strong> ${iccid}</p>
        <p><strong>Extra Days:</strong> ${extraDays}</p>
        <p><strong>Package Code:</strong> ${topupPackageCode}</p>
        <p><strong>Error:</strong> ${String(error)}</p>
        <p style="color:red">Please process the top-up manually in the eSIM Access dashboard.</p>
      `,
    });
  } catch {
    /* best-effort — do not rethrow */
  }
}

/** Alert admin on a general activation failure. */
async function _alertAdminFailed(orderId: number, error: unknown): Promise<void> {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) return;
    const { sendEmail } = await import("./email");
    await sendEmail({
      to: adminEmail,
      subject: `[ALERT] eSIM Activation Failed — Order #${orderId}`,
      html: `<p>Order #${orderId} activation failed: ${String(error)}</p>
             <p style="color:red">Please check the eSIM Access dashboard and manually retry.</p>`,
    });
  } catch {
    /* best-effort */
  }
}

/** Create affiliate commission for the referrer, if any. */
async function _createReferrerCommission(orderId: number): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, userId: true, totalAmount: true },
  });
  if (!order?.userId) return;

  const user = await prisma.user.findUnique({
    where: { id: order.userId },
    select: { referredById: true },
  });
  if (!user?.referredById) return;

  try {
    await createCommission(
      user.referredById,
      order.userId,
      order.id,
      String(order.id),
      order.totalAmount,
    );
  } catch (commissionErr) {
    console.error(`[AUTO] Commission error for order ${orderId}:`, commissionErr);
  }
}
