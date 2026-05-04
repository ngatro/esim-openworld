import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

const PAYPAL_API = process.env.PAYPAL_SANDBOX === "true"
  ? "https://api-m.sandbox.paypal.com"
  : "https://api-m.paypal.com";

const PAYPAL_SUPPORTED_CURRENCIES = ["AUD", "CAD", "CHF", "EUR", "GBP", "JPY", "NZD", "SEK", "SGD", "USD", "MXN", "BRL", "INR", "KRW"];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const check = url.searchParams.get("check");
  
  if (check === "config") {
    const configured = !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
    return NextResponse.json({ configured });
  }
  
  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}

async function getSettings() {
  try {
    const data = await readFile(join(process.cwd(), "data", "settings.json"), "utf-8");
    return JSON.parse(data);
  } catch {
    return { currencyRates: { EUR: 0.92, VND: 24500, GBP: 0.79, JPY: 150 } };
  }
}

function convertToUSD(amount: number, currency: string, rates: Record<string, number>): number {
  if (currency === "USD") return amount;
  
  const rate = rates[currency];
  if (!rate) return amount;
  
  // Convert from local currency to USD
  return amount / rate;
}

async function getAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("PayPal not configured - set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET");
  }

  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayPal auth failed: ${err}`);
  }

  const data = await res.json();
  return data.access_token;
}

export async function POST(request: Request) {
  try {
    const { planId, planName, price, currency = "USD", customerEmail, isTopUp, orderItemId, packageCode, periodNum, customData, locale } = await request.json();

    if (!locale) {
      return NextResponse.json({ error: "Locale is required" }, { status: 400 });
    }

    if (!price || price <= 0) {
      return NextResponse.json({ error: "Invalid price" }, { status: 400 });
    }

    // Get settings for exchange rates
    const settings = await getSettings();
    const rates = settings.currencyRates || { EUR: 0.92, VND: 24500, GBP: 0.79, JPY: 150 };

    // Determine PayPal currency - convert if not supported
    let paypalCurrency = currency.toUpperCase();
    let paypalAmount = price;

    if (!PAYPAL_SUPPORTED_CURRENCIES.includes(paypalCurrency)) {
      // Currency not supported by PayPal - convert to USD
      paypalCurrency = "USD";
      paypalAmount = convertToUSD(price, currency.toUpperCase(), rates);
    }

    const token = await getAccessToken();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Build return URL based on whether it's a top-up or new order
    let returnUrl = `${appUrl}/${locale}/checkout?success=true&planId=${planId}`;
    if (isTopUp) {
      returnUrl = `${appUrl}/${locale}/topup?success=true&orderItemId=${orderItemId}&packageCode=${packageCode || ""}`;
    }

    // Build cancel URL with necessary metadata to resume order without localStorage
    let cancelUrl = `${appUrl}/${locale}/checkout?cancelled=true&planId=${planId}`;
    if (customData?.isTopupMode) {
      cancelUrl += `&mode=topup&days=${customData.selectedDuration || ''}`;
      if (customData.topupPackageCode) {
        cancelUrl += `&topupId=${encodeURIComponent(customData.topupPackageCode)}`;
      }
    }

    // Build custom_id with top-up metadata if provided
    let customIdData: Record<string, unknown> = { planId, planName, email: customerEmail, isTopUp, orderItemId, packageCode, periodNum };
    if (customData) {
      customIdData = { ...customIdData, ...customData };
    }

    const res = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: planId,
            description: `OW SIM eSIM: ${planName}`,
            amount: {
              currency_code: paypalCurrency,
              value: paypalAmount.toFixed(2),
            },
            custom_id: JSON.stringify(customIdData),
          },
        ],
        application_context: {
          brand_name: "OW SIM",
          landing_page: "BILLING",
          shipping_preference: "NO_SHIPPING",
          user_action: "PAY_NOW",
          return_url: returnUrl,
          cancel_url: cancelUrl,
        },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("PayPal create order error:", data);
      return NextResponse.json({ error: data.message || data.details?.[0]?.description || "PayPal failed" }, { status: 500 });
    }

    const approveLink = data.links?.find((l: { rel: string }) => l.rel === "approve");

    return NextResponse.json({
      orderId: data.id,
      approveUrl: approveLink?.href,
      status: data.status,
    });
  } catch (error) {
    console.error("PayPal error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { orderId } = await request.json();
    const token = await getAccessToken();

    const res = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: data.message || "Capture failed" }, { status: 500 });
    }

    return NextResponse.json({
      status: data.status,
      captureId: data.purchase_units?.[0]?.payments?.captures?.[0]?.id,
    });
  } catch (error) {
    console.error("PayPal capture error:", error);
    return NextResponse.json({ error: "Capture failed" }, { status: 500 });
  }
}