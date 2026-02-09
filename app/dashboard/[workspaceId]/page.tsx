import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { eq, desc, sql as dsql, gte, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { getWorkspaceMembership } from "@/lib/auth/workspace-access";
import {
  canons,
  artifacts,
  captures,
  memberships,
  users,
  workspaces,
  protocols,
  actions,
  digests,
} from "@/lib/db/schema";
import { DashboardClient } from "./dashboard-client";

function getWeekStart(): Date {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + mondayOffset);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

function formatWeekRange(weekStart: Date): string {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${weekStart.toLocaleDateString("en-US", opts)} - ${weekEnd.toLocaleDateString("en-US", opts)}, ${weekEnd.getFullYear()}`;
}

export default async function WorkspaceDashboard({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const { workspaceId } = await params;

  // Verify workspace membership
  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) redirect("/dashboard");

  // Fetch workspace
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!workspace) redirect("/dashboard");

  // Latest Canon (include healthAnalysis for pillar names)
  const [canon] = await db
    .select({
      id: canons.id,
      content: canons.content,
      healthAnalysis: canons.healthAnalysis,
      createdAt: canons.createdAt,
    })
    .from(canons)
    .where(eq(canons.workspaceId, workspaceId))
    .orderBy(desc(canons.createdAt))
    .limit(1);

  // Check if this is a brand-new workspace
  if (!canon) {
    const [anyArtifact] = await db
      .select({ id: artifacts.id })
      .from(artifacts)
      .innerJoin(captures, eq(artifacts.captureId, captures.id))
      .where(eq(captures.workspaceId, workspaceId))
      .limit(1);

    if (!anyArtifact) {
      redirect(`/dashboard/${workspaceId}/welcome`);
    }
  }

  // ── Smart date window: current week, or fall back to latest activity ──

  const currentWeekStart = getWeekStart();

  // Quick check: does this week have any data?
  const [currentWeekCheck] = await db
    .select({ count: dsql<number>`count(*)` })
    .from(captures)
    .where(
      and(
        eq(captures.workspaceId, workspaceId),
        gte(captures.createdAt, currentWeekStart)
      )
    );

  let windowStart = currentWeekStart;
  let isCurrentWeek = true;

  if (Number(currentWeekCheck?.count ?? 0) === 0) {
    // Fall back to the week containing the most recent activity
    const [latestCapture] = await db
      .select({ createdAt: captures.createdAt })
      .from(captures)
      .where(eq(captures.workspaceId, workspaceId))
      .orderBy(desc(captures.createdAt))
      .limit(1);

    if (latestCapture) {
      const latestDate = latestCapture.createdAt;
      const day = latestDate.getDay();
      const mondayOffset = day === 0 ? -6 : 1 - day;
      windowStart = new Date(latestDate);
      windowStart.setDate(latestDate.getDate() + mondayOffset);
      windowStart.setHours(0, 0, 0, 0);
      isCurrentWeek = false;
    }
  }

  const windowLabel = formatWeekRange(windowStart);

  // ── Window-scoped queries ─────────────────────────────────────────────

  // Thoughts in window
  const [thoughtsInWindow] = await db
    .select({
      count: dsql<number>`count(*)`,
    })
    .from(captures)
    .where(
      and(
        eq(captures.workspaceId, workspaceId),
        gte(captures.createdAt, windowStart)
      )
    );

  // Synthesis in window
  const [synthesisInWindow] = await db
    .select({
      count: dsql<number>`count(*)`,
      avgAlignment: dsql<number>`avg(1 - coalesce(${artifacts.driftScore}, 0.5))`,
    })
    .from(artifacts)
    .innerJoin(captures, eq(artifacts.captureId, captures.id))
    .where(
      and(
        eq(captures.workspaceId, workspaceId),
        gte(artifacts.createdAt, windowStart)
      )
    );

  // Actions in window
  const [actionsInWindow] = await db
    .select({
      newCount: dsql<number>`count(*) filter (where ${actions.createdAt} >= ${windowStart.toISOString()})`,
      completedCount: dsql<number>`count(*) filter (where ${actions.status} = 'done' and ${actions.updatedAt} >= ${windowStart.toISOString()})`,
      blockedCount: dsql<number>`count(*) filter (where ${actions.status} = 'blocked')`,
      openCount: dsql<number>`count(*) filter (where ${actions.status} in ('open', 'in_progress', 'blocked'))`,
      unlinkedCount: dsql<number>`count(*) filter (where ${actions.goalId} is null and ${actions.status} in ('open', 'in_progress', 'blocked'))`,
    })
    .from(actions)
    .where(eq(actions.workspaceId, workspaceId));

  // Active team members in window
  const [activeTeamInWindow] = await db
    .select({
      count: dsql<number>`count(distinct ${captures.userId})`,
    })
    .from(captures)
    .where(
      and(
        eq(captures.workspaceId, workspaceId),
        gte(captures.createdAt, windowStart)
      )
    );

  // Team memberships with user info
  const teamMembers = await db
    .select({
      userId: memberships.userId,
      role: memberships.role,
      streakCount: memberships.streakCount,
      tractionScore: memberships.tractionScore,
      lastCaptureAt: memberships.lastCaptureAt,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(eq(memberships.workspaceId, workspaceId))
    .orderBy(desc(memberships.tractionScore));

  // Alignment trend (last 20 artifacts)
  const driftTrend = await db
    .select({
      driftScore: artifacts.driftScore,
      createdAt: artifacts.createdAt,
    })
    .from(artifacts)
    .innerJoin(captures, eq(artifacts.captureId, captures.id))
    .where(eq(captures.workspaceId, workspaceId))
    .orderBy(desc(artifacts.createdAt))
    .limit(20);

  // All public coaches
  const allCoaches = await db
    .select({ id: protocols.id, name: protocols.name })
    .from(protocols)
    .where(eq(protocols.isPublic, true));

  // Weekly digest (Top 5) -- explicit columns for JSONB reliability
  const [digest] = await db
    .select({
      summary: digests.summary,
      items: digests.items,
      weekStart: digests.weekStart,
    })
    .from(digests)
    .where(eq(digests.workspaceId, workspaceId))
    .orderBy(desc(digests.generatedAt))
    .limit(1);

  // Goal pillar count (from content -- count numbered items)
  const goalPillarCount = canon
    ? (canon.content.match(/^\d+\./gm) || []).length || 5
    : 0;

  // ── Per-pillar activity ───────────────────────────────────────────────

  const pillarNames: string[] = canon?.healthAnalysis
    ? (((canon.healthAnalysis as Record<string, unknown>).pillars as Array<{ title: string }>) || []).map((p) => p.title)
    : [];

  // Artifacts grouped by pillar in window
  const pillarActivity = await db
    .select({
      goalPillar: artifacts.goalPillar,
      userName: dsql<string>`concat(${users.firstName}, ' ', ${users.lastName})`,
      synthesisSnippet: dsql<string>`left(${artifacts.content}, 120)`,
      createdAt: artifacts.createdAt,
    })
    .from(artifacts)
    .innerJoin(captures, eq(artifacts.captureId, captures.id))
    .innerJoin(users, eq(captures.userId, users.id))
    .where(
      and(
        eq(captures.workspaceId, workspaceId),
        gte(artifacts.createdAt, windowStart)
      )
    )
    .orderBy(desc(artifacts.createdAt));

  // Actions grouped by pillar in window
  const pillarActions = await db
    .select({
      goalPillar: actions.goalPillar,
      title: actions.title,
      status: actions.status,
      priority: actions.priority,
    })
    .from(actions)
    .where(
      and(
        eq(actions.workspaceId, workspaceId),
        gte(actions.createdAt, windowStart)
      )
    );

  // Aggregate per-pillar data
  const goalPillarMap = new Map<string, {
    contributors: string[];
    synthSnippets: string[];
    actions: Array<{ title: string; status: string; priority: string }>;
    blockers: string[];
  }>();

  for (const name of pillarNames) {
    goalPillarMap.set(name, { contributors: [], synthSnippets: [], actions: [], blockers: [] });
  }

  for (const row of pillarActivity) {
    if (!row.goalPillar) continue;
    const entry = goalPillarMap.get(row.goalPillar) || { contributors: [], synthSnippets: [], actions: [], blockers: [] };
    const name = (row.userName ?? "").trim();
    if (name && !entry.contributors.includes(name)) entry.contributors.push(name);
    if (entry.synthSnippets.length < 2 && row.synthesisSnippet) entry.synthSnippets.push(row.synthesisSnippet);
    goalPillarMap.set(row.goalPillar, entry);
  }

  for (const row of pillarActions) {
    if (!row.goalPillar) continue;
    const entry = goalPillarMap.get(row.goalPillar) || { contributors: [], synthSnippets: [], actions: [], blockers: [] };
    if (entry.actions.length < 3) entry.actions.push({ title: row.title, status: row.status, priority: row.priority });
    if (row.status === "blocked" && entry.blockers.length < 2) entry.blockers.push(row.title);
    goalPillarMap.set(row.goalPillar, entry);
  }

  const goalPillars = pillarNames.map((name) => ({
    name,
    ...(goalPillarMap.get(name) || { contributors: [], synthSnippets: [], actions: [], blockers: [] }),
  }));

  return (
    <DashboardClient
      workspace={{
        id: workspace.id,
        name: workspace.name,
        joinCode: workspace.joinCode,
      }}
      weekLabel={windowLabel}
      isCurrentWeek={isCurrentWeek}
      weekPulse={{
        thoughtCount: Number(thoughtsInWindow?.count ?? 0),
        synthesisCount: Number(synthesisInWindow?.count ?? 0),
        avgAlignment: Number(synthesisInWindow?.avgAlignment ?? 0),
        activeTeamCount: Number(activeTeamInWindow?.count ?? 0),
        totalTeamCount: teamMembers.length,
        newActionCount: Number(actionsInWindow?.newCount ?? 0),
        completedActionCount: Number(actionsInWindow?.completedCount ?? 0),
      }}
      digest={
        digest
          ? {
              summary: digest.summary ?? "",
              items: digest.items as Array<{
                rank: number;
                title: string;
                detail: string;
                coachAttribution: string;
                goalPillar: string | null;
                priority: string;
              }>,
            }
          : null
      }
      teamMembers={teamMembers.map((m) => ({
        userId: m.userId,
        name:
          [m.firstName, m.lastName].filter(Boolean).join(" ") || m.email,
        role: m.role,
        streakCount: m.streakCount,
        alignmentScore: m.tractionScore,
        lastCaptureAt: m.lastCaptureAt?.toISOString() ?? null,
        activeThisWeek: m.lastCaptureAt ? m.lastCaptureAt >= windowStart : false,
      }))}
      alignmentTrend={driftTrend
        .map((d) => ({
          alignmentScore: 1 - (d.driftScore ?? 0),
          createdAt: d.createdAt.toISOString(),
        }))
        .reverse()}
      allCoaches={allCoaches}
      currentUserId={session.user.id}
      needsAttention={{
        blockedActions: Number(actionsInWindow?.blockedCount ?? 0),
        unlinkedActions: Number(actionsInWindow?.unlinkedCount ?? 0),
        quietMembers: teamMembers.filter(
          (m) => !m.lastCaptureAt || m.lastCaptureAt < windowStart
        ).length,
      }}
      flowCounts={{
        goals: goalPillarCount,
        thoughts: Number(thoughtsInWindow?.count ?? 0),
        coaches: allCoaches.length,
        synthesis: Number(synthesisInWindow?.count ?? 0),
        actions: Number(actionsInWindow?.newCount ?? 0),
      }}
      hasStrategy={!!canon}
      goalPillars={goalPillars}
    />
  );
}
