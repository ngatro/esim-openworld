import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserByEmail } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";
import { sendEmail } from "@/lib/email";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      // Don't reveal if email exists
      return NextResponse.json({ success: true, message: "If email exists, reset link sent" });
    }

    // Generate reset token
    const resetToken = uuidv4();
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetExpiry,
      },
    });

    // Send reset email
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://owsim.com"}/reset-password?token=${resetToken}`;
    
    await sendEmail({
      to: email,
      subject: "Reset your OpenWorld eSIM password",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Reset Your Password</h2>
          <p>Hello ${user.name},</p>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background: #FF6B35; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Reset Password</a>
          </div>
          <p style="color: #666; font-size: 14px;">This link expires in 1 hour.</p>
          <p style="color: #666; font-size: 14px;">If you didn't request this, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">OpenWorld eSIM - Stay connected anywhere</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true, message: "If email exists, reset link sent" });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}