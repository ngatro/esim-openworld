"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useI18n } from "@/components/providers/I18nProvider";

function getEsimStatusLabel(item: OrderItem): { label: string; color: string } {
  // 1. FINAL states (kết thúc)
  if (item.esimStatus === "USED_UP" || item.esimStatus === "USED_EXPIRED") {
    return { label: "Depleted", color: "bg-red-500/20 text-red-600" };
  }

  if (item.esimStatus === "UNUSED_EXPIRED") {
    return { label: "Expired", color: "bg-slate-500/20 text-slate-600" };
  }

  if (item.esimStatus === "CANCEL" || item.esimStatus === "REVOKED") {
    return { label: "Terminated", color: "bg-slate-500/20 text-slate-600" };
  }

  // 2. ACTIVE state (quan trọng hơn smdpStatus)
  if (item.esimStatus === "IN_USE") {
    return { label: "In Use", color: "bg-green-500/20 text-green-600" };
  }

  // 3. READY TO SCAN (GOT_RESOURCE)
  if (item.esimStatus === "GOT_RESOURCE") {
    return { label: "Ready to Scan", color: "bg-blue-500/20 text-blue-600" };
  }

  // 4. REALTIME progress (chỉ hiển thị khi chưa có state rõ ràng)
  if (item.smdpStatus === "DOWNLOAD") {
    return { label: "Downloading", color: "bg-yellow-500/20 text-yellow-600" };
  }

  if (item.smdpStatus === "INSTALLATION") {
    return { label: "Installing", color: "bg-yellow-500/20 text-yellow-600" };
  }

  if (item.smdpStatus === "ENABLED") {
    return { label: "Activating", color: "bg-yellow-500/20 text-yellow-600" };
  }

  if (item.smdpStatus === "DISABLED") {
    return { label: "Disabled", color: "bg-slate-500/20 text-slate-600" };
  }

  if (item.smdpStatus === "DELETED") {
    return { label: "Deleted", color: "bg-red-500/20 text-red-600" };
  }

  // 5. fallback
  return { label: "Processing", color: "bg-yellow-500/20 text-yellow-600" };
}

interface OrderItem {
  id: number;
  planId: string | null;
  planName: string;
  price: number;
  quantity: number;
  esimIccid: string | null;
  esimEid: string | null;
  esimTranNo: string | null;
  esimQrCode: string | null;
  esimQrImage: string | null;
  esimLpaString: string | null;
  activationCode: string | null;
  totalVolume: number | null;
  smdpStatus: string | null;
  esimStatus: string | null;
  orderUsage: number | null;
  enabledAt: string | null;
  // Top-up fields
  extraDays?: number | null;
  basePlanDays?: number | null;
  topupPackageCode?: string | null;
}

interface Order {
  id: number;
  totalAmount: number;
  status: string;
  currency: string;
  customerEmail: string | null;
  esimaccessOrderId: string | null;
  esimaccessOrderStatus: string | null;
  createdAt: string;
  orderItems: OrderItem[];
  // Top-up fields
  isTopupMode?: boolean;
  selectedDuration?: number | null;
  basePlanDays?: number | null;
  extraDays?: number | null;
  topupPackageCode?: string | null;
}

