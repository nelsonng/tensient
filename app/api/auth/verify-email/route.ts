import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  validateEmailVerificationToken,
  deleteEmailVerificationTokens,
} from "@/lib/auth-tokens";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 }
      );
    }

    // Validate token
    const userId = await validateEmailVerificationToken(token);

    if (!userId) {
      return NextResponse.json(
        { error: "Invalid or expired verification link. Please request a new one." },
        { status: 400 }
      );
    }

    // Mark email as verified
    await db
      .update(users)
      .set({ emailVerified: new Date(), updatedAt: new Date() })
      .where(eq(users.id, userId));

    // Delete all verification tokens for this user
    await deleteEmailVerificationTokens(userId);

    logger.info("Email verified", { userId });

    return NextResponse.json({
      message: "Email verified successfully.",
    });
  } catch (error: unknown) {
    logger.error("Email verification error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
