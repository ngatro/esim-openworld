"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useI18n } from "@/components/providers/I18nProvider";
import Image from "next/image";

interface Plan {
  id: string;
  name: string;
  destination: string;
  locationCode: string | null;
  dataAmount: number;
  durationDays: number;
  priceUsd: number;
  retailPriceUsd: number;
  coverageCount: number;
  speed: string | null;
  networkType: string | null;
  locationLogo: string | null;
  region: { id: string; name: string; emoji: string } | null;
  country: { id: string; name: string; emoji: string } | null;
}

interface TopupPackage {
  id: number;
  planId: string;
  packageCode: string;
  name: string | null;
  priceUsd: number;
  retailPriceUsd: number;
  isFlexible: boolean;
}

type PaymentMethod = "paypal" ;

import { convertFromUSD } from "@/lib/currency";

export default function CheckoutPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, formatPrice, currency, rates, locale } = useI18n();
  const planId = searchParams.get("planId") || "";

  const [plan, setPlan] = useState<Plan | null>(null);
  const [topupPackage, setTopupPackage] = useState<TopupPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  // Store the pending orderId from our DB to update later
  const [pendingOrderId, setPendingOrderId] = useState<number | null>(null);
   
  // Topup mode params from URL
  const topupMode = searchParams.get("mode") === "topup";
  const topupDays = parseInt(searchParams.get("days") || "0");
  const topupId = searchParams.get("topupId") || "";
  const [error, setError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("paypal");
   const [success, setSuccess] = useState<{ orderId: number; qrCode?: string; activationCode?: string } | null>(null);
   const [paypalConfigured, setPaypalConfigured] = useState<boolean | null>(null);
   // Track if PayPal return has been processed to avoid duplicate activation
   const [paymentHandled, setPaymentHandled] = useState(false);

  // Check PayPal configuration
  useEffect(() => {
    fetch("/api/payment/paypal?check=config")
      .then(r => r.json())
      .then(data => setPaypalConfigured(data.configured !== false))
      .catch(() => setPaypalConfigured(false));
  }, []);

  // Create pending order when payment cancelled or before PayPal redirect
  async function createPendingOrder(planId: string, qty: number, topupPackageCode?: string): Promise<number | null> {
    if (!planId) return null;
    try {
      // Fetch plan to get its duration (needed for exact plans when plan state may not be loaded)
      const planRes = await fetch(`/api/plans?id=${planId}`);
      const planData = await planRes.json();
      const planInfo = planData.plans?.[0];
      const actualDuration = topupMode && topupDays > 0
        ? topupDays
        : (planInfo?.durationDays || 0);

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{
            planId,
            quantity: qty,
            topupMode,
            days: topupDays,
            topupPackageCode: topupPackageCode || undefined,
          }],
          customerName,
          customerEmail,
          status: "pending",
          isTopupMode: topupMode,
          selectedDuration: actualDuration,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const orderId = data.order?.id;
        if (orderId) {
          setPendingOrderId(orderId);
          // Also store in localStorage as backup
          localStorage.setItem("pending_order_id", String(orderId));
        }
        return orderId || null;
      }
      return null;
    } catch (err) {
      console.error("Failed to create pending order:", err);
      return null;
    }
   }

   // Handle PayPal success redirect
   useEffect(() => {
     const paypalSuccess = searchParams.get("success");
     const paypalOrderId = searchParams.get("token"); // PayPal sends order ID as 'token'
     const cancelled = searchParams.get("cancelled");

     if (cancelled) {
      // Prefer URL parameters (embedded in cancel_url) for reliability
      const urlPlanId = searchParams.get("planId") || planId;
      const urlTopupPackageCode = searchParams.get("topupId"); // packageCode from cancel URL
      const qty = quantity; // current quantity state

      if (urlPlanId) {
        createPendingOrder(urlPlanId, qty, urlTopupPackageCode || undefined).then(orderId => {
          if (orderId) {
            router.replace(`/${locale}/orders?pending=` + orderId);
          } else {
            setError("Payment cancelled - please try again");
          }
        });
      } else {
        // Fallback to localStorage (old method) for backward compatibility
        const savedPlanId = localStorage.getItem("paypal_planId");
        const savedQty = parseInt(localStorage.getItem("paypal_qty") || "1");
        const savedTopupPackageCode = localStorage.getItem("paypal_topupPackageCode");
        if (savedPlanId) {
          createPendingOrder(savedPlanId, savedQty, savedTopupPackageCode || undefined).then(orderId => {
            if (orderId) {
              router.replace(`/${locale}/orders?pending=` + orderId);
            } else {
              setError("Payment cancelled - please try again");
            }
          });
        } else {
          setError("Payment cancelled - please try again");
        }
      }
      return;
    }

     if (paypalSuccess === "true" && paypalOrderId && !paymentHandled) {
       setPaymentHandled(true); // Prevent duplicate calls
      // Get planId from localStorage (saved before redirect) or URL
      const savedPlanId = localStorage.getItem("paypal_planId") || planId;
      const savedQty = parseInt(localStorage.getItem("paypal_qty") || "1");
      // Get top-up data from localStorage
      const savedTopupMode = localStorage.getItem("paypal_topupMode") === "true";
      const savedTopupDays = parseInt(localStorage.getItem("paypal_topupDays") || "0");
      // Get top-up package code from localStorage (if stored)
      const savedTopupPackageCode = localStorage.getItem("paypal_topupPackageCode") || undefined;
      // Get pending orderId from state or localStorage (our DB order to update)
      const savedPendingOrderId = pendingOrderId || (localStorage.getItem("pending_order_id") ? parseInt(localStorage.getItem("pending_order_id")!) : null);

      if (!savedPlanId) {
        setError("Plan ID not found");
        return;
      }

      setProcessing(true);
      // Confirm payment and update/create order - include top-up data, package code, and our pending orderId
      fetch("/api/payment/paypal/webhook", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: paypalOrderId,
          planId: savedPlanId,
          quantity: savedQty,
          isTopupMode: savedTopupMode,
          selectedDuration: savedTopupDays > 0 ? savedTopupDays : undefined,
          topupPackageCode: savedTopupPackageCode,
          // Our internal pending order ID to update instead of create new
          pendingOrderId: savedPendingOrderId,
        }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.order) {
            // Clean up URL to prevent duplicate processing on refresh
            router.replace(`/${locale}/checkout?planId=${planId}`, { scroll: false });
            
            const item = data.order.orderItems?.[0];
            if (data.alreadyProcessed) {
              // Order already processed, redirect to orders
              router.replace(`/${locale}/orders`);
              return;
            }
            setSuccess({
              orderId: data.order.id,
              qrCode: item?.esimQrCode || item?.esimQrImage || data.esim?.qrcodeUrl,
              activationCode: item?.activationCode || data.esim?.activationCode,
            });
            // Clean up localStorage
            localStorage.removeItem("paypal_planId");
            localStorage.removeItem("paypal_qty");
            localStorage.removeItem("paypal_topupMode");
            localStorage.removeItem("paypal_topupDays");
            localStorage.removeItem("paypal_topupPackageCode");
            localStorage.removeItem("pending_order_id");
          } else {
            setError(data.error || "Payment confirmation failed");
            setPaymentHandled(false); // Allow retry
          }
        })
        .catch((err) => setError(`Payment confirmation failed: ${err}`))
        .finally(() => setProcessing(false));
    }
  }, [searchParams, planId]);

  useEffect(() => {
   if (planId) {
     fetch(`/api/plans?id=${planId}`)
       .then((r) => r.json())
       .then((data) => {
         const found = (data.plans || []).find((p: Plan) => p.id === planId);
         setPlan(found || null);
         
         // If topup mode, fetch the topup package - use topupId if provided
         if (found && topupMode) {
           // DEBUG: Log what we're searching for
           console.log('[Checkout] FetchTopup:', { planId, topupId, topupIdType: typeof topupId });
           
           // Determine fetch strategy based on topupId type
           const isNumericId = /^\d+$/.test(topupId);
           
           if (topupId && isNumericId) {
             // Modal flow: topupId is numeric DB ID, fetch that specific package directly (may belong to any plan)
             fetch(`/api/topup-packages?topupId=${topupId}`)
               .then((r) => r.json())
               .then((pkgData) => {
                 if (pkgData.packages && pkgData.packages.length > 0) {
                   const selectedPkg = pkgData.packages[0];
                   // Fallback: if retailPriceUsd is 0, use priceUsd
                   if (!selectedPkg.retailPriceUsd && selectedPkg.priceUsd) {
                     selectedPkg.retailPriceUsd = selectedPkg.priceUsd;
                   }
                   console.log('[Checkout] SelectedPkg (by ID):', selectedPkg);
                   setTopupPackage(selectedPkg);
                 } else {
                   console.log('[Checkout] Package not found by ID, falling back to plan packages');
                   // Fallback to plan-based fetch
                   return fetch(`/api/topup-packages?planIds=${planId}`);
                 }
               })
               .then(fetchPlanPkgs => {
                 if (fetchPlanPkgs) {
                   return fetchPlanPkgs.json().then(pkgData => {
                     if (pkgData.packages && pkgData.packages.length > 0) {
                       let selectedPkg = pkgData.packages[0];
                       // Try match by packageCode as fallback
                       if (topupId) {
                         const codeMatch = pkgData.packages.find((p: TopupPackage) => p.packageCode === topupId);
                         if (codeMatch) selectedPkg = codeMatch;
                       } else {
                         const flexiblePkg = pkgData.packages.find((p: TopupPackage) => p.isFlexible);
                         selectedPkg = flexiblePkg || selectedPkg;
                       }
                       if (!selectedPkg.retailPriceUsd && selectedPkg.priceUsd) {
                         selectedPkg.retailPriceUsd = selectedPkg.priceUsd;
                       }
                       console.log('[Checkout] SelectedPkg (plan fallback):', selectedPkg);
                       setTopupPackage(selectedPkg);
                     } else {
                       setTopupPackage(null);
                     }
                   });
                 }
               })
               .catch(() => setTopupPackage(null));
           } else {
             // Orders page flow or no specific package: topupId is a packageCode (string)
             // First try direct fetch by packageCode (handles packages not linked to plan)
             fetch(`/api/topup-packages?packageCode=${encodeURIComponent(topupId)}`)
               .then((r) => r.json())
               .then((pkgData) => {
                 if (pkgData.packages && pkgData.packages.length > 0) {
                   const selectedPkg = pkgData.packages[0];
                   if (!selectedPkg.retailPriceUsd && selectedPkg.priceUsd) {
                     selectedPkg.retailPriceUsd = selectedPkg.priceUsd;
                   }
                   console.log('[Checkout] SelectedPkg (by code):', selectedPkg);
                   setTopupPackage(selectedPkg);
                   return;
                 }
                 // If not found by code, fallback to plan-based fetch
                 return fetch(`/api/topup-packages?planIds=${planId}`).then(r => r.json()).then(pkgData => {
                   if (pkgData.packages && pkgData.packages.length > 0) {
                     let selectedPkg = pkgData.packages[0];
                     // Try match by packageCode as fallback
                     const codeMatch = pkgData.packages.find((p: TopupPackage) => p.packageCode === topupId);
                     if (codeMatch) selectedPkg = codeMatch;
                     // Fallback: if retailPriceUsd is 0, use priceUsd
                     if (!selectedPkg.retailPriceUsd && selectedPkg.priceUsd) {
                       selectedPkg.retailPriceUsd = selectedPkg.priceUsd;
                     }
                     console.log('[Checkout] SelectedPkg (plan fallback):', selectedPkg);
                     setTopupPackage(selectedPkg);
                   } else {
                     console.log('[Checkout] NoTopupPackages for plan:', planId);
                     setTopupPackage(null);
                   }
                 });
               })
               .catch(() => setTopupPackage(null));
           }
         }
       })
       .catch(() => setPlan(null))
       .finally(() => setLoading(false));
   } else {
     setLoading(false);
   }
 }, [planId, topupMode]);

  useEffect(() => {
    if (user) {
      setCustomerName(user.name || "");
      setCustomerEmail(user.email || "");
    }
  }, [user]);

  async function handlePayPal() {
    // Calculate unit price (with topup formula if applicable)
    let unitUsd = plan!.retailPriceUsd > 0 ? plan!.retailPriceUsd : plan!.priceUsd;
    if (topupMode && topupDays > 0 && topupPackage) {
      const topupRetail = topupPackage.retailPriceUsd > 0 ? topupPackage.retailPriceUsd : topupPackage.priceUsd;
      const extraDays = Math.max(0, topupDays - plan!.durationDays);
      if (extraDays > 0) {
        unitUsd = unitUsd + (extraDays * topupRetail);
      }
    }
    
    // Get price in display currency - always convert from USD to display currency
    const displayPrice = convertFromUSD(unitUsd || 0, currency, rates);
    const priceDisplay = displayPrice * quantity;
    
    if (!priceDisplay || priceDisplay <= 0) {
      throw new Error("Invalid price");
    }

    // Create pending order BEFORE redirecting to PayPal
    const actualDuration = topupMode && topupDays > 0 ? topupDays : (plan?.durationDays || 0);
    const pendingOrderId = await createPendingOrder(
      plan!.id,
      quantity,
      topupMode && topupPackage ? topupPackage.packageCode : undefined
    );

    if (!pendingOrderId) {
      throw new Error("Failed to create pending order");
    }

     const res = await fetch("/api/payment/paypal", {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({
         planId: plan!.id,
         planName: `${plan!.destination} eSIM`,
         price: priceDisplay,
         currency: currency,
         customerEmail,
         locale: locale,
         // Pass top-up metadata (including package code for cancel/resume)
         customData: {
           isTopupMode: topupMode,
           selectedDuration: topupDays > 0 ? topupDays : undefined,
           topupPackageCode: topupMode && topupPackage ? topupPackage.packageCode : undefined,
         },
       }),
     });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "PayPal failed");

    if (data.approveUrl) {
      // Save planId, quantity, top-up data, and package code before redirecting to PayPal
      localStorage.setItem("paypal_planId", plan!.id);
      localStorage.setItem("paypal_qty", quantity.toString());
      localStorage.setItem("paypal_topupMode", topupMode ? "true" : "false");
      localStorage.setItem("paypal_topupDays", topupDays > 0 ? String(topupDays) : "");
      // Store topupPackageCode for later use (after payment completes)
      if (topupMode && topupPackage) {
        localStorage.setItem("paypal_topupPackageCode", topupPackage.packageCode);
      }
      // Store pending order ID for webhook to update
      localStorage.setItem("pending_order_id", String(pendingOrderId));
      window.location.href = data.approveUrl;
      return;
    }
    throw new Error("No approval URL");
  }
  
   async function handleDirectCheckout() {
     if (!plan) return;
     if (!customerEmail) {
       setError("Email is required to receive your eSIM");
       return;
     }

     setProcessing(true);
     setError("");

     try {
       // Step 1: Create pending order
       const actualDuration = topupMode && topupDays > 0 ? topupDays : (plan?.durationDays || 0);
       const res = await fetch("/api/orders", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
           items: [{
             planId: plan.id,
             quantity,
             topupMode,
             days: topupDays,
             topupPackageCode: topupPackage?.packageCode || undefined,
           }],
           customerName,
           customerEmail,
           isTopupMode: topupMode,
           selectedDuration: actualDuration,
         }),
       });

       const data = await res.json();
       if (!res.ok) {
         setError(data.error || "Order failed");
         return;
       }

       const orderId = data.order?.id;
       if (!orderId) {
         setError("Failed to create order");
         return;
       }

       // Step 2: Activate eSIM immediately (direct checkout = paid in full)
       const activateRes = await fetch(`/api/orders/${orderId}/activate`, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ force: true }),
       });

       const activateData = await activateRes.json();
       if (!activateRes.ok) {
         console.error("[Direct Checkout] Activation failed:", activateData);
         setError(activateData.error || "Failed to activate eSIM");
         return;
       }

       const orderItem = activateData.order?.orderItems?.[0];
       setSuccess({
         orderId: activateData.order.id,
         qrCode: orderItem?.esimQrCode || orderItem?.esimQrImage,
         activationCode: orderItem?.activationCode,
       });
     } catch {
       setError("Something went wrong. Please try again.");
     } finally {
       setProcessing(false);
     }
   }

  async function handleCheckout() {
    if (!plan) return;
    if (!customerEmail) {
      setError("Email is required to receive your eSIM");
      return;
    }

    setProcessing(true);
    setError("");

    try {
      switch (paymentMethod) {
        case "paypal":
          await handlePayPal();
          break;
        // case "lemonsqueezy":
        //   await handleLemonSqueezy();
        //   break;
        // case "gumroad":
        //   await handleGumroad();
        //   break;
        // case "payoneer":
        //   await handlePayoneer();
        //   break;
        default:
          await handleDirectCheckout();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full" />
      </div>
    );
  }
  if (processing && !success) {
  return (
    <div className="min-h-screen bg-orange-50 flex flex-col items-center justify-center text-slate-800 ">
      <div className="animate-spin w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full mb-4" />
      <p className="text-lg font-semibold">Processing your payment...</p>
      <p className="text-sm text-slate-400 mt-2">Please wait, do not close this page</p>
    </div>
  );
}

  if (success) {
    return (
      <div className="min-h-screen bg-orange-50 text-slate-800 py-8 sm:py-12">
        <div className="max-w-lg mx-auto px-4 text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", duration: 0.6 }}>
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </motion.div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">{t("checkout.orderComplete")}!</h1>
          <p className="text-slate-600 mb-6">{t("checkout.order")} #{10000 + success.orderId}</p>

          {success.qrCode && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 mb-6 inline-block shadow-sm">
              <Image 
                src={success.qrCode}
                alt="eSIM QR Code"
                className="w-48 h-48 sm:w-64 sm:h-64 mx-auto"
                width={256} 
                height={256}
              />
            </div>
          )}

          {success.activationCode && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-6">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{t("checkout.activationCode")}</p>
              <code className="text-orange-500 text-xs sm:text-sm break-all">{success.activationCode}</code>
            </div>
          )}

          <p className="text-slate-600 text-sm mb-8">
            {t("checkout.scanQrCode")}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href={`/${locale}/orders`}>
              <button className="w-full sm:w-auto bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold px-6 py-3 rounded-xl transition-colors">
                {t("checkout.viewOrders")}
              </button>
            </Link>
            <Link href={`/${locale}/plans`}>
              <button className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-3 rounded-xl transition-colors">
                {t("checkout.continueBrowsing")}
              </button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!planId || !plan) {
    return (
      <div className="min-h-screen bg-slate-900 text-white py-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-5xl sm:text-6xl mb-4">🛒</p>
          <h1 className="text-2xl sm:text-3xl font-bold mb-3">{t("checkout.selectPlanFirst")}</h1>
          <p className="text-slate-400 mb-6">{t("checkout.browsePlansDesc")}</p>
          <Link href={`/${locale}/plans`}>
            <button className="bg-sky-500 hover:bg-sky-400 text-white font-semibold px-8 py-3 rounded-xl transition-colors">
              {t("checkout.browsePlans")}

            </button>
          </Link>
        </div>
      </div>
    );
  }

  const PAYPAL_SUPPORTED_CURRENCIES = ["AUD", "CAD", "CHF", "EUR", "GBP", "JPY", "NZD", "SEK", "SGD", "USD", "MXN", "BRL", "INR", "KRW"];
