import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createPasswordResetToken } from "@/lib/auth-tokens";
import { sendEmail } from "@/lib/email";
import { resetPasswordEmailHtml } from "@/lib/emails/reset-password";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Always return 200 to prevent email enumeration
    const successResponse = NextResponse.json({
      message: "If an account with that email exists, we sent a password reset link.",
    });

    // Look up user
    const [user] = await db
      .select({ id: users.id, email: users.email, firstName: users.firstName })
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (!user) {
      // User not found -- still return 200
      return successResponse;
    }

    // Create token
    const rawToken = await createPasswordResetToken(user.id);

    // Build reset URL
    const baseUrl = process.env.NEXTAUTH_URL || "https://tensient.vercel.app";
    const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;

    // Send email
    const emailId = await sendEmail({
      to: user.email,
      subject: "Reset your Tensient password",
      html: resetPasswordEmailHtml({ resetUrl, firstName: user.firstName }),
    });

    if (!emailId) {
      logger.error("Failed to send password reset email", { userId: user.id, email: user.email });
      // Still return 200 to not leak info, but log the failure
    }

    return successResponse;
  } catch (error: unknown) {
    logger.error("Forgot password error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
