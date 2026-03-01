import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  validatePasswordResetToken,
  deletePasswordResetTokens,
} from "@/lib/auth-tokens";
import { logger } from "@/lib/logger";
import { withErrorTracking } from "@/lib/api-handler";

async function postHandler(request: Request) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Validate token
    const userId = await validatePasswordResetToken(token);

    if (!userId) {
      return NextResponse.json(
        { error: "Invalid or expired reset link. Please request a new one." },
        { status: 400 }
      );
    }

    // Hash new password and update user
    const passwordHash = await hash(password, 12);

    await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, userId));

    // Delete all reset tokens for this user
    await deletePasswordResetTokens(userId);

    logger.info("Password reset successful", { userId });

    return NextResponse.json({
      message: "Password has been reset. You can now sign in.",
    });
  } catch (error: unknown) {
    logger.error("Reset password error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

export const POST = withErrorTracking("Reset password", postHandler);
