import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users, emailVerificationTokens } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { createEmailVerificationToken } from "@/lib/auth-tokens";
import { sendEmail } from "@/lib/email";
import { verifyEmailHtml } from "@/lib/emails/verify-email";
import { logger } from "@/lib/logger";

const RATE_LIMIT_MS = 60 * 1000; // 1 minute between resend requests

export async function POST() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be signed in" },
        { status: 401 }
      );
    }

    // Look up user
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        emailVerified: users.emailVerified,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    if (user.emailVerified) {
      return NextResponse.json(
        { error: "Email is already verified" },
        { status: 400 }
      );
    }

    // Rate limit: check if a token was created in the last 60 seconds
    const [recentToken] = await db
      .select({ createdAt: emailVerificationTokens.createdAt })
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, user.id))
      .orderBy(desc(emailVerificationTokens.createdAt))
      .limit(1);

    if (recentToken) {
      const elapsed = Date.now() - recentToken.createdAt.getTime();
      if (elapsed < RATE_LIMIT_MS) {
        const waitSeconds = Math.ceil((RATE_LIMIT_MS - elapsed) / 1000);
        return NextResponse.json(
          { error: `Please wait ${waitSeconds} seconds before requesting again` },
          { status: 429 }
        );
      }
    }

    // Create token and send email
    const verifyToken = await createEmailVerificationToken(user.id);
    const baseUrl = process.env.NEXTAUTH_URL || "https://tensient.com";
    const verifyUrl = `${baseUrl}/verify-email?token=${verifyToken}`;

    const emailId = await sendEmail({
      to: user.email,
      subject: "Verify your Tensient email",
      html: verifyEmailHtml({ verifyUrl, firstName: user.firstName }),
    });

    if (!emailId) {
      logger.error("Failed to send verification email via resend-verification", {
        userId: user.id,
        email: user.email,
      });
      return NextResponse.json(
        { error: "Failed to send email. Please try again later." },
        { status: 500 }
      );
    }

    logger.info("Verification email resent", { userId: user.id });

    return NextResponse.json({
      message: "Verification email sent. Check your inbox.",
    });
  } catch (error: unknown) {
    logger.error("Resend verification error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
