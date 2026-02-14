import { db } from "@/lib/db";
import {
  users,
  organizations,
  memberships,
  conversations,
  messages,
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
  signupIp: string | null;
  signupCity: string | null;
  signupRegion: string | null;
  signupCountry: string | null;
  createdAt: Date;
  lastSignIn: Date | null;
  workspaceCount: number;
  conversationCount: number;
  daysActive: number;
  hasMessages: boolean;
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
      signupIp: users.signupIp,
      signupCity: users.signupCity,
      signupRegion: users.signupRegion,
      signupCountry: users.signupCountry,
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

  // Conversation counts + distinct days per user
  const conversationCounts = await db
    .select({
      userId: conversations.userId,
      conversationCount: count(),
      distinctDays: sql<number>`COUNT(DISTINCT DATE(${conversations.createdAt}))`,
    })
    .from(conversations)
    .where(inArray(conversations.userId, userIds))
    .groupBy(conversations.userId);
  const conversationMap = new Map(
    conversationCounts.map((r) => [
      r.userId,
      { count: Number(r.conversationCount), days: Number(r.distinctDays) },
    ])
  );

  // Users with messages (assistant replies)
  const usersWithMessages = await db
    .select({ userId: conversations.userId })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(
      and(
        inArray(conversations.userId, userIds),
        eq(messages.role, "assistant")
      )
    )
    .groupBy(conversations.userId);
  const messageUserIds = new Set(usersWithMessages.map((r) => r.userId));

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
    const convoInfo = conversationMap.get(user.id);
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
      signupIp: user.signupIp,
      signupCity: user.signupCity,
      signupRegion: user.signupRegion,
      signupCountry: user.signupCountry,
      createdAt: user.createdAt,
      lastSignIn: signInMap.get(user.id) || null,
      workspaceCount: wsMap.get(user.id) || 0,
      conversationCount: convoInfo?.count || 0,
      daysActive: convoInfo?.days || 0,
      hasMessages: messageUserIds.has(user.id),
      aiSpendCents: spendMap.get(user.id) || 0,
    };
  });
}
