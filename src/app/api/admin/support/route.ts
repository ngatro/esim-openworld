import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendSupportReply } from "@/lib/email";

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

async function getSettings() {
  try {
    const fs = await import("fs/promises");
    const path = require("path");
    const SETTINGS_FILE = path.join(process.cwd(), "data", "settings.json");
    const data = await fs.readFile(SETTINGS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return { supportEmail: "support@owsim.com" };
  }
}

export async function GET(request: Request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;

    const where: { status?: string } = {};
    if (status) where.status = status;

     const tickets = await prisma.supportTicket.findMany({
       where,
       orderBy: { createdAt: "desc" },
     });

     return NextResponse.json(tickets || []);
   } catch (error) {
     console.error("Error fetching tickets:", error);
     return NextResponse.json([], { status: 500 });
   }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, ticketId, adminReply } = body;

    if (action === "reply" && ticketId && adminReply) {
      const ticket = await prisma.supportTicket.findUnique({
        where: { id: parseInt(ticketId) },
      });

      if (!ticket) {
        return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
      }

      const settings = await getSettings();
      const supportEmail = settings.supportEmail || "support@openworldesim.com";

      const emailSent = await sendSupportReply({
        to: ticket.customerEmail,
        subject: `Re: ${ticket.subject}`,
        message: adminReply,
        customerName: ticket.customerName || undefined,
        originalMessage: ticket.message,
      });

      if (emailSent) {
        await prisma.supportTicket.update({
          where: { id: parseInt(ticketId) },
          data: {
            status: "replied",
            adminReply,
            repliedAt: new Date(),
          },
        });
        return NextResponse.json({ success: true });
      } else {
        return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
      }
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error processing ticket:", error);
    return NextResponse.json({ error: "Failed to process ticket" }, { status: 500 });
  }
}