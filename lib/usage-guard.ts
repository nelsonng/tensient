import { eq, sql, and, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, usageLogs } from "@/lib/db/schema";

export interface UsageCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Check if a user is allowed to make an AI operation.
 * Enforces: kill switch, user tier, trial limits, monthly budget, daily rate limit.
 */
export async function checkUsageAllowed(
  userId: string
): Promise<UsageCheckResult> {
  // 1. Kill switch
  if (process.env.PLATFORM_LOCKED === "true") {
    return {
      allowed: false,
      reason: "Platform is temporarily locked. Please try again later.",
    };
  }

  // 2. Fetch user tier
  const [user] = await db
    .select({ tier: users.tier })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return { allowed: false, reason: "User not found." };
  }

  if (user.tier === "suspended") {
    return {
      allowed: false,
      reason: "Your account has been suspended. Contact support.",
    };
  }

  // 3. Trial limit: count total usage logs for this user
  if (user.tier === "trial") {
    const maxTrialCaptures = Number(
      process.env.FREE_TRIAL_CAPTURES ?? 20
    );

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(usageLogs)
      .where(eq(usageLogs.userId, userId));

    if (Number(count) >= maxTrialCaptures) {
      return {
        allowed: false,
        reason: `Free trial limit reached (${maxTrialCaptures} operations). Contact us to continue.`,
      };
    }
  }

  // 4. Monthly budget: sum estimated_cost_cents this calendar month
  if (user.tier === "active") {
    const maxMonthlyCents = Number(
      process.env.MAX_MONTHLY_COST_CENTS_PER_USER ?? 1000
    );

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [{ totalCost }] = await db
      .select({
        totalCost: sql<number>`coalesce(sum(${usageLogs.estimatedCostCents}), 0)`,
      })
      .from(usageLogs)
      .where(
        and(
          eq(usageLogs.userId, userId),
          gte(usageLogs.createdAt, startOfMonth)
        )
      );

    if (Number(totalCost) >= maxMonthlyCents) {
      return {
        allowed: false,
        reason: "Monthly usage limit reached. Resets next month.",
      };
    }
  }

  // 5. Daily rate limit
  const maxPerDay = Number(process.env.MAX_CAPTURES_PER_DAY ?? 50);
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [{ todayCount }] = await db
    .select({ todayCount: sql<number>`count(*)` })
    .from(usageLogs)
    .where(
      and(
        eq(usageLogs.userId, userId),
        gte(usageLogs.createdAt, startOfDay)
      )
    );

  if (Number(todayCount) >= maxPerDay) {
    return {
      allowed: false,
      reason: `Daily limit reached (${maxPerDay} operations). Try again tomorrow.`,
    };
  }

  return { allowed: true };
}

/**
 * Log a usage event after a successful AI operation.
 */
export async function logUsage(params: {
  userId: string;
  workspaceId: string;
  operation: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostCents: number;
}): Promise<void> {
  await db.insert(usageLogs).values({
    userId: params.userId,
    workspaceId: params.workspaceId,
    operation: params.operation,
    inputTokens: params.inputTokens,
    outputTokens: params.outputTokens,
    estimatedCostCents: params.estimatedCostCents,
  });
}

/**
 * Check if platform has capacity for a new user signup.
 */
export async function checkSignupAllowed(): Promise<UsageCheckResult> {
  if (process.env.PLATFORM_LOCKED === "true") {
    return {
      allowed: false,
      reason: "Platform is temporarily locked. Please try again later.",
    };
  }

  const maxUsers = Number(process.env.PLATFORM_MAX_USERS ?? 100);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users);

  if (Number(count) >= maxUsers) {
    return {
      allowed: false,
      reason: "Platform is at capacity. Join the waitlist.",
    };
  }

  return { allowed: true };
}
