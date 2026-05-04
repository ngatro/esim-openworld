"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { convertFromUSD } from "@/lib/currency";

interface TopUpPackage {
  packageCode: string;
  name: string;
  priceUSD: number;
  volume: number;
  duration: number;
  isFlexible?: boolean; // For flexible packages that can extend custom days
}

interface CurrentPlan {
  planName: string;
  iccid: string;
  esimStatus: string;
  totalVolume: number;
  orderUsage: number;
  orderItemId: number;
  supportTopUpType: number;
  durationDays?: number; // Current plan's duration
}

interface CurrentPlan {
  planName: string;
  iccid: string;
  esimStatus: string;
  totalVolume: number;
  orderUsage: number;
  orderItemId: number;
  supportTopUpType: number;
}

export default function TopUpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { formatPrice, t, currency, rates, locale } = useI18n();
  
  const initialIccid = searchParams.get("iccid") || "";
  const successParam = searchParams.get("success");
  const orderItemIdParam = searchParams.get("orderItemId");
  const packageCodeParam = searchParams.get("packageCode");
  const cancelled = searchParams.get("cancelled");
  
  const [iccid, setIccid] = useState(initialIccid);
  const [packages, setPackages] = useState<TopUpPackage[]>([]);
  const [currentPlan, setCurrentPlan] = useState<CurrentPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<TopUpPackage | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"paypal" | "lemonsqueezy" | "gumroad">("paypal");
  
  // For flexible top-up (supportTopUpType=3): custom day selection
  const [customDays, setCustomDays] = useState<number>(1); // Default 1 extra day
  const maxExtraDays = 30; // Max 30 extra days

  // Calculate price for custom flexible days (rate = price per day)
  const customDayPrice = selectedPackage?.priceUSD || 0;

  const PAYPAL_SUPPORTED_CURRENCIES = ["AUD", "CAD", "CHF", "EUR", "GBP", "JPY", "NZD", "SEK", "SGD", "USD", "MXN", "BRL", "INR", "KRW"];
  const isPayPalSupported = PAYPAL_SUPPORTED_CURRENCIES.includes(currency);

  // Handle PayPal success redirect
  useEffect(() => {
    if (successParam === "true" && orderItemIdParam && packageCodeParam) {
      const doTopUp = async () => {
        setProcessing(true);
        try {
          const res = await fetch("/api/topup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderItemId: parseInt(orderItemIdParam),
              packageCode: packageCodeParam,
            }),
          });
          const data = await res.json();
          if (data.success) {
            setSuccess(true);
          } else {
            setError(data.error || "Top-up failed");
          }
        } catch (err) {
          setError("Top-up request failed");
        } finally {
          setProcessing(false);
        }
      };
      doTopUp();
    }
    
    if (cancelled) {
      setError("Payment was cancelled");
    }
  }, [successParam, orderItemIdParam, packageCodeParam, cancelled]);

  async function handleTopUp() {
    if (!selectedPackage || !currentPlan) return;
    setProcessing(true);
    
    // Calculate number of extra days - use customDays for flexible packages
    const extraDays = selectedPackage.isFlexible ? customDays : selectedPackage.duration;
    
    try {
      if (paymentMethod === "paypal") {
        // Get price in display currency - always convert from USD to display currency
        const priceDisplay = convertFromUSD(selectedPackage.priceUSD || 0, currency, rates);
        
         const paypalRes = await fetch("/api/payment/paypal", {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({
             planId: `topup-${selectedPackage.packageCode}`,
             planName: `Top-up: ${selectedPackage.name}`,
             price: priceDisplay,
             currency: currency,
             customerEmail: "", // Will be filled from user session
             isTopUp: true,
             orderItemId: currentPlan.orderItemId,
             packageCode: selectedPackage.packageCode,
             // Pass custom periodNum for flexible top-up
             periodNum: currentPlan.supportTopUpType === 3 ? extraDays.toString() : undefined,
             locale: locale,
           }),
         });
        
        const paypalData = await paypalRes.json();
        if (!paypalRes.ok) throw new Error(paypalData.error || "PayPal failed");
        
        if (paypalData.approveUrl) {
          localStorage.setItem("topup_orderItemId", currentPlan.orderItemId.toString());
          localStorage.setItem("topup_packageCode", selectedPackage.packageCode);
          localStorage.setItem("topup_periodNum", currentPlan.supportTopUpType === 3 ? selectedPackage.duration.toString() : "");
          window.location.href = paypalData.approveUrl;
          return;
        }
      } else if (paymentMethod === "lemonsqueezy") {
        const lsRes = await fetch("/api/payment/lemonsqueezy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planId: `topup-${selectedPackage.packageCode}`,
            planName: `Top-up: ${selectedPackage.name}`,
            price: selectedPackage.priceUSD,
            customerEmail: "",
            isTopUp: true,
            orderItemId: currentPlan.orderItemId,
            packageCode: selectedPackage.packageCode,
          }),
        });
        
        const lsData = await lsRes.json();
        if (!lsRes.ok) throw new Error(lsData.error || "LemonSqueezy failed");
        
        if (lsData.checkoutUrl) {
          window.location.href = lsData.checkoutUrl;
          return;
        }
      } else {
        // Gumroad - open in new tab
        const gumroadRes = await fetch("/api/payment/gumroad", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planId: `topup-${selectedPackage.packageCode}`,
            planName: `Top-up: ${selectedPackage.name}`,
            price: selectedPackage.priceUSD,
            customerEmail: "",
          }),
        });
        
        const gumroadData = await gumroadRes.json();
        if (!gumroadRes.ok) throw new Error(gumroadData.error || "Gumroad failed");
        
        if (gumroadData.checkoutUrl) {
          window.open(gumroadData.checkoutUrl, "_blank");
          return;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
      setProcessing(false);
    }
  }

  async function fetchPackages() {
    if (iccid.length < 19) {
      setPackages([]);
      setCurrentPlan(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/topup?iccid=${encodeURIComponent(iccid)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to fetch top-up packages");
        setPackages([]);
        setCurrentPlan(null);
      } else if (data.error) {
        setError(data.error);
        setPackages([]);
        setCurrentPlan(null);
      } else {
        setPackages(data.topUpPackages || []);
        setCurrentPlan(data.currentPlan);
        setError("");
      }
    } catch (err) {
      setError("Failed to fetch top-up packages");
      setPackages([]);
      setCurrentPlan(null);
    } finally {
      setLoading(false);
    }
  }

  function formatData(volume: number): string {
    if (volume >= 999000) return "Unlimited";
    if (volume < 1000) return `${volume}MB`;
    return `${Math.round(volume / 1000)}GB`;
  }

  if (success) {
    return (
      <div className="min-h-screen bg-orange-50 text-slate-800">
        <main className="pt-20 sm:pt-28 pb-16 sm:pb-24">
          <div className="max-w-lg mx-auto px-3 sm:px-6 text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">✓</span>
            </motion.div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-4">Top-up Successful!</h1>
            <p className="text-slate-600 mb-8">Your eSIM data has been extended. A new QR code has been sent to your email.</p>
            <div className="flex gap-4 justify-center">
              <Link href={`/${locale}/orders`}>
                <button className="w-full sm:w-auto bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold px-6 py-3 rounded-xl transition-colors">
                  {t("common.viewOrders")}
                </button>
              </Link>
              <Link href={`/${locale}/plans`}>
                <button className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-3 rounded-xl transition-colors">
                  {t("common.browsePlans")}
                </button>
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-orange-50 text-slate-800">
      <main className="pt-20 sm:pt-28 pb-16 sm:pb-24">
        <div className="max-w-2xl mx-auto px-3 sm:px-6">
          
          <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-4xl font-bold mb-3">Top-up Your eSIM</h1>
            <p className="text-slate-600">Enter your ICCID to see available top-up packages</p>
          </div>

          {/* ICCID Input */}
          <div className="bg-white/80 border border-slate-200 rounded-2xl p-5 mb-6">
            <label className="block text-sm text-slate-600 mb-2">Your eSIM ICCID</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={iccid}
                onChange={(e) => setIccid(e.target.value.replace(/\D/g, ""))}
                placeholder="Enter 19-20 digit ICCID"
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-mono text-sm focus:outline-none focus:border-orange-500"
              />
              <button
                onClick={fetchPackages}
                disabled={iccid.length < 19 || loading}
                className="bg-orange-500 hover:bg-orange-400 disabled:bg-slate-300 text-white font-semibold px-4 py-3 rounded-xl transition-colors"
              >
                {loading ? (
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  "Search"
                )}
              </button>
            </div>
            <p className="text-slate-500 text-xs mt-2">Find ICCID in your order confirmation email or in Settings → Cellular</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Current Plan Info */}
          {currentPlan && (
            <div className="bg-white/80 border border-slate-200 rounded-2xl p-5 mb-6">
              <h3 className="text-slate-800 font-semibold mb-3">Current Plan</h3>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">ICCID</span>
                <span className="text-orange-500 font-mono">{currentPlan.iccid}</span>
              </div>
              {currentPlan.totalVolume > 0 && (
                <div className="mt-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600">Data Used</span>
                    <span className="text-slate-800">{formatData(currentPlan.orderUsage)} / {formatData(currentPlan.totalVolume)}</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div className="bg-orange-500 h-2 rounded-full" style={{ width: `${Math.min(100, (currentPlan.orderUsage / currentPlan.totalVolume) * 100)}%` }} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Top-up Packages */}
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full mx-auto" />
            </div>
          ) : packages.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-slate-800 font-semibold mb-4">Select Top-up Package</h3>
              {packages.map((pkg) => (
                <motion.button
                  key={pkg.packageCode}
                  onClick={() => {
                    setSelectedPackage(pkg);
                    // Reset custom days when switching to a new package
                    if (pkg.isFlexible) {
                      setCustomDays(1);
                    }
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`w-full p-5 rounded-2xl border text-left transition-all ${
                    selectedPackage?.packageCode === pkg.packageCode
                      ? "bg-orange-500/20 border-orange-500/50"
                      : "bg-white/80 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-slate-800 font-semibold">{formatData(pkg.volume)}</p>
                      <p className="text-slate-600 text-sm">
                        {pkg.isFlexible ? "Flexible - choose days" : `${pkg.duration} days validity`}
                      </p>
                    </div>
                    <p className="text-xl font-bold text-orange-500">
                      {formatPrice(pkg.priceUSD)}
                    </p>
                  </div>
                  {/* Day selector for flexible packages */}
                  {pkg.isFlexible && selectedPackage?.packageCode === pkg.packageCode && currentPlan?.supportTopUpType === 3 && (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <label className="block text-xs text-slate-600 mb-2">
                        Extra days to add (1-{maxExtraDays}):
                      </label>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCustomDays(Math.max(1, customDays - 1));
                          }}
                          className="w-8 h-8 rounded-lg bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-sm font-bold"
                        >
                          -
                        </button>
                        <span className="flex-1 text-center font-semibold text-lg">
                          {customDays} day{customDays !== 1 ? "s" : ""}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCustomDays(Math.min(maxExtraDays, customDays + 1));
                          }}
                          className="w-8 h-8 rounded-lg bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-sm font-bold"
                        >
                          +
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 text-center">
                        = {formatPrice(pkg.priceUSD * customDays)} for {customDays} extra days
                      </p>
                    </div>
                  )}
                </motion.button>
              ))}

              {/* Payment Method Selection */}
              <div className="mt-4">
                <p className="text-sm text-slate-600 mb-2">Payment Method</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPaymentMethod("paypal")}
                    className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                      paymentMethod === "paypal" ? "bg-blue-50 border-blue-500 text-blue-700" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    PayPal
                  </button>
                  <button
                    onClick={() => setPaymentMethod("lemonsqueezy")}
                    className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                      paymentMethod === "lemonsqueezy" ? "bg-yellow-50 border-yellow-500 text-yellow-700" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    Card
                  </button>
                  <button
                    onClick={() => setPaymentMethod("gumroad")}
                    className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                      paymentMethod === "gumroad" ? "bg-pink-50 border-pink-500 text-pink-700" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    Gumroad
                  </button>
                </div>
              </div>

              <button
                onClick={handleTopUp}
                disabled={!selectedPackage || processing}
                className="w-full bg-orange-500 hover:bg-orange-400 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl mt-4 transition-colors flex items-center justify-center gap-2"
              >
                {processing ? (
                  <>
                    <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                    Processing...
                  </>
                ) : selectedPackage ? (
                    `Pay ${selectedPackage.isFlexible ? formatPrice(selectedPackage.priceUSD * customDays) : formatPrice(selectedPackage.priceUSD)}`
                  ) : (
                  "Select a package"
                )}
              </button>
              {paymentMethod === "paypal" && selectedPackage && !isPayPalSupported && (
                <p className="text-xs text-slate-500 text-center mt-2">
                  ≈ ${selectedPackage.priceUSD.toFixed(2)} USD
                </p>
              )}
            </div>
          ) : !loading && !error && iccid.length >= 19 ? (
            <div className="text-center py-8 text-slate-600">
              No top-up packages found for this ICCID
            </div>
          ) : null}

          <div className="mt-8 text-center">
            <Link href={`/${locale}/orders`} className="text-orange-500 hover:text-orange-400 text-sm">
              {t("common.viewOrders")}
            </Link>
          </div>

        </div>
      </main>
    </div>
  );
}
