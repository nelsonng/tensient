import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, platformEvents } from "@/lib/db/schema";
import { sql, count, eq, and, gte, isNotNull } from "drizzle-orm";
import { requireSuperAdminAPI } from "@/lib/auth/require-super-admin";

export async function GET(request: Request) {
  const session = await requireSuperAdminAPI();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "30") || 30;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  // Total users signed up in period
  const [signedUp] = await db
    .select({ count: count() })
    .from(users)
    .where(gte(users.createdAt, cutoff));

  // Email verified in period
  const [emailVerified] = await db
    .select({ count: count() })
    .from(users)
    .where(
      and(
        gte(users.createdAt, cutoff),
        isNotNull(users.emailVerified)
      )
    );

  // Onboarding started events in period
  const [onboardStarted] = await db
    .select({ count: count() })
    .from(platformEvents)
    .where(
      and(
        eq(platformEvents.type, "onboarding_started"),
        gte(platformEvents.createdAt, cutoff)
      )
    );

  // Onboarding completed events in period
  const [onboardCompleted] = await db
    .select({ count: count() })
    .from(platformEvents)
    .where(
      and(
        eq(platformEvents.type, "onboarding_completed"),
        gte(platformEvents.createdAt, cutoff)
      )
    );

  // Sign-up failures in period
  const [signUpFailed] = await db
    .select({ count: count() })
    .from(platformEvents)
    .where(
      and(
        eq(platformEvents.type, "sign_up_failed"),
        gte(platformEvents.createdAt, cutoff)
      )
    );

  // User-level drill down: each user with their milestone progress
  const userDetails = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      emailVerified: users.emailVerified,
      tier: users.tier,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(gte(users.createdAt, cutoff))
    .orderBy(sql`${users.createdAt} DESC`)
    .limit(100);

  // Get onboarding events for these users
  const userIds = userDetails.map((u) => u.id);
  let onboardingEvents: { userId: string | null; type: string; createdAt: Date }[] = [];
  if (userIds.length > 0) {
    onboardingEvents = await db
      .select({
        userId: platformEvents.userId,
        type: platformEvents.type,
        createdAt: platformEvents.createdAt,
      })
      .from(platformEvents)
      .where(
        and(
          sql`${platformEvents.userId} = ANY(${userIds})`,
          sql`${platformEvents.type} IN ('onboarding_started', 'onboarding_completed')`
        )
      );
  }

  // Build per-user milestone map
  const userMilestones = userDetails.map((user) => {
    const userOnboardEvents = onboardingEvents.filter((e) => e.userId === user.id);
    return {
      ...user,
      onboardingStarted: userOnboardEvents.some((e) => e.type === "onboarding_started"),
      onboardingCompleted: userOnboardEvents.some((e) => e.type === "onboarding_completed"),
    };
  });

  return NextResponse.json({
    period: { days, cutoff: cutoff.toISOString() },
    funnel: {
      signedUp: signedUp.count,
      emailVerified: emailVerified.count,
      onboardingStarted: onboardStarted.count,
      onboardingCompleted: onboardCompleted.count,
      signUpFailed: signUpFailed.count,
    },
    users: userMilestones,
  });
}
