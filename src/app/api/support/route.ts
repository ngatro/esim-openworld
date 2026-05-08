import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { customerName, customerEmail, subject, message } = body;

    if (!customerEmail || !subject || !message) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        customerName,
        customerEmail,
        subject,
        message,
        status: "open",
      },
    });

    return NextResponse.json({ success: true, ticket });
  } catch (error) {
    console.error("Error creating support ticket:", error);
    return NextResponse.json(
      { error: "Failed to create ticket" },
      { status: 500 }
    );
  }
}