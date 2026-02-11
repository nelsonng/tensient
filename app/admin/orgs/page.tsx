import { db } from "@/lib/db";
import {
  organizations,
  users,
  workspaces,
  memberships,
  captures,
  artifacts,
  actions,
} from "@/lib/db/schema";
import { sql, count, eq, and, gte, desc, inArray } from "drizzle-orm";
import { OrgsClient } from "./orgs-client";

interface OrgSummary {
  id: string;
  name: string;
  domain: string | null;
  createdAt: Date;
  userCount: number;
  workspaceCount: number;
  activeUsers7d: number;
  totalCaptures: number;
  totalArtifacts: number;
  totalActions: number;
  adoptionRate: number; // % of users who have submitted 1+ capture
  lastActivityAt: Date | null;
}

interface WorkspaceDetail {
  id: string;
  name: string;
  orgId: string;
  joinCode: string;
  memberCount: number;
  captureCount: number;
  activeMemberCount7d: number;
  coverageRate: number; // % of members actively contributing
  lastCaptureAt: Date | null;
}

async function getOrgData() {
  // All organizations with user counts
  const orgList = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      domain: organizations.domain,
      createdAt: organizations.createdAt,
    })
    .from(organizations)
    .orderBy(desc(organizations.createdAt));

  if (orgList.length === 0) {
    return { orgs: [], workspacesByOrg: new Map() };
  }

  const orgIds = orgList.map((o) => o.id);

  // Users per org
  const usersByOrg = await db
    .select({
      orgId: users.organizationId,
      userCount: count(),
    })
    .from(users)
    .where(inArray(users.organizationId, orgIds))
    .groupBy(users.organizationId);
  const userCountMap = new Map(
    usersByOrg.map((r) => [r.orgId, Number(r.userCount)])
  );

  // Workspaces per org
  const workspacesByOrg = await db
    .select({
      orgId: workspaces.organizationId,
      wsCount: count(),
    })
    .from(workspaces)
    .where(inArray(workspaces.organizationId, orgIds))
    .groupBy(workspaces.organizationId);
  const wsCountMap = new Map(
    workspacesByOrg.map((r) => [r.orgId, Number(r.wsCount)])
  );

  // Get all workspace IDs per org
  const allWorkspaces = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      orgId: workspaces.organizationId,
      joinCode: workspaces.joinCode,
    })
    .from(workspaces)
    .where(inArray(workspaces.organizationId, orgIds));

  const allWsIds = allWorkspaces.map((w) => w.id);

  // Capture counts per workspace
  let capturesByWs = new Map<string, number>();
  let lastCaptureByWs = new Map<string, Date>();
  if (allWsIds.length > 0) {
    const captureCounts = await db
      .select({
        wsId: captures.workspaceId,
        captureCount: count(),
        lastCapture: sql<Date>`MAX(${captures.createdAt})`,
      })
      .from(captures)
      .where(inArray(captures.workspaceId, allWsIds))
      .groupBy(captures.workspaceId);
    capturesByWs = new Map(captureCounts.map((r) => [r.wsId, Number(r.captureCount)]));
    lastCaptureByWs = new Map(
      captureCounts.map((r) => [r.wsId, r.lastCapture ? new Date(r.lastCapture) : new Date(0)])
    );
  }

  // Members per workspace
  let membersByWs = new Map<string, number>();
  if (allWsIds.length > 0) {
    const memberCounts = await db
      .select({
        wsId: memberships.workspaceId,
        memberCount: count(),
      })
      .from(memberships)
      .where(inArray(memberships.workspaceId, allWsIds))
      .groupBy(memberships.workspaceId);
    membersByWs = new Map(memberCounts.map((r) => [r.wsId, Number(r.memberCount)]));
  }

  // Active users per workspace (last 7d)
  let activeByWs = new Map<string, number>();
  if (allWsIds.length > 0) {
    const activeUsers = await db
      .select({
        wsId: captures.workspaceId,
        activeCount: sql<number>`COUNT(DISTINCT ${captures.userId})`,
      })
      .from(captures)
      .where(
        and(
          inArray(captures.workspaceId, allWsIds),
          gte(captures.createdAt, sql`NOW() - INTERVAL '7 days'`)
        )
      )
      .groupBy(captures.workspaceId);
    activeByWs = new Map(activeUsers.map((r) => [r.wsId, Number(r.activeCount)]));
  }

  // Active users per org (last 7d)
  let activeByOrg = new Map<string, number>();
  if (orgIds.length > 0) {
    const orgActiveUsers = await db
      .select({
        orgId: users.organizationId,
        activeCount: sql<number>`COUNT(DISTINCT ${captures.userId})`,
      })
      .from(captures)
      .innerJoin(users, eq(captures.userId, users.id))
      .where(
        and(
          inArray(users.organizationId, orgIds),
          gte(captures.createdAt, sql`NOW() - INTERVAL '7 days'`)
        )
      )
      .groupBy(users.organizationId);
    activeByOrg = new Map(
      orgActiveUsers.filter((r) => r.orgId != null).map((r) => [r.orgId as string, Number(r.activeCount)])
    );
  }

  // Users with 1+ capture per org (adoption rate)
  let adoptedByOrg = new Map<string, number>();
  if (orgIds.length > 0) {
    const adopted = await db
      .select({
        orgId: users.organizationId,
        adoptedCount: sql<number>`COUNT(DISTINCT ${captures.userId})`,
      })
      .from(captures)
      .innerJoin(users, eq(captures.userId, users.id))
      .where(inArray(users.organizationId, orgIds))
      .groupBy(users.organizationId);
    adoptedByOrg = new Map(
      adopted.filter((r) => r.orgId != null).map((r) => [r.orgId as string, Number(r.adoptedCount)])
    );
  }

  // Artifact counts per org
  let artifactsByOrg = new Map<string, number>();
  if (allWsIds.length > 0) {
    const artifactCounts = await db
      .select({
        orgId: workspaces.organizationId,
        count: count(),
      })
      .from(artifacts)
      .innerJoin(captures, eq(artifacts.captureId, captures.id))
      .innerJoin(workspaces, eq(captures.workspaceId, workspaces.id))
      .where(inArray(workspaces.organizationId, orgIds))
      .groupBy(workspaces.organizationId);
    artifactsByOrg = new Map(artifactCounts.map((r) => [r.orgId, Number(r.count)]));
  }

  // Action counts per org
  let actionsByOrg = new Map<string, number>();
  if (allWsIds.length > 0) {
    const actionCounts = await db
      .select({
        orgId: workspaces.organizationId,
        count: count(),
      })
      .from(actions)
      .innerJoin(workspaces, eq(actions.workspaceId, workspaces.id))
      .where(inArray(workspaces.organizationId, orgIds))
      .groupBy(workspaces.organizationId);
    actionsByOrg = new Map(actionCounts.map((r) => [r.orgId, Number(r.count)]));
  }

  // Build org summaries
  const orgs: OrgSummary[] = orgList.map((org) => {
    const userCount = userCountMap.get(org.id) || 0;
    const adopted = adoptedByOrg.get(org.id) || 0;
    const orgWorkspaces = allWorkspaces.filter((w) => w.orgId === org.id);
    const lastCaptures = orgWorkspaces
      .map((w) => lastCaptureByWs.get(w.id))
      .filter(Boolean) as Date[];
    const lastActivity = lastCaptures.length > 0
      ? new Date(Math.max(...lastCaptures.map((d) => d.getTime())))
      : null;

    return {
      id: org.id,
      name: org.name,
      domain: org.domain,
      createdAt: org.createdAt,
      userCount,
      workspaceCount: wsCountMap.get(org.id) || 0,
      activeUsers7d: activeByOrg.get(org.id) || 0,
      totalCaptures: orgWorkspaces.reduce((sum, w) => sum + (capturesByWs.get(w.id) || 0), 0),
      totalArtifacts: artifactsByOrg.get(org.id) || 0,
      totalActions: actionsByOrg.get(org.id) || 0,
      adoptionRate: userCount > 0 ? Math.round((adopted / userCount) * 100) : 0,
      lastActivityAt: lastActivity,
    };
  });

  // Build workspace details
  const workspaceDetails: WorkspaceDetail[] = allWorkspaces.map((ws) => {
    const members = membersByWs.get(ws.id) || 0;
    const active = activeByWs.get(ws.id) || 0;
    return {
      id: ws.id,
      name: ws.name,
      orgId: ws.orgId,
      joinCode: ws.joinCode,
      memberCount: members,
      captureCount: capturesByWs.get(ws.id) || 0,
      activeMemberCount7d: active,
      coverageRate: members > 0 ? Math.round((active / members) * 100) : 0,
      lastCaptureAt: lastCaptureByWs.get(ws.id) || null,
    };
  });

  const wsMap = new Map<string, WorkspaceDetail[]>();
  for (const ws of workspaceDetails) {
    const existing = wsMap.get(ws.orgId) || [];
    existing.push(ws);
    wsMap.set(ws.orgId, existing);
  }

  // Sort orgs by activity (most active first)
  orgs.sort((a, b) => b.totalCaptures - a.totalCaptures);

  return { orgs, workspacesByOrg: wsMap };
}

export default async function OrgsPage() {
  const { orgs, workspacesByOrg } = await getOrgData();

  // Serialize data for the client component (Dates -> strings)
  const serializedOrgs = JSON.parse(JSON.stringify(orgs));
  const serializedWsByOrg: Record<string, unknown[]> = {};
  for (const [orgId, wsList] of workspacesByOrg.entries()) {
    serializedWsByOrg[orgId] = JSON.parse(JSON.stringify(wsList));
  }

  return (
    <div className="max-w-[1100px]">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-xl font-bold tracking-wider text-foreground uppercase">
          Org Diffusion
        </h1>
        <p className="font-mono text-xs text-muted mt-1">
          Organization and workspace adoption -- build your roadmap here
        </p>
      </div>

      <OrgsClient orgs={serializedOrgs} workspacesByOrg={serializedWsByOrg} />
    </div>
  );
}
