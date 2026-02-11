import { db } from "@/lib/db";
import {
  users,
  canons,
  captures,
  artifacts,
  memberships,
  workspaces,
} from "@/lib/db/schema";
import { sql, count, eq, and, gte } from "drizzle-orm";
import Link from "next/link";

interface UserActivation {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: Date;
  hasGoals: boolean;
  hasCapture: boolean;
  hasSynthesis: boolean;
  multiDayUser: boolean;
  invitedTeammate: boolean;
  captureCount: number;
  distinctDays: number;
}

async function getActivationData(days: number) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  // All users in period
  const allUsers = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(gte(users.createdAt, cutoff))
    .orderBy(sql`${users.createdAt} DESC`);

  if (allUsers.length === 0) {
    return {
      totalUsers: 0,
      funnel: { accountCreated: 0, firstGoal: 0, firstCapture: 0, firstSynthesis: 0, secondSession: 0, invitedTeammate: 0 },
      users: [] as UserActivation[],
      stuckUsers: [] as UserActivation[],
    };
  }

  const userIds = allUsers.map((u) => u.id);

  // Users who have set goals (have a canon in any workspace they own)
  const usersWithGoals = await db
    .select({ userId: memberships.userId })
    .from(memberships)
    .innerJoin(canons, eq(canons.workspaceId, memberships.workspaceId))
    .where(sql`${memberships.userId} = ANY(${userIds})`)
    .groupBy(memberships.userId);
  const goalUserIds = new Set(usersWithGoals.map((r) => r.userId));

  // Users who have submitted captures
  const usersWithCaptures = await db
    .select({
      userId: captures.userId,
      captureCount: count(),
      distinctDays: sql<number>`COUNT(DISTINCT DATE(${captures.createdAt}))`,
    })
    .from(captures)
    .where(sql`${captures.userId} = ANY(${userIds})`)
    .groupBy(captures.userId);
  const captureMap = new Map(
    usersWithCaptures.map((r) => [r.userId, { count: Number(r.captureCount), days: Number(r.distinctDays) }])
  );

  // Users who have synthesis (artifacts)
  const usersWithArtifacts = await db
    .select({ userId: captures.userId })
    .from(artifacts)
    .innerJoin(captures, eq(artifacts.captureId, captures.id))
    .where(sql`${captures.userId} = ANY(${userIds})`)
    .groupBy(captures.userId);
  const artifactUserIds = new Set(usersWithArtifacts.map((r) => r.userId));

  // Users who have invited teammates (workspaces with 2+ memberships where they are owner)
  const workspacesWithTeam = await db
    .select({
      ownerId: sql<string>`(
        SELECT m2.user_id FROM memberships m2
        WHERE m2.workspace_id = ${memberships.workspaceId} AND m2.role = 'owner'
        LIMIT 1
      )`,
    })
    .from(memberships)
    .groupBy(memberships.workspaceId)
    .having(sql`count(*) >= 2`);
  const teamOwnerIds = new Set(
    workspacesWithTeam.map((r) => r.ownerId).filter(Boolean)
  );

  // Build user activation list
  const userActivations: UserActivation[] = allUsers.map((user) => {
    const captureInfo = captureMap.get(user.id);
    return {
      ...user,
      hasGoals: goalUserIds.has(user.id),
      hasCapture: (captureInfo?.count || 0) > 0,
      hasSynthesis: artifactUserIds.has(user.id),
      multiDayUser: (captureInfo?.days || 0) >= 2,
      invitedTeammate: teamOwnerIds.has(user.id),
      captureCount: captureInfo?.count || 0,
      distinctDays: captureInfo?.days || 0,
    };
  });

  // Funnel counts
  const funnel = {
    accountCreated: allUsers.length,
    firstGoal: userActivations.filter((u) => u.hasGoals).length,
    firstCapture: userActivations.filter((u) => u.hasCapture).length,
    firstSynthesis: userActivations.filter((u) => u.hasSynthesis).length,
    secondSession: userActivations.filter((u) => u.multiDayUser).length,
    invitedTeammate: userActivations.filter((u) => u.invitedTeammate).length,
  };

  // Stuck users: signed up 3+ days ago, haven't completed onboarding milestones
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const stuckUsers = userActivations.filter(
    (u) => u.createdAt < threeDaysAgo && (!u.hasGoals || !u.hasCapture || !u.hasSynthesis)
  );

  return {
    totalUsers: allUsers.length,
    funnel,
    users: userActivations,
    stuckUsers,
  };
}

function FunnelBar({ label, value, max, prevValue }: { label: string; value: number; max: number; prevValue?: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const dropOff = prevValue !== undefined && prevValue > 0 ? prevValue - value : 0;

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-xs tracking-wider text-foreground">{label}</span>
        <div className="flex items-center gap-3">
          {dropOff > 0 && (
            <span className="font-mono text-[10px] text-destructive/70">-{dropOff} dropped</span>
          )}
          <span className="font-mono text-xs text-muted">{value}</span>
        </div>
      </div>
      <div className="w-full h-6 bg-border/30 rounded overflow-hidden">
        <div
          className="h-full bg-primary/80 rounded transition-all"
          style={{ width: `${Math.max(pct, 1)}%` }}
        />
      </div>
      <p className="font-mono text-[10px] text-muted mt-0.5">{pct}% of total</p>
    </div>
  );
}

