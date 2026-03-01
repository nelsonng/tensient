import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { users, organizations, workspaces, memberships } from "@/lib/db/schema";
import { nanoid } from "@/lib/utils";
import { checkSignupAllowed } from "@/lib/usage-guard";
import { createEmailVerificationToken } from "@/lib/auth-tokens";
import { sendEmail } from "@/lib/email";
import { verifyEmailHtml } from "@/lib/emails/verify-email";
import { logger } from "@/lib/logger";
import { trackEvent } from "@/lib/platform-events";
import { getRequestGeo } from "@/lib/request-geo";
import { withErrorTracking } from "@/lib/api-handler";

async function postHandler(request: Request) {
  try {
    const geo = getRequestGeo(request);

    // Platform capacity check
    const signupCheck = await checkSignupAllowed();
    if (!signupCheck.allowed) {
      trackEvent("sign_up_failed", {
        metadata: { reason: signupCheck.reason, stage: "capacity_check" },
      });
      return NextResponse.json(
        { error: signupCheck.reason },
        { status: 403 }
      );
    }

    const { email, password } = await request.json();

    trackEvent("sign_up_started", {
      metadata: { email },
    });

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const passwordHash = await hash(password, 12);

    // Create organization
    const [org] = await db
      .insert(organizations)
      .values({
        name: `${email.split("@")[0]}'s Organization`,
      })
      .returning();

    // Create user (tier defaults to 'trial' via schema, name collected later)
    const [user] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        organizationId: org.id,
        signupIp: geo.ip,
        signupCity: geo.city,
        signupRegion: geo.region,
        signupCountry: geo.country,
      })
      .returning();

    // Create default workspace
    const [workspace] = await db
      .insert(workspaces)
      .values({
        name: "General",
        organizationId: org.id,
        joinCode: nanoid(8),
      })
      .returning();

    // Create membership as owner
    await db.insert(memberships).values({
      userId: user.id,
      workspaceId: workspace.id,
      role: "owner",
    });

    // Send email verification (non-blocking -- don't fail signup if email fails)
    try {
      const verifyToken = await createEmailVerificationToken(user.id);
      const baseUrl = process.env.NEXTAUTH_URL || "https://tensient.com";
      const verifyUrl = `${baseUrl}/verify-email?token=${verifyToken}`;

      const emailId = await sendEmail({
        to: user.email,
        subject: "Verify your Tensient email",
        html: verifyEmailHtml({ verifyUrl, firstName: null }),
      });

      if (!emailId) {
        logger.warn("Failed to send verification email", { userId: user.id });
      }
    } catch (emailError: unknown) {
      logger.warn("Verification email error (non-fatal)", {
        userId: user.id,
        error: emailError instanceof Error ? emailError.message : "Unknown",
      });
    }

    trackEvent("sign_up_completed", {
      userId: user.id,
      workspaceId: workspace.id,
      organizationId: org.id,
      metadata: { email: user.email, ...geo },
    });

    return NextResponse.json({
      user: { id: user.id, email: user.email },
      workspace: { id: workspace.id, name: workspace.name },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    if (message.includes("unique") || message.includes("duplicate")) {
      trackEvent("sign_up_failed", {
        metadata: { reason: "duplicate_email", email: "redacted" },
      });
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }
    logger.error("Sign-up failed", { error: message });
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

export const POST = withErrorTracking("Sign up", postHandler);
