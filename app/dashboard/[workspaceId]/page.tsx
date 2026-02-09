import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, desc, sql as dsql } from "drizzle-orm";
import {
  canons,
  artifacts,
  captures,
  memberships,
  users,
  workspaces,
  protocols,
  actions,
} from "@/lib/db/schema";
import { DashboardClient } from "./dashboard-client";

const sqlFn = neon(process.env.DATABASE_URL!);
const db = drizzle(sqlFn);

export default async function WorkspaceDashboard({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const { workspaceId } = await params;

  // Fetch workspace
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!workspace) redirect("/dashboard");

  // Latest Canon
  const [canon] = await db
    .select()
    .from(canons)
    .where(eq(canons.workspaceId, workspaceId))
    .orderBy(desc(canons.createdAt))
    .limit(1);

  // Check if this is a brand-new workspace (no canon AND no artifacts)
  // If so, redirect to the welcome/onboarding flow
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

  // Recent artifacts (with captures for user info)
  const recentArtifacts = await db
    .select({
      artifactId: artifacts.id,
      driftScore: artifacts.driftScore,
      sentimentScore: artifacts.sentimentScore,
      content: artifacts.content,
      actionItems: artifacts.actionItems,
      createdAt: artifacts.createdAt,
      captureContent: captures.content,
      userId: captures.userId,
    })
    .from(artifacts)
    .innerJoin(captures, eq(artifacts.captureId, captures.id))
    .where(eq(captures.workspaceId, workspaceId))
    .orderBy(desc(artifacts.createdAt))
    .limit(10);

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

  // Get drift trend (last 20 artifacts)
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

  // Active protocol
  let activeProtocol: { id: string; name: string; description: string | null } | null = null;
  if (workspace.activeProtocolId) {
    const [p] = await db
      .select({ id: protocols.id, name: protocols.name, description: protocols.description })
      .from(protocols)
      .where(eq(protocols.id, workspace.activeProtocolId))
      .limit(1);
    if (p) activeProtocol = p;
  }

  // All public coaches
  const allCoaches = await db
    .select({ id: protocols.id, name: protocols.name })
    .from(protocols)
    .where(eq(protocols.isPublic, true));

  // Action counts
  const [actionCounts] = await db
    .select({
      openCount: dsql<number>`count(*) filter (where ${actions.status} in ('open', 'in_progress', 'blocked'))`,
      unlinkedCount: dsql<number>`count(*) filter (where ${actions.goalId} is null and ${actions.status} in ('open', 'in_progress', 'blocked'))`,
    })
    .from(actions)
    .where(eq(actions.workspaceId, workspaceId));

  return (
    <DashboardClient
      workspace={{
        id: workspace.id,
        name: workspace.name,
        joinCode: workspace.joinCode,
      }}
      strategy={
        canon
          ? {
              id: canon.id,
              content: canon.content,
              createdAt: canon.createdAt.toISOString(),
            }
          : null
      }
      recentArtifacts={recentArtifacts.map((a) => ({
        id: a.artifactId,
        alignmentScore: 1 - (a.driftScore ?? 0),
        sentimentScore: a.sentimentScore ?? 0,
        content: a.content ?? "",
        actionItemCount: Array.isArray(a.actionItems)
          ? (a.actionItems as unknown[]).length
          : 0,
        createdAt: a.createdAt.toISOString(),
        userId: a.userId,
      }))}
      teamMembers={teamMembers.map((m) => ({
        userId: m.userId,
        name:
          [m.firstName, m.lastName].filter(Boolean).join(" ") || m.email,
        role: m.role,
        streakCount: m.streakCount,
        alignmentScore: m.tractionScore,
        lastCaptureAt: m.lastCaptureAt?.toISOString() ?? null,
      }))}
      alignmentTrend={driftTrend
        .map((d) => ({
          alignmentScore: 1 - (d.driftScore ?? 0),
          createdAt: d.createdAt.toISOString(),
        }))
        .reverse()}
      activeProtocol={activeProtocol}
      allCoaches={allCoaches}
      currentUserId={session.user.id}
      openActionCount={Number(actionCounts?.openCount ?? 0)}
      unlinkedActionCount={Number(actionCounts?.unlinkedCount ?? 0)}
    />
  );
}
