import { db } from "@/lib/db";
import { users, organizations, workspaces, memberships, conversations, messages, usageLogs } from "@/lib/db/schema";
import { count, sql } from "drizzle-orm";

async function getOverviewStats() {
  const [userCount] = await db.select({ count: count() }).from(users);
  const [orgCount] = await db.select({ count: count() }).from(organizations);
  const [workspaceCount] = await db.select({ count: count() }).from(workspaces);
  const [membershipCount] = await db.select({ count: count() }).from(memberships);
  const [conversationCount] = await db.select({ count: count() }).from(conversations);
  const [messageCount] = await db.select({ count: count() }).from(messages);

  // Total AI spend
  const [costResult] = await db
    .select({ total: sql<number>`COALESCE(SUM(${usageLogs.estimatedCostCents}), 0)` })
    .from(usageLogs);

  // Users signed up in last 7 days
  const [recentUsers] = await db
    .select({ count: count() })
    .from(users)
    .where(sql`${users.createdAt} > NOW() - INTERVAL '7 days'`);

  // Conversations in last 7 days
  const [recentConversations] = await db
    .select({ count: count() })
    .from(conversations)
    .where(sql`${conversations.createdAt} > NOW() - INTERVAL '7 days'`);

  return {
    users: userCount.count,
    orgs: orgCount.count,
    workspaces: workspaceCount.count,
    memberships: membershipCount.count,
    conversations: conversationCount.count,
    messages: messageCount.count,
    totalCostCents: Number(costResult.total),
    recentUsers: recentUsers.count,
    recentConversations: recentConversations.count,
  };
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-panel border border-border rounded-lg p-5">
      <p className="font-mono text-[10px] tracking-widest text-muted uppercase mb-2">
        {label}
      </p>
      <p className="font-display text-2xl font-bold text-foreground">{value}</p>
      {sub && (
        <p className="font-mono text-xs text-muted mt-1">{sub}</p>
      )}
    </div>
  );
}

export default async function AdminOverviewPage() {
  const stats = await getOverviewStats();

  return (
    <div className="max-w-[1100px]">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-xl font-bold tracking-wider text-foreground uppercase">
          Control Center
        </h1>
        <p className="font-mono text-xs text-muted mt-1">
          Platform overview -- everything at a glance
        </p>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Users" value={stats.users} sub={`+${stats.recentUsers} last 7d`} />
        <StatCard label="Organizations" value={stats.orgs} />
        <StatCard label="Workspaces" value={stats.workspaces} />
        <StatCard label="Memberships" value={stats.memberships} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <StatCard label="Conversations" value={stats.conversations} sub={`+${stats.recentConversations} last 7d`} />
        <StatCard label="Messages" value={stats.messages} />
        <StatCard
          label="AI Spend"
          value={`$${(stats.totalCostCents / 100).toFixed(2)}`}
          sub="all time"
        />
      </div>

      {/* Funnel Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickLink
          href="/admin/acquisition"
          title="ACQUISITION"
          description="Sign-up funnel, conversion rates, drop-off analysis"
        />
        <QuickLink
          href="/admin/activation"
          title="ACTIVATION"
          description="Who is getting value? Milestone tracking, stuck users"
        />
        <QuickLink
          href="/admin/retention"
          title="RETENTION"
          description="Cohort analysis, DAU/WAU/MAU, streak distribution"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <QuickLink
          href="/admin/errors"
          title="ERRORS"
          description="Platform errors, failed operations, user pain points"
        />
        <QuickLink
          href="/admin/orgs"
          title="ORG DIFFUSION"
          description="Organization adoption, workspace coverage, team health"
        />
      </div>
    </div>
  );
}

function QuickLink({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <a
      href={href}
      className="block bg-panel border border-border rounded-lg p-5 hover:border-primary/40 transition-colors group"
    >
      <p className="font-mono text-xs tracking-wider text-primary group-hover:text-primary mb-1">
        {title} →
      </p>
      <p className="font-body text-sm text-muted">{description}</p>
    </a>
  );
}
