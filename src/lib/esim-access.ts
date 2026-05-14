import HmacSHA256 from "crypto-js/hmac-sha256";
import Hex from "crypto-js/enc-hex";
import { v4 as uuidv4 } from "uuid";

const BASE_URL = "https://api.esimaccess.com/api/v1/open";

interface LocationNetwork {
  locationCode: string;
  locationLogo: string;
  locationName: string;
  operatorList: {
    networkType: string;
    operatorName: string;
  }[];
}

interface EsimPackage {
  name: string;
  slug: string;
  price: number;
  speed: string;
  volume: number;
  dataType: number;
  duration: number;
  favorite: boolean;
  ipExport: string;
  location: string;
  fupPolicy: string;
  smsStatus: number;
  activeType: number;
  description: string;
  packageCode: string;
  retailPrice: number;
  currencyCode: string;
  durationUnit: string;
  locationCode: string;
  locationLogo?: string;
  unusedValidTime: number;
  supportTopUpType: number;
  locationNetworkList: LocationNetwork[];
}

interface EsimAccessResponse {
  success: boolean;
  message?: string;
  obj?: unknown;
}

interface PackageListObj {
  packageList: EsimPackage[];
  total: number;
}

interface BalanceObj {
  balance: number;
  currency: string;
}

interface OrderObj {
  orderNo: string;
  orderStatus: string;
  iccid: string;
  eid?: string;
  tranNo?: string;
  qrcode: string;
  qrCode?: string;
  qrcodeUrl?: string;
  qrCodeUrl?: string;
  lpaString?: string;
  ac?: string;
  activationCode: string;
  packageName: string;
  price: number;
  esimStatus?: string;
  orderUsage?: number;
  totalVolume?: number;
  smdpStatus?: string;
}

interface EsimListItem {
  orderNo?: string;
  orderStatus?: string;
  iccid?: string;
  eid?: string;
  esimTranNo?: string;
  tranNo?: string;
  qrCode?: string;
  qrCodeUrl?: string;
  qrcodeUrl?: string;
  lpaString?: string;
  ac?: string;
  activationCode?: string;
  smdpAddress?: string;
  smdpStatus?: string;
  totalVolume?: number;
  totalDuration?: number;
  orderUsage?: number;
  esimStatus?: string;
  expiredTime?: string;
}

function getAccessCode(): string {
  const code = process.env.ESIM_ACCESS_ACCESS_CODE;
  if (!code) throw new Error("ESIM_ACCESS_ACCESS_CODE not set");
  return code;
}

function getSecretKey(): string {
  const key = process.env.ESIM_ACCESS_SECRET_KEY;
  if (!key) throw new Error("ESIM_ACCESS_SECRET_KEY not set");
  return key;
}

// Generate HMAC-SHA256 signature
// signData = Timestamp + RequestID + AccessCode + JSON.stringify(RequestBody)
// signature = HMAC-SHA256(signData, SecretKey) as HexString (lowercase)
function generateSignature(timestamp: string, requestId: string, accessCode: string, body: string): string {
  const secretKey = getSecretKey();
  const signData = timestamp + requestId + accessCode + body;
  return HmacSHA256(signData, secretKey).toString(Hex).toLowerCase();
}