function MilestoneCheck({ done }: { done: boolean }) {
  return (
    <span
      className={`inline-block w-5 h-5 rounded text-center leading-5 font-mono text-[10px] font-bold ${
        done ? "bg-success/20 text-success" : "bg-border/30 text-muted/30"
      }`}
    >
      {done ? "✓" : "·"}
    </span>
  );
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default async function ActivationPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days = "30" } = await searchParams;
  const daysNum = parseInt(days) || 30;
  const data = await getActivationData(daysNum);

  return (
    <div className="max-w-[1100px]">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-xl font-bold tracking-wider text-foreground uppercase">
          Activation Funnel
        </h1>
        <p className="font-mono text-xs text-muted mt-1">
          Who is actually getting value? -- {data.totalUsers} users in last {daysNum}d
        </p>
      </div>

      {/* Period Selector */}
      <div className="flex gap-2 mb-6">
        {["7", "30", "90"].map((d) => (
          <Link
            key={d}
            href={`/admin/activation?days=${d}`}
            className={`px-3 py-1.5 rounded font-mono text-xs tracking-wider transition-colors ${
              days === d
                ? "bg-primary/10 text-primary border border-primary/20"
                : "bg-panel border border-border text-muted hover:text-foreground"
            }`}
          >
            {d}D
          </Link>
        ))}
      </div>

      {/* Funnel */}
      <div className="bg-panel border border-border rounded-lg p-6 mb-6">
        <p className="font-mono text-[10px] tracking-widest text-muted uppercase mb-4">
          ACTIVATION MILESTONES
        </p>
        <FunnelBar label="ACCOUNT CREATED" value={data.funnel.accountCreated} max={data.funnel.accountCreated} />
        <FunnelBar label="FIRST GOAL SET" value={data.funnel.firstGoal} max={data.funnel.accountCreated} prevValue={data.funnel.accountCreated} />
        <FunnelBar label="FIRST THOUGHT SUBMITTED" value={data.funnel.firstCapture} max={data.funnel.accountCreated} prevValue={data.funnel.firstGoal} />
        <FunnelBar label="FIRST SYNTHESIS RECEIVED" value={data.funnel.firstSynthesis} max={data.funnel.accountCreated} prevValue={data.funnel.firstCapture} />
        <FunnelBar label="SECOND SESSION (2+ DAYS)" value={data.funnel.secondSession} max={data.funnel.accountCreated} prevValue={data.funnel.firstSynthesis} />
        <FunnelBar label="INVITED A TEAMMATE" value={data.funnel.invitedTeammate} max={data.funnel.accountCreated} prevValue={data.funnel.secondSession} />
      </div>

      {/* Stuck Users Alert */}
      {data.stuckUsers.length > 0 && (
        <div className="bg-warning/5 border border-warning/30 rounded-lg p-4 mb-6">
          <p className="font-mono text-xs tracking-wider text-warning font-bold mb-2">
            {data.stuckUsers.length} STUCK USERS (signed up 3+ days ago, incomplete activation)
          </p>
          <div className="space-y-1">
            {data.stuckUsers.slice(0, 10).map((user) => (
              <div key={user.id} className="flex items-center gap-3">
                <span className="font-mono text-xs text-foreground">{user.email}</span>
                <span className="font-mono text-[10px] text-muted">
                  {!user.hasGoals ? "no goals" : !user.hasCapture ? "no captures" : "no synthesis"}
                </span>
                <span className="font-mono text-[10px] text-muted/50">{timeAgo(user.createdAt)}</span>
              </div>
            ))}
            {data.stuckUsers.length > 10 && (
              <p className="font-mono text-[10px] text-muted">
                +{data.stuckUsers.length - 10} more
              </p>
            )}
          </div>
        </div>
      )}

      {/* User Activation Table */}
      <div className="bg-panel border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
            USER ACTIVATION DETAIL
          </p>
        </div>

        {/* Header */}
        <div className="grid grid-cols-[1fr_60px_60px_60px_60px_60px_70px_80px] gap-1 px-4 py-2 border-b border-border text-muted">
          <span className="font-mono text-[10px] tracking-widest uppercase">USER</span>
          <span className="font-mono text-[10px] tracking-widest uppercase text-center">GOALS</span>
          <span className="font-mono text-[10px] tracking-widest uppercase text-center">CAPT</span>
          <span className="font-mono text-[10px] tracking-widest uppercase text-center">SYNTH</span>
          <span className="font-mono text-[10px] tracking-widest uppercase text-center">2+D</span>
          <span className="font-mono text-[10px] tracking-widest uppercase text-center">TEAM</span>
          <span className="font-mono text-[10px] tracking-widest uppercase text-center">CAPTURES</span>
          <span className="font-mono text-[10px] tracking-widest uppercase text-right">JOINED</span>
        </div>

        {data.users.length === 0 && (
          <div className="px-4 py-6 text-center">
            <p className="font-mono text-sm text-muted">No users in this period</p>
          </div>
        )}

        {data.users.map((user) => (
          <div
            key={user.id}
            className="grid grid-cols-[1fr_60px_60px_60px_60px_60px_70px_80px] gap-1 px-4 py-2 border-b border-border/50 hover:bg-white/2 transition-colors"
          >
            <div className="min-w-0">
              <p className="font-mono text-xs text-foreground truncate">{user.email}</p>
            </div>
            <div className="flex justify-center"><MilestoneCheck done={user.hasGoals} /></div>
            <div className="flex justify-center"><MilestoneCheck done={user.hasCapture} /></div>
            <div className="flex justify-center"><MilestoneCheck done={user.hasSynthesis} /></div>
            <div className="flex justify-center"><MilestoneCheck done={user.multiDayUser} /></div>
            <div className="flex justify-center"><MilestoneCheck done={user.invitedTeammate} /></div>
            <p className="font-mono text-[10px] text-muted text-center self-center">
              {user.captureCount} ({user.distinctDays}d)
            </p>
            <p className="font-mono text-[10px] text-muted text-right self-center">
              {timeAgo(user.createdAt)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
