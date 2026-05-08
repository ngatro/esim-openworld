const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "support@owsim.com";

interface EmailParams {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

// Kiểu dữ liệu cho đa ngôn ngữ
type SupportedLang = 'vi' | 'en' | 'de' | 'fr';

type TranslationMap = {
  subject: string;
  greeting: string;
  thank: string;
  order: string;
  scan: string;
  manual: string;
  guide: string;
  ios: string;
  android: string;
  iosSteps: string[];
  androidSteps: string[];
  help: string;
};

export async function sendEmail({ to, subject, html, from }: EmailParams): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set, skipping email");
    return false;
  }

  const fromAddress = from || `OW SIM Support <${SUPPORT_EMAIL}>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + RESEND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Email send failed:", err);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Email error:", error);
    return false;
  }
}

/**
 * EMAIL HỖ TRỢ (REPLY)
 */
export async function sendSupportReply(params: {
  to: string;
  subject: string;
  message: string;
  originalMessage?: string;
  customerName?: string;
}): Promise<boolean> {
  const html = getSupportReplyHtml({
    customerName: params.customerName,
    originalMessage: params.originalMessage || params.message,
    adminReply: params.message,
  });
  
  return sendEmail({
    to: params.to,
    subject: params.subject,
    html,
    from: `OW SIM Support <${SUPPORT_EMAIL}>`,
  });
}

export function getSupportReplyHtml(data: {
  customerName?: string;
  originalMessage: string;
  adminReply: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #fff7ed; margin: 0; padding: 20px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #ffedd5;">
    <tr>
      <td style="background: #f97316; padding: 32px; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">🌍 OW SIM Support</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px;">
        <p style="color: #1e293b; font-size: 16px; font-weight: 600; margin: 0 0 16px 0;">Hi ${data.customerName || "there"},</p>
        <p style="color: #64748b; font-size: 14px; margin: 0 0 24px 0;">Cảm ơn bạn đã liên hệ. Đội ngũ hỗ trợ của chúng tôi đã phản hồi yêu cầu của bạn:</p>
        
        <div style="background: #fff7ed; border-left: 4px solid #f97316; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
          <p style="color: #1e293b; font-size: 15px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${data.adminReply}</p>
        </div>
        
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">Nếu cần hỗ trợ thêm, hãy phản hồi email này hoặc truy cập <a href="https://owsim.com/support" style="color: #f97316;">owsim.com/support</a></p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * EMAIL XÁC NHẬN ĐƠN HÀNG (ĐA NGÔN NGỮ)
 */
export function getOrderConfirmationHtml(order: {
  id: number;
  totalAmount: number;
  customerName?: string | null;
  items: { 
    planName: string; price: number; quantity: number; 
    qrImage?: string | null; activationCode?: string | null; 
    iccid?: string | null; lpaString?: string | null 
  }[];
}, lang: string | undefined | null = 'en'): string {
  
  const validLangs: SupportedLang[] = ['vi', 'en', 'de', 'fr'];
  const safeLang: SupportedLang = validLangs.includes(lang as SupportedLang) ? (lang as SupportedLang) : 'en';

  const translations: Record<SupportedLang, any> = {
    vi: {
      subject: "eSIM của bạn đã sẵn sàng!",
      greeting: "Xin chào",
      thank: "Cảm ơn bạn đã mua sắm! eSIM của bạn đã sẵn sàng để sử dụng.",
      order: "Đơn hàng",
      scan: "Quét mã QR",
      manual: "Kích hoạt thủ công",
      guide: "Hướng dẫn cài đặt",
      ios: "iPhone (iOS):",
      android: "Android:",
      iosSteps: ["Cài đặt > Di động > Thêm eSIM", "Quét mã QR ở trên", "Hoặc dùng LPA String nếu cần"],
      androidSteps: ["Cài đặt > Kết nối > Quản lý SIM", "Thêm gói cước di động", "Quét QR hoặc nhập mã LPA"],
      help: "Cần hỗ trợ? Truy cập"
    },
    en: {
      subject: "Your eSIM is Ready!",
      greeting: "Hi",
      thank: "Thank you for your purchase! Your eSIM is ready to use.",
      order: "Order",
      scan: "Scan QR Code",
      manual: "Manual Activation",
      guide: "Installation Guide",
      ios: "iPhone (iOS):",
      android: "Android:",
      iosSteps: ["Settings > Cellular > Add eSIM", "Scan the QR code above", "Or use LPA String if manual entry needed"],
      androidSteps: ["Settings > Connections > SIM Manager", "Add mobile plan", "Scan QR or use LPA String"],
      help: "Need help? Visit"
    },
    de: {
      subject: "Ihre eSIM ist bereit!",
      greeting: "Hallo",
      thank: "Vielen Dank für Ihren Einkauf! Ihre eSIM ist einsatzbereit.",
      order: "Bestellung",
      scan: "QR-Code scannen",
      manual: "Manuelle Aktivierung",
      guide: "Installation",
      ios: "iPhone (iOS):",
      android: "Android:",
      iosSteps: ["Einstellungen > Mobilfunk > eSIM hinzufügen", "QR-Code scannen", "Oder LPA-String manuell eingeben"],
      androidSteps: ["Einstellungen > Verbindungen > SIM-Manager", "Mobilfunktarif hinzufügen", "QR scannen oder LPA nutzen"],
      help: "Hilfe? Besuchen Sie"
    },
    fr: {
      subject: "Votre eSIM est prête !",
      greeting: "Bonjour",
      thank: "Merci pour votre achat ! Votre eSIM est prête à l'emploi.",
      order: "Commande",
      scan: "Scanner le QR Code",
      manual: "Activation manuelle",
      guide: "Guide d'installation",
      ios: "iPhone (iOS) :",
      android: "Android :",
      iosSteps: ["Réglages > Données cellulaires > Ajouter eSIM", "Scannez le code QR ci-dessus", "Ou utilisez le code LPA"],
      androidSteps: ["Paramètres > Connexions > Gestionnaire SIM", "Ajouter un forfait mobile", "Scanner QR hoặc utiliser LPA"],
      help: "Besoin d'aide ? Visitez"
    }
  };

  const t = translations[safeLang];

  return `