async function esimAccessPost(endpoint: string, body: Record<string, unknown> = {}): Promise<EsimAccessResponse> {
  const url = `${BASE_URL}${endpoint}`;
  const accessCode = getAccessCode();
  const timestamp = Date.now().toString();
  const requestId = uuidv4();
  const bodyStr = JSON.stringify(body).replace(/\s+/g, "");

  // Generate HMAC-SHA256 signature
  const signature = generateSignature(timestamp, requestId, accessCode, bodyStr);

  console.log(`[eSIM API] ${endpoint} REQUEST:`, {
    url,
    timestamp,
    requestId,
    body: body,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "RT-AccessCode": accessCode,
      "RT-Timestamp": timestamp,
      "RT-RequestID": requestId,
      "RT-Signature": signature,
    },
    body: bodyStr,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[eSIM API] ${endpoint} ERROR ${res.status}:`, {
      status: res.status,
      response: text,
      request: body,
    });
    throw new Error(`eSIM Access API: ${res.status} ${text}`);
  }

  const json = await res.json() as EsimAccessResponse;
  console.log(`[eSIM API] ${endpoint} RESPONSE:`, {
    success: json.success,
    message: json.message,
    obj: json.obj,
  });
  
  return json;
}

export async function getBalance(): Promise<BalanceObj> {
  const res = await esimAccessPost("/balance/query");
  if (!res.success) throw new Error(res.message || "Failed to get balance");
  // Response format: { success: true, obj: { balance: "100.00", currency: "USD" } }
  if (res.obj && typeof res.obj === "object" && "balance" in res.obj) {
    return res.obj as BalanceObj;
  }
  // Fallback: try to find balance in response directly
  return { balance: 0, currency: "USD" };
}

export async function getPackageList(params: {
  locationCode?: string;
  type?: "BASE" | "TOPUP";
  page?: number;           // Thêm cái này
  pageSize?: number;
  slug?: string;
  packageCode?: string;
  iccid?: string;
}): Promise<PackageListObj> {
  // For TOPUP requests, always include locationCode, slug, iccid as empty strings
  // This matches the working Postman request format
  const body: Record<string, unknown> = {
    locationCode: params.locationCode || (params.type === "BASE" ? "" : undefined),
    type: params.type,
    pager: {
      page: params.page || 1,
      pageSize: params.pageSize || 100 // Lấy tối đa mỗi lần 100 gói
    },
    slug: params.slug || (params.type === "BASE" ? "" : undefined),
    packageCode: params.packageCode,
    iccid: params.iccid || (params.type === "BASE" ? "" : undefined),
  };

  // Remove undefined values
  Object.keys(body).forEach(key => {
    if (body[key] === undefined) delete body[key];
  });

  const res = await esimAccessPost("/package/list", body);
  if (!res.success || !res.obj) throw new Error(res.message || "Failed");

  const obj = res.obj as PackageListObj;
  return { packageList: obj.packageList || [], total: obj.total || 0 };
}

export async function createOrder(params: {
  packageCode: string;
  count?: number;
  orderId?: string;
  iccid?: string;
  esimTranNo?: string;
  periodNum?: string;
}): Promise<EsimListItem> {
  const transactionId = params.orderId
    ? `OW-${params.orderId}`
    : `OW-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const body: Record<string, unknown> = {
    transactionId,
    packageInfoList: [
      { packageCode: params.packageCode, count: params.count || 1 }
    ],
  };

  if (params.iccid) {
    body.iccid = params.iccid;
  }

  if (params.esimTranNo) {
    body.esimTranNo = params.esimTranNo;
  }

  if (params.periodNum) {
    body.periodNum = params.periodNum;
  }

  const res = await esimAccessPost("/esim/order", body);

  if (!res.success || !res.obj) {
    throw new Error(res.message || "eSIM order creation failed");
  }

  const obj = res.obj as { esimList?: EsimListItem[]; orderNo?: string };
  const orderNo = obj.orderNo;
  
  if (obj.esimList && obj.esimList.length > 0) {
    const firstItem = obj.esimList[0];
    return {
      ...firstItem,
      esimTranNo: firstItem.esimTranNo || firstItem.tranNo || orderNo || undefined,
    };
  }

  const directObj = res.obj as EsimListItem;
  if (directObj.iccid && (directObj.qrCodeUrl || directObj.qrCode)) {
    return {
      ...directObj,
      esimTranNo: directObj.esimTranNo || directObj.tranNo || orderNo || undefined,
    };
  }

  if (!orderNo) {
    throw new Error("No eSIM data in response");
  }

  await new Promise(r => setTimeout(r, 2000));
  
  return await queryOrder(orderNo);
}

export async function queryOrder(orderNo: string): Promise<EsimListItem> {
  const res = await esimAccessPost("/esim/query", { 
    orderNo,
    pager: { page: 1, pageSize: 10 }
  });
  
  if (!res.success || !res.obj) throw new Error(res.message || "Failed");
  
  const obj = res.obj as { esimList?: EsimListItem[] };
  
  if (obj.esimList && obj.esimList.length > 0) {
    const first = obj.esimList[0];
    return {
      ...first,
      esimTranNo: first.esimTranNo || first.tranNo || orderNo || undefined,
    };
  }
  
  return res.obj as EsimListItem;
}

export async function queryEsimUsage(iccid: string): Promise<{ esimStatus: string; orderUsage: number; totalVolume?: number; smdpStatus?: string }> {
  const res = await esimAccessPost("/esim/query", { 
    iccid,
    pager: { page: 1, pageSize: 10 }
  });
  if (!res.success || !res.obj) throw new Error(res.message || "Failed");
  const obj = res.obj as { esimStatus?: string; orderUsage?: number; totalVolume?: number; smdpStatus?: string };
  return {
    esimStatus: obj.esimStatus || "UNKNOWN",
    orderUsage: obj.orderUsage || 0,
    totalVolume: obj.totalVolume,
    smdpStatus: obj.smdpStatus,
  };
}

export async function cancelOrder(tranNo: string): Promise<boolean> {
  const res = await esimAccessPost("/esim/cancel", { esimTranNo: tranNo });
  return res.success;
}

export async function refundOrder(orderNo: string): Promise<boolean> {
  const res = await esimAccessPost("/esim/order/refund", { orderNo });
  return res.success;
}

export async function createTopUp(params: {
  packageCode: string;
  iccid?: string;
  esimTranNo?: string;
  periodNum?: string;
  amount?: string;
}): Promise<{
  transactionId: string;
  iccid: string;
  expiredTime: string;
  totalVolume: number;
  totalDuration: number;
  orderUsage: number;
  topUpEsimTranNo: string;
}> {
  const transactionId = `OW-TOPUP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const body: Record<string, unknown> = {
    transactionId,
    packageCode: params.packageCode,
  };

  if (params.iccid) {
    body.iccid = params.iccid;
  }

  if (params.esimTranNo) {
    body.esimTranNo = params.esimTranNo;
  }

  if (params.periodNum) {
    body.periodNum = params.periodNum;
  }

  if (params.amount) {
    body.amount = params.amount;
  }

  const res = await esimAccessPost("/esim/topup", body);

  if (!res.success || !res.obj) {
    throw new Error(res.message || "eSIM top-up failed");
  }

  return res.obj as {
    transactionId: string;
    iccid: string;
    expiredTime: string;
    totalVolume: number;
    totalDuration: number;
    orderUsage: number;
    topUpEsimTranNo: string;
  };
}

export type { EsimPackage, OrderObj, BalanceObj, LocationNetwork, PackageListObj, EsimListItem };