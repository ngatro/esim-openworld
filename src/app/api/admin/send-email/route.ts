import { NextResponse } from "next/server";
import { sendEmail, getComposeEmailHtml } from "@/lib/email";
import { getSessionFromRequest } from "@/lib/auth";
import { readFile } from "fs/promises";
import { join } from "path";

const SETTINGS_FILE = join(process.cwd(), "data", "settings.json");

async function getSettings() {
  try {
    const data = await readFile(SETTINGS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return { supportEmail: "support@owsim.com" };
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { to, subject, html, text, from } = body;

    if (!to || !subject || (!html && !text)) {
      return NextResponse.json(
        { error: "Missing required fields: to, subject, and html or text" },
        { status: 400 }
      );
    }

    console.log("📧 Sending email via Resend API...", { to, subject });

    const emailHtml = html || getComposeEmailHtml({ to, subject, message: text });

    const settings = await getSettings();
    const supportEmail = settings.supportEmail || "support@owsim.com";

    const sent = await sendEmail({
      to: to.trim(),
      subject: subject.trim(),
      html: emailHtml,
      from: from || `OW SIM Support <${supportEmail}>`,
    });

    if (sent) {
      console.log("✅ Email sent successfully");
      return NextResponse.json({ success: true });
    } else {
      console.error("❌ sendEmail returned false - check RESEND_API_KEY and configuration");
      return NextResponse.json(
        { error: "Failed to send email. Check server logs or email configuration." },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error sending email:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