<!DOCTYPE html>
<html lang="${safeLang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #fff7ed; margin: 0; padding: 20px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 24px; overflow: hidden; border: 1px solid #ffedd5;">
    <!-- Header -->
    <tr>
      <td style="background: #f97316; padding: 40px 20px; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 800;">🌍 OW SIM</h1>
        <p style="color: #ffedd5; margin: 8px 0 0 0; font-size: 16px;">${t.subject}</p>
      </td>
    </tr>

    <!-- Content -->
    <tr>
      <td style="padding: 32px;">
        <p style="color: #1e293b; font-size: 18px; font-weight: 600; margin: 0;">${t.greeting} ${order.customerName || ""},</p>
        <p style="color: #64748b; font-size: 15px; margin-bottom: 30px;">${t.thank}</p>

        <div style="background: #fff7ed; border-radius: 16px; padding: 20px; margin-bottom: 30px; text-align: center;">
          <p style="margin: 0; color: #f97316; font-size: 12px; font-weight: 700; text-transform: uppercase;">${t.order} #${order.id}</p>
          <p style="margin: 0; color: #7c2d12; font-size: 32px; font-weight: 800;">$${order.totalAmount.toFixed(2)}</p>
        </div>

        ${order.items.map((item) => `
        <div style="border: 2px solid #f1f5f9; border-radius: 20px; padding: 24px; margin-bottom: 20px;">
          <h3 style="color: #1e293b; margin: 0 0 12px 0;">📶 ${item.planName}</h3>
          
          ${item.qrImage ? `
          <div style="text-align: center; margin: 20px 0;">
            <div style="display: inline-block; padding: 12px; border: 2px solid #f97316; border-radius: 16px;">
              <img src="${item.qrImage}" width="180" height="180" style="display: block;" />
            </div>
            <p style="color: #f97316; font-size: 11px; font-weight: 700; margin-top: 8px;">${t.scan}</p>
          </div>
          ` : ''}

          <div style="background: #f8fafc; border-radius: 12px; padding: 15px; font-size: 13px;">
            ${item.iccid ? `<p style="margin: 0 0 8px 0; color: #64748b;">ICCID: <strong style="color: #1e293b; font-family: monospace;">${item.iccid}</strong></p>` : ''}
            ${item.lpaString ? `
              <p style="margin: 0; color: #64748b; font-weight: 700; font-size: 11px; text-transform: uppercase;">${t.manual} (LPA)</p>
              <p style="margin: 4px 0 0 0; color: #1e293b; font-family: monospace; word-break: break-all; background: white; padding: 8px; border: 1px dashed #cbd5e1; border-radius: 6px;">${item.lpaString}</p>
            ` : ''}
          </div>
        </div>
        `).join('')}

        <!-- Guide -->
        <div style="background: #1e293b; border-radius: 20px; padding: 30px; color: #ffffff;">
          <h4 style="margin: 0 0 15px 0; font-size: 18px; color: #f97316;">🚀 ${t.guide}</h4>
          <p style="font-weight: 700; margin-bottom: 8px;">${t.ios}</p>
          <ul style="font-size: 13px; color: #94a3b8; padding-left: 20px; margin-bottom: 20px;">
            ${t.iosSteps.map((s: string) => `<li style="margin-bottom: 5px;">${s}</li>`).join('')}
          </ul>
          <p style="font-weight: 700; margin-bottom: 8px;">${t.android}</p>
          <ul style="font-size: 13px; color: #94a3b8; padding-left: 20px;">
            ${t.androidSteps.map((s: string) => `<li style="margin-bottom: 5px;">${s}</li>`).join('')}
          </ul>
        </div>

        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 30px;">
          ${t.help} <a href="https://owsim.com/support" style="color: #f97316;">owsim.com/support</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function getComposeEmailHtml(data: {
  to: string;
  subject: string;
  message: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #fff7ed; margin: 0; padding: 20px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #ffedd5;">
    <tr>
      <td style="background: #f97316; padding: 32px; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">🌍 OW SIM Admin</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px;">
        <p style="color: #1e293b; font-size: 16px; font-weight: 600; margin: 0 0 16px 0;">Hello,</p>
        <p style="color: #64748b; font-size: 14px; margin: 0 0 24px 0;">You have received an email from the OW SIM admin team:</p>
        
        <div style="background: #fff7ed; border-left: 4px solid #f97316; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
          <p style="color: #1e293b; font-size: 15px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${data.message}</p>
        </div>
        
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">OW SIM Support Team<br/>support@owsim.com</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * EMAIL CHO ADMIN (GIỮ NGUYÊN LOGIC NHƯNG LÀM ĐẸP CHÚT)
 */
export function getOrderConfirmationAdminHtml(order: {
  id: number;
  totalAmount: number;
  customerName?: string | null;
  customerEmail?: string | null;
  items: { planName: string; price: number }[];
}): string {
  return `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; padding: 20px; background: #f1f5f9;">
  <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; border-top: 4px solid #f97316;">
    <h2 style="color: #1e293b;">🆕 New Order #${order.id}</h2>
    <p><strong>Amount:</strong> <span style="color: #f97316; font-weight: bold;">$${order.totalAmount.toFixed(2)}</span></p>
    <p><strong>Customer:</strong> ${order.customerName || "N/A"} (${order.customerEmail || "N/A"})</p>
    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
    <h3>Items:</h3>
    <ul style="list-style: none; padding: 0;">
      ${order.items.map((i) => `<li style="padding: 8px 0; border-bottom: 1px solid #f8fafc;">📶 ${i.planName} - $${i.price.toFixed(2)}</li>`).join("")}
    </ul>
    <div style="margin-top: 30px;">
      <a href="https://owsim.com/admin/orders" style="background: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">View in Dashboard</a>
    </div>
  </div>
</body>
</html>`;
}