export default function OrdersPage() {
  const { user } = useAuth();
  const { formatPrice, t, locale } = useI18n();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
  const [guestEmail, setGuestEmail] = useState("");
  const [searched, setSearched] = useState(false);
  const [newlyReady, setNewlyReady] = useState<number[]>([]);

  async function fetchOrders() {
    if (!refreshing) setLoading(true);
    try {
      const url = user ? "/api/orders" : (guestEmail ? "/api/orders?email=" + encodeURIComponent(guestEmail) : null);
      if (!url) return;
      const res = await fetch(url);
      const data = await res.json();
      setOrders(data.orders || []);
      setSearched(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleRefresh() {
    setRefreshing(true);
    fetchOrders();
  }

  useEffect(() => {
    if (user || searched) {
      fetchOrders();
    } else {
      setLoading(false);
    }
  }, [user, searched]);

  useEffect(() => {
    const previousOrders = orders.filter(o => !newlyReady.includes(o.id));
    const newlyActivated = orders.filter(o => 
      o.orderItems.every(i => i.esimIccid) && 
      !previousOrders.some(p => p.id === o.id && p.orderItems.every(i => i.esimIccid))
    );
    if (newlyActivated.length > 0) {
      setNewlyReady(prev => [...prev, ...newlyActivated.map(o => o.id)]);
    }
  }, [orders]);

  function handleGuestSearch() {
    if (guestEmail) {
      setSearched(true);
      fetchOrders();
    }
  }

  if (loading && !searched) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Not logged in - show email search
  if (!user && !searched) {
    return (
      <div className="min-h-screen bg-orange-50 text-slate-800 py-12">
        <div className="max-w-md mx-auto px-4 text-center">
          <p className="text-5xl mb-4">📱</p>
          <h1 className="text-2xl font-bold mb-3">{t("orders.viewYourOrders")}</h1>
          <p className="text-slate-600 text-sm mb-6">{t("orders.emailPlaceholder")}</p>
          <div className="flex gap-2">
            <input type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)}
              placeholder="your@email.com" onKeyDown={(e) => e.key === "Enter" && handleGuestSearch()}
              className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm placeholder:text-slate-500 focus:outline-none focus:border-orange-400" />
            <button onClick={handleGuestSearch}
              className="bg-orange-500 hover:bg-orange-400 text-white font-semibold px-6 py-3 rounded-xl text-sm transition-colors">
              View
            </button>
          </div>
          <p className="text-slate-500 text-xs mt-4">or <Link href={`/${locale}/login`} className="text-orange-500 hover:text-orange-400">Login</Link> to see all orders</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-orange-50 text-slate-800 py-8 sm:py-12">
      <div className="max-w-4xl mx-auto px-3 sm:px-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">{t("orders.title")}</h1>
            <p className="text-slate-600 text-sm mt-1">{orders.length} order{orders.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex gap-2">
            <Link href={`/${locale}/plans`}>
              <button className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-8 py-3 rounded-xl transition-colors">
                {t("common.browsePlans")}
              </button>
            </Link>
          </div>
        </div>

        {newlyReady.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-green-500/20 border border-green-500/40 rounded-xl p-4 mb-4 flex items-center gap-3">
            <span className="text-2xl">🎉</span>
            <div>
              <p className="text-green-400 font-medium">{t("orders.esimReady")}</p>
              <p className="text-green-300/70 text-sm">{t("orders.checkEmail")}</p>
            </div>
          </motion.div>
        )}

        {orders.length === 0 ? (
          <div className="bg-white/80 border border-slate-200 rounded-2xl p-12 sm:p-16 text-center">
            <p className="text-5xl mb-4">📱</p>
            <h3 className="text-xl font-semibold text-slate-800 mb-2">{t("orders.noOrders")}</h3>
            <p className="text-slate-600 mb-6 text-sm">{t("orders.noOrdersDesc")}</p>
            <Link href={`/${locale}/plans`}>
              <button className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-8 py-3 rounded-xl transition-colors">
                {t("common.browsePlans")}
              </button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {orders.map((order) => (
              <motion.div key={order.id} className="bg-white/80 border border-slate-200 rounded-2xl overflow-hidden" layout>
                <button onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                  className="w-full p-4 sm:p-5 flex items-center justify-between hover:bg-slate-100 transition-colors text-left">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center ${
                      order.status === "completed" ? "bg-green-500/20" : "bg-yellow-500/20"
                    }`}>
                      <span className="text-lg sm:text-xl">{order.status === "completed" ? "✅" : "⏳"}</span>
                    </div>
                    <div>
                      <p className="text-slate-800 font-semibold text-sm sm:text-base">{t("orders.order")} #{10000 + order.id}</p>
                      <p className="text-slate-500 text-xs sm:text-sm">
                        {new Date(order.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="text-right">
                      <p className="text-base sm:text-lg font-bold text-slate-800">{formatPrice(order.totalAmount)}</p>
                      <div className="flex gap-1 mt-1">
                        <span className={`inline-block px-2 py-0.5 text-[10px] sm:text-xs font-medium rounded-full ${
                          order.status === "completed" ? "bg-green-500/20 text-green-600" :
                          order.status === "pending" ? "bg-yellow-500/20 text-yellow-600" :
                          order.status === "awaiting_payment" ? "bg-orange-500/20 text-orange-600" :
                          "bg-red-500/20 text-red-600"
                        }`}>
                          {order.status === "completed" ? "Paid" : order.status === "awaiting_payment" ? "Awaiting Payment" : order.status}
                        </span>

                        {(() => {
                          const firstItem = order.orderItems[0];
                          const status = firstItem ? getEsimStatusLabel(firstItem) : { label: "Processing", color: "bg-slate-500/20 text-slate-400" };
                          return (
                            <span className={`inline-block px-2 py-0.5 text-[10px] sm:text-xs font-medium rounded-full ${status.color}`}>
                              {status.label}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                    <svg className={`w-4 h-4 sm:w-5 sm:h-5 text-slate-500 transition-transform ${expandedOrder === order.id ? "rotate-180" : ""}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                <AnimatePresence>
                  {expandedOrder === order.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
                      <div className="border-t border-slate-200 p-4 sm:p-5 space-y-4">
                        {order.orderItems.map((item) => (
                          <div key={item.id} className="bg-slate-50/80 rounded-xl p-4 sm:p-5">
                            <div className="flex items-center justify-between mb-4">
                              <div>
                                <h4 className="text-slate-800 font-medium text-sm sm:text-base">{item.planName}</h4>
                                <p className="text-slate-500 text-xs sm:text-sm">{formatPrice(item.price)} × {item.quantity}</p>
                              </div>
                              {item.esimIccid && (
                                <div className="text-right">
                                  <p className="text-[10px] text-slate-500">ICCID</p>
                                  <code className="text-orange-500 text-[10px] sm:text-xs">{item.esimIccid}</code>
                                </div>
                              )}
                            </div>

                            {(item.esimQrImage && item.esimQrImage.length > 0) ? (
                              <div className="flex flex-col sm:flex-row items-start gap-4">
                                <div className="bg-white rounded-xl p-3 sm:p-4 flex-shrink-0 mx-auto sm:mx-0">
                                  <img src={item.esimQrImage} alt="eSIM QR Code"
                                    className="w-36 h-36 sm:w-44 sm:h-44" />
                                </div>
                                <div className="flex-1 space-y-2 sm:space-y-3 text-center sm:text-left">
                                  <div>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{t("orders.scanToActivate")}</p>
                                    <p className="text-slate-500 text-xs sm:text-sm">{t("orders.scanInstructions")}</p>
                                  </div>
                                  {item.activationCode && (
                                    <div>
                                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{t("orders.manualActivationCode")}</p>
                                      <div className="bg-white border border-slate-200 rounded-lg p-2 sm:p-3">
                                        <code className="text-orange-500 text-[10px] sm:text-xs break-all">{item.activationCode}</code>
                                      </div>
                                    </div>
                                  )}
                                  {item.esimLpaString && (
                                    <div>
                                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{t("orders.lpaString")}</p>
                                      <div className="bg-white border border-slate-200 rounded-lg p-2 sm:p-3">
                                        <code className="text-cyan-500 text-[10px] sm:text-xs break-all">{item.esimLpaString}</code>
                                      </div>
                                    </div>
                                  )}
                                  {item.esimStatus && (
                                    <div className="mt-3 space-y-2">
                                      <div className="flex items-center justify-between">
                                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">{t("orders.status")}</p>
                                        {(() => {
                                          const status = getEsimStatusLabel(item);
                                          return (
                                            <span className={"text-xs font-medium px-2 py-0.5 rounded-full " + status.color}>
                                              {status.label}
                                            </span>
                                          );
                                        })()}
                                      </div>
                                      {item.enabledAt && (
                                        <p className="text-[10px] text-green-400/70">✓ Enabled on {new Date(item.enabledAt).toLocaleString()}</p>
                                      )}
                                      {item.orderUsage !== null && item.orderUsage !== undefined && (
                                        <div>
                                          <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                                            <span>Data: {((item.orderUsage || 0) / 1024 / 1024 / 1024).toFixed(2)} GB / {((item.totalVolume || 0) / 1024 / 1024 / 1024).toFixed(2)} GB</span>
                                            <span>{Math.round((item.orderUsage || 0) / (item.totalVolume || 1) * 100)}%</span>
                                          </div>
                                            <div className="w-full bg-slate-200 rounded-full h-2">
                                              <div className="bg-orange-500 h-2 rounded-full" style={{ width: Math.min(100, (item.orderUsage || 0) / (item.totalVolume || 1) * 100) + "%" }} />
                                            </div>
                                        </div>
                                      )}
                                      
                                      {/* Top-up button - check plan supportTopUpType */}
                                      {item.esimIccid && (item as { plan?: { supportTopUpType?: number } }).plan && (
                                        (() => {
                                          const plan = (item as { plan?: { supportTopUpType?: number } }).plan;
                                          if (plan?.supportTopUpType === 2 || plan?.supportTopUpType === 3) {
                                            return (
                                              <Link href={`/${locale}/topup?iccid=${item.esimIccid}`}>
                                                <button className="mt-3 w-full bg-green-600 hover:bg-green-500 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors">
                                                  {plan.supportTopUpType === 3 ? "↻ Extend Days" : "+ Top-up Data"}
                                                </button>
                                              </Link>
                                            );
                                          }
                                          if (plan?.supportTopUpType === 1) {
                                            return (
                                              <div className="mt-3 text-center">
                                                <span className="text-slate-400 text-xs">{t("orders.topUpNotAvailable")}</span>
                                              </div>
                                            );
                                          }
                                          return null;
                                        })()
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-6">
                                <div className="animate-spin w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full mx-auto mb-2" />
                                <p className="text-slate-500 text-xs">{t("orders.processing")}</p>
                              </div>
                            )}
                          </div>
                        ))}

                        {/* Payment info */}
                        <div className="bg-slate-50/80 rounded-xl p-3 sm:p-4">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-xs">
                            <div><p className="text-slate-500">{t("orders.amount")}</p><p className="text-slate-800 font-semibold">{formatPrice(order.totalAmount)}</p></div>
                            <div><p className="text-slate-500">{t("orders.payment")}</p><p className={order.status === "completed" ? "text-green-600" : "text-yellow-600"}>{order.status === "completed" ? "✅ Paid" : order.status}</p></div>
                            <div><p className="text-slate-500">{t("orders.esim")}</p>
                              {(() => {
                                const labels = order.orderItems.map(i => getEsimStatusLabel(i).label);
                                // Show status with correct priority (new orders should show Ready to Scan first)
                                const label = labels.includes("In Use") ? "✅ In Use" :
                                         labels.includes("Ready to Scan") ? "📱 Ready to Scan" :
                                         labels.includes("Activating") ? "⏳ Activating" :
                                         labels.includes("Installing") ? "⏳ Installing" :
                                         labels.includes("Downloading") ? "⏳ Downloading" :
                                         labels.includes("Issued") ? "📨 Issued" :
                                         "⏳ Processing";
                                const color = labels.includes("In Use") ? "text-green-600" :
                                          labels.includes("Ready to Scan") ? "text-blue-600" :
                                          labels.includes("Depleted") || labels.includes("Expired") ? "text-red-600" :
                                          "text-yellow-600";
                                return <p className={color}>{label}</p>;
                              })()}
                            </div>
                            {order.esimaccessOrderId && (
                              <div><p className="text-slate-500">{t("orders.orderId")}</p><p className="text-slate-600 font-mono text-[10px] truncate">{order.esimaccessOrderId}</p></div>
                            )}
                          </div>
                          {order.status === "pending" && (
                            (() => {
                              const firstItem = order.orderItems[0];
                              const planId = firstItem?.planId || '';
                              const isTopup = order.isTopupMode && order.selectedDuration && order.selectedDuration > (firstItem?.basePlanDays || 0);
                              const days = order.selectedDuration || '';
                              const topupPkgCode = order.topupPackageCode || '';
                              const query = new URLSearchParams({
                                planId,
                                ...(isTopup && { mode: 'topup', days: String(days) }),
                                ...(topupPkgCode && { topupId: topupPkgCode })
                              });
                              return (
                                <button
                                  onClick={() => window.location.href = `/checkout?${query.toString()}`}
                                  className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 9l3 3-3 3m0 0l-3-3 3-3" />
                                  </svg>
                                  {t("orders.payNow")}
                                </button>
                              );
                            })()
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}