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
import Link from "next/link";

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
      .where(sql`${captures.workspaceId} = ANY(${allWsIds})`)
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
      .where(sql`${memberships.workspaceId} = ANY(${allWsIds})`)
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
          sql`${captures.workspaceId} = ANY(${allWsIds})`,
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
          sql`${users.organizationId} = ANY(${orgIds})`,
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
      .where(sql`${users.organizationId} = ANY(${orgIds})`)
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
      .where(sql`${workspaces.organizationId} = ANY(${orgIds})`)
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
      .where(sql`${workspaces.organizationId} = ANY(${orgIds})`)
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

function AdoptionBar({ rate }: { rate: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-2 bg-border/30 rounded overflow-hidden">
        <div
          className={`h-full rounded ${
            rate >= 70 ? "bg-success" : rate >= 30 ? "bg-warning" : "bg-destructive"
          }`}
          style={{ width: `${Math.max(rate, 2)}%` }}
        />
      </div>
      <span className={`font-mono text-[10px] font-bold ${
        rate >= 70 ? "text-success" : rate >= 30 ? "text-warning" : "text-destructive"
      }`}>
        {rate}%
      </span>
    </div>
  );
}

function timeAgo(date: Date | null): string {
  if (!date) return "never";
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default async function OrgsPage() {
  const { orgs, workspacesByOrg } = await getOrgData();

  const totalOrgs = orgs.length;
  const activeOrgs = orgs.filter((o) => o.activeUsers7d > 0).length;
  const totalUsersAcrossOrgs = orgs.reduce((s, o) => s + o.userCount, 0);

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

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-panel border border-border rounded-lg p-4">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">TOTAL ORGS</p>
          <p className="font-display text-2xl font-bold text-foreground">{totalOrgs}</p>
        </div>
        <div className="bg-panel border border-border rounded-lg p-4">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">ACTIVE ORGS (7D)</p>
          <p className={`font-display text-2xl font-bold ${activeOrgs > 0 ? "text-success" : "text-muted"}`}>
            {activeOrgs}
          </p>
        </div>
        <div className="bg-panel border border-border rounded-lg p-4">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">TOTAL USERS</p>
          <p className="font-display text-2xl font-bold text-foreground">{totalUsersAcrossOrgs}</p>
        </div>
        <div className="bg-panel border border-border rounded-lg p-4">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">ORG ACTIVATION</p>
          <p className={`font-display text-2xl font-bold ${
            totalOrgs > 0 && activeOrgs / totalOrgs >= 0.5 ? "text-success" : "text-warning"
          }`}>
            {totalOrgs > 0 ? Math.round((activeOrgs / totalOrgs) * 100) : 0}%
          </p>
        </div>
      </div>

      {/* Organization List */}
      {orgs.map((org) => {
        const orgWorkspaces: WorkspaceDetail[] = workspacesByOrg.get(org.id) || [];
        return (
          <div key={org.id} className="bg-panel border border-border rounded-lg mb-4 overflow-hidden">
            {/* Org Header */}
            <div className="px-5 py-4 border-b border-border">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-mono text-sm font-bold text-foreground tracking-wider">
                    {org.name}
                  </h3>
                  {org.domain && (
                    <p className="font-mono text-[10px] text-primary">{org.domain}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-mono text-[10px] text-muted">
                    Last activity: {timeAgo(org.lastActivityAt)}
                  </p>
                  <p className="font-mono text-[10px] text-muted/50">
                    Created: {org.createdAt.toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Org Metrics */}
              <div className="grid grid-cols-3 md:grid-cols-7 gap-3 mt-3">
                <div>
                  <p className="font-mono text-[10px] text-muted uppercase">USERS</p>
                  <p className="font-mono text-sm text-foreground font-bold">{org.userCount}</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] text-muted uppercase">ACTIVE (7D)</p>
                  <p className={`font-mono text-sm font-bold ${org.activeUsers7d > 0 ? "text-success" : "text-muted/50"}`}>
                    {org.activeUsers7d}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[10px] text-muted uppercase">WORKSPACES</p>
                  <p className="font-mono text-sm text-foreground font-bold">{org.workspaceCount}</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] text-muted uppercase">CAPTURES</p>
                  <p className="font-mono text-sm text-foreground font-bold">{org.totalCaptures}</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] text-muted uppercase">ARTIFACTS</p>
                  <p className="font-mono text-sm text-foreground font-bold">{org.totalArtifacts}</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] text-muted uppercase">ACTIONS</p>
                  <p className="font-mono text-sm text-foreground font-bold">{org.totalActions}</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] text-muted uppercase">ADOPTION</p>
                  <AdoptionBar rate={org.adoptionRate} />
                </div>
              </div>
            </div>

            {/* Workspace Breakdown */}
            {orgWorkspaces.length > 0 && (
              <div>
                <div className="grid grid-cols-[1fr_80px_80px_80px_80px_100px] gap-2 px-5 py-2 border-b border-border/50 text-muted">
                  <span className="font-mono text-[10px] tracking-widest uppercase">WORKSPACE</span>
                  <span className="font-mono text-[10px] tracking-widest uppercase text-center">MEMBERS</span>
                  <span className="font-mono text-[10px] tracking-widest uppercase text-center">ACTIVE</span>
                  <span className="font-mono text-[10px] tracking-widest uppercase text-center">CAPTURES</span>
                  <span className="font-mono text-[10px] tracking-widest uppercase text-center">COVERAGE</span>
                  <span className="font-mono text-[10px] tracking-widest uppercase text-right">LAST ACTIVE</span>
                </div>
                {orgWorkspaces.map((ws) => (
                  <div
                    key={ws.id}
                    className="grid grid-cols-[1fr_80px_80px_80px_80px_100px] gap-2 px-5 py-2 border-b border-border/30 hover:bg-white/2 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-foreground truncate">{ws.name}</p>
                      <p className="font-mono text-[10px] text-muted/50">{ws.joinCode}</p>
                    </div>
                    <p className="font-mono text-xs text-muted text-center self-center">{ws.memberCount}</p>
                    <p className={`font-mono text-xs text-center self-center ${ws.activeMemberCount7d > 0 ? "text-success" : "text-muted/50"}`}>
                      {ws.activeMemberCount7d}
                    </p>
                    <p className="font-mono text-xs text-muted text-center self-center">{ws.captureCount}</p>
                    <div className="flex justify-center self-center">
                      <AdoptionBar rate={ws.coverageRate} />
                    </div>
                    <p className="font-mono text-[10px] text-muted text-right self-center">
                      {timeAgo(ws.lastCaptureAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {orgs.length === 0 && (
        <div className="bg-panel border border-border rounded-lg p-8 text-center">
          <p className="font-mono text-sm text-muted">No organizations yet</p>
        </div>
      )}
    </div>
  );
}
