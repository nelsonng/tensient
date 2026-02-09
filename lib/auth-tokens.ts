import { randomBytes, createHash } from "crypto";
import { db } from "@/lib/db";
import {
  passwordResetTokens,
  emailVerificationTokens,
} from "@/lib/db/schema";
import { eq, and, gt } from "drizzle-orm";

// ── Token Generation ────────────────────────────────────────────────────

/** Generate a cryptographically random token (64-char hex string). */
export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

/** SHA-256 hash a token for safe database storage. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// ── Password Reset Tokens ───────────────────────────────────────────────

const PASSWORD_RESET_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

/**
 * Create a password reset token for a user.
 * Deletes any existing tokens for the user first (one active token at a time).
 * Returns the raw (unhashed) token to include in the email link.
 */
export async function createPasswordResetToken(userId: string): Promise<string> {
  // Delete any existing tokens for this user
  await db
    .delete(passwordResetTokens)
    .where(eq(passwordResetTokens.userId, userId));

  const raw = generateToken();
  const hashed = hashToken(raw);

  await db.insert(passwordResetTokens).values({
    userId,
    token: hashed,
    expiresAt: new Date(Date.now() + PASSWORD_RESET_EXPIRY_MS),
  });

  return raw;
}

/**
 * Validate a password reset token.
 * Returns the userId if valid, or null if expired/missing.
 * Does NOT delete the token -- caller should delete after successful password update.
 */
export async function validatePasswordResetToken(
  rawToken: string
): Promise<string | null> {
  const hashed = hashToken(rawToken);

  const [row] = await db
    .select({ userId: passwordResetTokens.userId })
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.token, hashed),
        gt(passwordResetTokens.expiresAt, new Date())
      )
    )
    .limit(1);

  return row?.userId ?? null;
}

/** Delete all password reset tokens for a user (after successful reset). */
export async function deletePasswordResetTokens(userId: string): Promise<void> {
  await db
    .delete(passwordResetTokens)
    .where(eq(passwordResetTokens.userId, userId));
}

// ── Email Verification Tokens ───────────────────────────────────────────

const EMAIL_VERIFICATION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Create an email verification token for a user.
 * Deletes any existing tokens for the user first.
 * Returns the raw (unhashed) token to include in the email link.
 */
export async function createEmailVerificationToken(
  userId: string
): Promise<string> {
  // Delete any existing tokens for this user
  await db
    .delete(emailVerificationTokens)
    .where(eq(emailVerificationTokens.userId, userId));

  const raw = generateToken();
  const hashed = hashToken(raw);

  await db.insert(emailVerificationTokens).values({
    userId,
    token: hashed,
    expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_EXPIRY_MS),
  });

  return raw;
}

/**
 * Validate an email verification token.
 * Returns the userId if valid, or null if expired/missing.
 * Does NOT delete the token -- caller should delete after successful verification.
 */
export async function validateEmailVerificationToken(
  rawToken: string
): Promise<string | null> {
  const hashed = hashToken(rawToken);

  const [row] = await db
    .select({ userId: emailVerificationTokens.userId })
    .from(emailVerificationTokens)
    .where(
      and(
        eq(emailVerificationTokens.token, hashed),
        gt(emailVerificationTokens.expiresAt, new Date())
      )
    )
    .limit(1);

  return row?.userId ?? null;
}

/** Delete all email verification tokens for a user (after successful verification). */
export async function deleteEmailVerificationTokens(
  userId: string
): Promise<void> {
  await db
    .delete(emailVerificationTokens)
    .where(eq(emailVerificationTokens.userId, userId));
}