const isPayPalSupported = PAYPAL_SUPPORTED_CURRENCIES.includes(currency);

// DEBUG: Log inputs BEFORE calculation
console.log('[Checkout] BeforeCalc:', { topupMode, topupDays, topupDaysType: typeof topupDays, hasTopupPackage: !!topupPackage, planExists: !!plan, planDuration: plan?.durationDays, planPrice: plan?.retailPriceUsd || plan?.priceUsd });

// DEBUG: Log ALL inputs before calculation to identify which is failing
console.log('[Checkout] BEFORE_IF:', {
  topupMode, topupDays, topupDaysType: typeof topupDays,
  hasTopupPackage: !!topupPackage,
  topupPackageId: topupPackage?.id,
  topupPackagePrice: topupPackage?.retailPriceUsd || topupPackage?.priceUsd,
  hasPlan: !!plan,
  planDuration: plan?.durationDays,
  planPrice: plan?.retailPriceUsd || plan?.priceUsd,
  extraDays: plan ? Math.max(0, (topupDays || 0) - plan.durationDays) : 0,
  condition: `${topupMode} && ${topupDays} > 0 && ${!!topupPackage} && ${!!plan}`
});

// Calculate price: Base price + (SelectedDays - BaseDays) * TopupPrice for topup mode
let unitPrice = plan.retailPriceUsd > 0 ? plan.retailPriceUsd : plan.priceUsd;
if (topupMode && topupDays > 0 && topupPackage && plan) {
  const topupRetail = topupPackage.retailPriceUsd > 0 ? topupPackage.retailPriceUsd : topupPackage.priceUsd;
  const extraDays = Math.max(0, topupDays - plan.durationDays); // Ensure non-negative
  console.log("[PriceCalc] Values:", {
    planRetail: plan.retailPriceUsd,
    planPrice: plan.priceUsd,
    topupMode,
    topupDays,
    topupPackage,
    topupRetail,
    extraDays,
    planDuration: plan.durationDays,
    baseUnitPrice: unitPrice
  });
  if (extraDays > 0) {
    unitPrice = unitPrice + (extraDays * topupRetail);
  }
}
const totalPrice = unitPrice * quantity;
// DEBUG: Log final calculation results
console.log('[Checkout] FinalCalc:', { topupMode, unitPrice, totalPrice, quantity });
console.log('plan location:', { locationCode: plan.locationCode });
const isUnlimited = plan.dataAmount >= 999;

  return (
    <div className="min-h-screen bg-orange-50 text-slate-800 py-6 sm:py-12">
      <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8">
        <nav className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 mb-6 sm:mb-8">
          <Link href={`/${locale}`} className="hover:text-orange-600">{t("common.home")}</Link>
          <span>/</span>
          <Link href={`/${locale}/plans`} className="hover:text-orange-600">{t("common.plans")}</Link>
          <span>/</span>
          <span className="text-slate-600">{t("common.checkout")}</span>
        </nav>

        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-6 sm:mb-8">{t("common.checkout")}</h1>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
          <div className="lg:col-span-3 space-y-5">
            {/* Plan Summary */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm">
              <h2 className="text-base sm:text-lg font-semibold text-slate-800 mb-3">{t("checkout.yourEsimPlan")}</h2>
              <div className="flex items-center gap-3 sm:gap-4">
                {plan.locationCode ? (
                  <img src={`https://p.qrsim.net/img/flags/${plan.locationCode?.toLowerCase()}.png`} alt={plan.destination} className="w-10 h-10 sm:w-12 sm:h-12 object-contain" />
                ) : (
                  <span className="text-3xl sm:text-4xl">{plan.country?.emoji || plan.region?.emoji || "🌍"}</span>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-slate-800 font-semibold text-sm sm:text-base truncate">
                    eSIM {plan.destination}
                    {topupMode && topupDays > 0 ? ` x ${topupDays} Days` : ""}
                  </h3>
                  <p className="text-slate-500 text-xs sm:text-sm">
                    {isUnlimited ? "Unlimited" : `${plan.dataAmount}GB`}/{plan.durationDays} days · {plan.speed || "4G LTE"}
                  </p>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-slate-800 flex-shrink-0">{formatPrice(unitPrice)}</p>
              </div>
            </div>

            {/* Contact Info */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm">
              <h2 className="text-base sm:text-lg font-semibold text-slate-800 mb-3">{t("checkout.contactInformation")}</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs sm:text-sm text-slate-600 mb-1.5">{t("checkout.name")}</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Your name"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:border-orange-400 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm text-slate-600 mb-1.5">{t("checkout.email")}</label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:border-orange-400 transition-colors"
                  />
                  <p className="text-slate-400 text-xs mt-1">{t("checkout.emailNote")}</p>
                </div>
              </div>
            </div>

            {/* Quantity */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm">
              <h2 className="text-base sm:text-lg font-semibold text-slate-800 mb-3">{t("checkout.quantity")}</h2>
              <div className="flex items-center gap-4">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-800 font-bold text-lg transition-colors">-</button>
                <span className="text-2xl font-bold text-slate-800 w-12 text-center">{quantity}</span>
                <button onClick={() => setQuantity(Math.min(10, quantity + 1))}
                  className="w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-800 font-bold text-lg transition-colors">+</button>
                <span className="text-slate-500 text-sm">eSIM{quantity > 1 ? "s" : ""}</span>
              </div>
            </div>

            {/* Payment Method */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm">
              <h2 className="text-base sm:text-lg font-semibold text-slate-800 mb-4">{t("checkout.paymentMethod")}</h2>
              <div className="space-y-3">
                {/* PayPal */}
                <button
                  onClick={() => setPaymentMethod("paypal")}
                  disabled={paypalConfigured === false}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all ${
                    paymentMethod === "paypal"
                      ? "bg-orange-50 border-orange-400 ring-1 ring-orange-200"
                      : "bg-white border-slate-200 hover:border-slate-300"
                  } ${paypalConfigured === false ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <div className="w-12 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold">PayPal</span>
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-slate-800 font-medium text-sm">PayPal</p>
                    <p className="text-slate-500 text-xs">Credit Card, Apple Pay, Google Pay</p>
                    {paypalConfigured === false && (
                      <p className="text-red-500 text-xs">Not configured - use direct checkout</p>
                    )}
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    paymentMethod === "paypal" ? "border-orange-500" : "border-slate-300"
                  }`}>
                    {paymentMethod === "paypal" && <div className="w-2.5 h-2.5 bg-orange-500 rounded-full" />}
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-2">
            <motion.div
              className="sticky top-20 sm:top-24 bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-lg"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h2 className="text-base sm:text-lg font-semibold text-slate-800 mb-4 sm:mb-5">{t("checkout.orderSummary")}</h2>

              <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                {/* Regular: show base plan price */}
                {/* Top-up mode: show breakdown */}
                {topupMode && topupDays > 0 ? (
                  <>
                    {/* Extension breakdown for top-up mode */}
                    <div className="flex justify-between text-slate-500 text-xs font-medium">
                      <span>•  {plan.destination}
                        {topupMode && topupDays > 0 ? ` x ${topupDays} Days` : ""}
                      </span>
                      <span className="text-slate-400">{formatPrice(unitPrice)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500 text-xs font-medium">
                      <span>•  Quantity</span>
                      <span className="font-bold text-red-600">
                       {quantity}
                      </span>
                    </div>
                  </>
                ) : (
                  /* Regular: show plain base plan */
                  <div className="flex justify-between text-slate-600 text-sm">
                    <span>{plan.destination} eSIM × {quantity}</span>
                    <span>{formatPrice((plan.retailPriceUsd && plan.retailPriceUsd > 0 ? plan.retailPriceUsd : plan.priceUsd) * quantity)}</span>
                  </div>
                )}
                
                <div className="flex justify-between text-slate-600 text-sm">
                  <span>{t("checkout.activation")}</span>
                  <span className="text-green-600">{t("checkout.free")}</span>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-3 sm:pt-4 mb-4 sm:mb-6">
                <div className="flex justify-between">
                  <span className="text-base sm:text-lg font-semibold text-slate-800">{t("checkout.total")}</span>
                  <span className="text-xl sm:text-2xl font-bold text-slate-800">{formatPrice(totalPrice)}</span>
                </div>
                {!isPayPalSupported && rates[currency] && (
                  <div className="mt-2 text-xs sm:text-sm text-slate-500 text-right">
                    ≈ ${totalPrice.toFixed(2)} USD
                  </div>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              <motion.button
                onClick={handleCheckout}
                disabled={processing}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-semibold py-3 sm:py-4 rounded-xl text-base sm:text-lg transition-all shadow-lg"
                whileHover={!processing ? { scale: 1.02 } : {}}
                whileTap={!processing ? { scale: 0.98 } : {}}
              >
                {processing ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                    {t("checkout.processing")}
                  </span>
                ) : (
                  `${t("checkout.pay")} ${formatPrice(totalPrice)}`
                )}
              </motion.button>

              <div className="mt-4 sm:mt-5 space-y-2">
                {[
                  `${t("checkout.instantQrCodeDelivery")}`,
                  `${t("checkout.securePayment")}`,
                  `${t("checkout.moneyBackGuarantee")}`,
                ].map((text) => (
                  <div key={text} className="flex items-center gap-2 text-xs text-slate-500">
                    <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {text}
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-center gap-3">
                <div className="flex items-center gap-1 text-green-500 text-[10px]">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                  {t("checkout.sslEncrypted")}
                </div>
                <div className="flex items-center gap-1 text-green-500 text-[10px]">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                  {t("checkout.verified")}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}