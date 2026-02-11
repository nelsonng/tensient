import { db } from "@/lib/db";
import {
  users,
  organizations,
  memberships,
  captures,
  artifacts,
  usageLogs,
  platformEvents,
} from "@/lib/db/schema";
import { sql, count, eq, and, inArray } from "drizzle-orm";

export interface UserRow {
  id: string;
  email: string;
  domain: string;
  firstName: string | null;
  lastName: string | null;
  orgId: string | null;
  orgName: string | null;
  tier: "trial" | "active" | "suspended";
  emailVerified: Date | null;
  isSuperAdmin: boolean;
  createdAt: Date;
  lastSignIn: Date | null;
  workspaceCount: number;
  captureCount: number;
  daysActive: number;
  hasSynthesis: boolean;
  aiSpendCents: number;
}

/**
 * Fetch enriched user data for admin pages.
 * Pass orgId to scope results to a single organization.
 */
export async function getUsersData(orgId?: string): Promise<UserRow[]> {
  // Base user query -- optionally filtered by org
  const baseQuery = db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      orgId: users.organizationId,
      tier: users.tier,
      emailVerified: users.emailVerified,
      isSuperAdmin: users.isSuperAdmin,
      createdAt: users.createdAt,
    })
    .from(users);

  const allUsers = orgId
    ? await baseQuery.where(eq(users.organizationId, orgId)).orderBy(sql`${users.createdAt} DESC`)
    : await baseQuery.orderBy(sql`${users.createdAt} DESC`);

  if (allUsers.length === 0) {
    return [];
  }

  const userIds = allUsers.map((u) => u.id);

  // Org names -- only fetch orgs that users reference
  const orgIds = [...new Set(allUsers.map((u) => u.orgId).filter(Boolean))] as string[];
  let orgMap = new Map<string, string>();
  if (orgIds.length > 0) {
    const orgs = await db
      .select({ id: organizations.id, name: organizations.name })
      .from(organizations)
      .where(inArray(organizations.id, orgIds));
    orgMap = new Map(orgs.map((o) => [o.id, o.name]));
  }

  // Workspace counts per user
  const wsCounts = await db
    .select({
      userId: memberships.userId,
      wsCount: count(),
    })
    .from(memberships)
    .where(inArray(memberships.userId, userIds))
    .groupBy(memberships.userId);
  const wsMap = new Map(wsCounts.map((r) => [r.userId, Number(r.wsCount)]));

  // Capture counts + distinct days per user
  const captureCounts = await db
    .select({
      userId: captures.userId,
      captureCount: count(),
      distinctDays: sql<number>`COUNT(DISTINCT DATE(${captures.createdAt}))`,
    })
    .from(captures)
    .where(inArray(captures.userId, userIds))
    .groupBy(captures.userId);
  const captureMap = new Map(
    captureCounts.map((r) => [
      r.userId,
      { count: Number(r.captureCount), days: Number(r.distinctDays) },
    ])
  );

  // Users with synthesis (artifacts via captures)
  const usersWithArtifacts = await db
    .select({ userId: captures.userId })
    .from(artifacts)
    .innerJoin(captures, eq(artifacts.captureId, captures.id))
    .where(inArray(captures.userId, userIds))
    .groupBy(captures.userId);
  const artifactUserIds = new Set(usersWithArtifacts.map((r) => r.userId));

  // AI spend per user (sum of estimated_cost_cents)
  const spendByUser = await db
    .select({
      userId: usageLogs.userId,
      totalCents: sql<number>`COALESCE(SUM(${usageLogs.estimatedCostCents}), 0)`,
    })
    .from(usageLogs)
    .where(inArray(usageLogs.userId, userIds))
    .groupBy(usageLogs.userId);
  const spendMap = new Map(
    spendByUser.map((r) => [r.userId, Number(r.totalCents)])
  );

  // Last sign-in per user (from platform_events)
  const lastSignIns = await db
    .select({
      userId: platformEvents.userId,
      lastAt: sql<Date>`MAX(${platformEvents.createdAt})`,
    })
    .from(platformEvents)
    .where(
      and(
        inArray(platformEvents.userId, userIds),
        eq(platformEvents.type, "sign_in_success")
      )
    )
    .groupBy(platformEvents.userId);
  const signInMap = new Map(
    lastSignIns.map((r) => [r.userId, r.lastAt ? new Date(r.lastAt) : null])
  );

  // Assemble rows
  return allUsers.map((user) => {
    const captureInfo = captureMap.get(user.id);
    return {
      id: user.id,
      email: user.email,
      domain: user.email.split("@")[1] || "",
      firstName: user.firstName,
      lastName: user.lastName,
      orgId: user.orgId,
      orgName: user.orgId ? orgMap.get(user.orgId) || null : null,
      tier: user.tier,
      emailVerified: user.emailVerified,
      isSuperAdmin: user.isSuperAdmin,
      createdAt: user.createdAt,
      lastSignIn: signInMap.get(user.id) || null,
      workspaceCount: wsMap.get(user.id) || 0,
      captureCount: captureInfo?.count || 0,
      daysActive: captureInfo?.days || 0,
      hasSynthesis: artifactUserIds.has(user.id),
      aiSpendCents: spendMap.get(user.id) || 0,
    };
  });
}
