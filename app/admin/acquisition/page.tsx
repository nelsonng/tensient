import { db } from "@/lib/db";
import { users, platformEvents } from "@/lib/db/schema";
import { sql, count, eq, and, gte, isNotNull, inArray } from "drizzle-orm";
import Link from "next/link";

async function getAcquisitionData(days: number) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  // All-time totals for context
  const [totalUsers] = await db.select({ count: count() }).from(users);

  // Period-scoped counts
  const [signedUp] = await db
    .select({ count: count() })
    .from(users)
    .where(gte(users.createdAt, cutoff));

  const [emailVerified] = await db
    .select({ count: count() })
    .from(users)
    .where(and(gte(users.createdAt, cutoff), isNotNull(users.emailVerified)));

  const [onboardStarted] = await db
    .select({ count: count() })
    .from(platformEvents)
    .where(and(eq(platformEvents.type, "onboarding_started"), gte(platformEvents.createdAt, cutoff)));

  const [onboardCompleted] = await db
    .select({ count: count() })
    .from(platformEvents)
    .where(and(eq(platformEvents.type, "onboarding_completed"), gte(platformEvents.createdAt, cutoff)));

  const [signUpFailed] = await db
    .select({ count: count() })
    .from(platformEvents)
    .where(and(eq(platformEvents.type, "sign_up_failed"), gte(platformEvents.createdAt, cutoff)));

  // User-level drill down
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

  // Onboarding events for drill-down users
  const userIds = userDetails.map((u) => u.id);
  let onboardingEvents: { userId: string | null; type: string }[] = [];
  if (userIds.length > 0) {
    onboardingEvents = await db
      .select({
        userId: platformEvents.userId,
        type: platformEvents.type,
      })
      .from(platformEvents)
      .where(
        and(
          inArray(platformEvents.userId, userIds),
          inArray(platformEvents.type, ["onboarding_started", "onboarding_completed"])
        )
      );
  }

  const userMilestones = userDetails.map((user) => {
    const events = onboardingEvents.filter((e) => e.userId === user.id);
    return {
      ...user,
      onboardingStarted: events.some((e) => e.type === "onboarding_started"),
      onboardingCompleted: events.some((e) => e.type === "onboarding_completed"),
    };
  });

  return {
    totalUsers: totalUsers.count,
    funnel: {
      signedUp: signedUp.count,
      emailVerified: emailVerified.count,
      onboardingStarted: onboardStarted.count,
      onboardingCompleted: onboardCompleted.count,
      signUpFailed: signUpFailed.count,
    },
    users: userMilestones,
  };
}

function FunnelBar({ label, value, max, sub }: { label: string; value: number; max: number; sub?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-xs tracking-wider text-foreground">{label}</span>
        <span className="font-mono text-xs text-muted">
          {value} {sub && <span className="text-muted/50">({sub})</span>}
        </span>
      </div>
      <div className="w-full h-6 bg-border/30 rounded overflow-hidden">
        <div
          className="h-full bg-primary/80 rounded transition-all"
          style={{ width: `${Math.max(pct, 1)}%` }}
        />
      </div>
      <p className="font-mono text-[10px] text-muted mt-0.5">{pct}% of top</p>
    </div>
  );
}

function Milestone({ done, label }: { done: boolean; label: string }) {
  return (
    <span
      className={`inline-block w-5 h-5 rounded text-center leading-5 font-mono text-[10px] font-bold ${
        done ? "bg-success/20 text-success" : "bg-border/30 text-muted/30"
      }`}
      title={label}
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

export default async function AcquisitionPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days = "30" } = await searchParams;
  const daysNum = parseInt(days) || 30;
  const data = await getAcquisitionData(daysNum);

  const convRates = {
    signupToVerified:
      data.funnel.signedUp > 0
        ? Math.round((data.funnel.emailVerified / data.funnel.signedUp) * 100)
        : 0,
    verifiedToOnboard:
      data.funnel.emailVerified > 0
        ? Math.round((data.funnel.onboardingStarted / data.funnel.emailVerified) * 100)
        : 0,
    onboardToComplete:
      data.funnel.onboardingStarted > 0
        ? Math.round((data.funnel.onboardingCompleted / data.funnel.onboardingStarted) * 100)
        : 0,
    overallConversion:
      data.funnel.signedUp > 0
        ? Math.round((data.funnel.onboardingCompleted / data.funnel.signedUp) * 100)
        : 0,
  };

  return (
    <div className="max-w-[1100px]">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-xl font-bold tracking-wider text-foreground">
          Acquisition Funnel
        </h1>
        <p className="font-mono text-xs text-muted mt-1">
          {data.totalUsers} total users all-time -- showing last {daysNum} days
        </p>
      </div>

      {/* Period Selector */}
      <div className="flex gap-2 mb-6">
        {["1", "7", "30", "90"].map((d) => (
          <Link
            key={d}
            href={`/admin/acquisition?days=${d}`}
            className={`px-3 py-1.5 rounded font-mono text-xs tracking-wider transition-colors ${
              days === d
                ? "bg-primary/10 text-primary border border-primary/20"
                : "bg-panel border border-border text-muted hover:text-foreground"
            }`}
          >
            {d === "1" ? "TODAY" : `${d}D`}
          </Link>
        ))}
      </div>

      {/* Funnel Visualization */}
      <div className="bg-panel border border-border rounded-lg p-6 mb-6">
        <p className="font-mono text-[10px] tracking-widest text-muted uppercase mb-4">
          FUNNEL ({daysNum}D)
        </p>
        <FunnelBar label="SIGNED UP" value={data.funnel.signedUp} max={data.funnel.signedUp} />
        <FunnelBar
          label="EMAIL VERIFIED"
          value={data.funnel.emailVerified}
          max={data.funnel.signedUp}
          sub={`${convRates.signupToVerified}% conversion`}
        />
        <FunnelBar
          label="ONBOARDING STARTED"
          value={data.funnel.onboardingStarted}
          max={data.funnel.signedUp}
          sub={`${convRates.verifiedToOnboard}% from verified`}
        />
        <FunnelBar
          label="ONBOARDING COMPLETED"
          value={data.funnel.onboardingCompleted}
          max={data.funnel.signedUp}
          sub={`${convRates.onboardToComplete}% from started`}
        />

        {data.funnel.signUpFailed > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="font-mono text-xs text-destructive">
              {data.funnel.signUpFailed} sign-up failures in this period
            </p>
          </div>
        )}
      </div>

      {/* Conversion Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-panel border border-border rounded-lg p-4">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">SIGNUP → VERIFIED</p>
          <p className="font-display text-xl font-bold text-foreground">{convRates.signupToVerified}%</p>
        </div>
        <div className="bg-panel border border-border rounded-lg p-4">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">VERIFIED → ONBOARD</p>
          <p className="font-display text-xl font-bold text-foreground">{convRates.verifiedToOnboard}%</p>
        </div>
        <div className="bg-panel border border-border rounded-lg p-4">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">ONBOARD → COMPLETE</p>
          <p className="font-display text-xl font-bold text-foreground">{convRates.onboardToComplete}%</p>
        </div>
        <div className="bg-panel border border-border rounded-lg p-4">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">OVERALL CONVERSION</p>
          <p className={`font-display text-xl font-bold ${convRates.overallConversion >= 50 ? "text-success" : convRates.overallConversion >= 20 ? "text-warning" : "text-destructive"}`}>
            {convRates.overallConversion}%
          </p>
        </div>
      </div>

      {/* User Drill-Down Table */}
      <div className="bg-panel border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
            USER DRILL-DOWN ({data.users.length} users)
          </p>
        </div>

        {/* Header */}
        <div className="grid grid-cols-[1fr_80px_80px_80px_100px] gap-2 px-4 py-2 border-b border-border text-muted">
          <span className="font-mono text-[10px] tracking-widest uppercase">USER</span>
          <span className="font-mono text-[10px] tracking-widest uppercase text-center">VERIFIED</span>
          <span className="font-mono text-[10px] tracking-widest uppercase text-center">STARTED</span>
          <span className="font-mono text-[10px] tracking-widest uppercase text-center">DONE</span>
          <span className="font-mono text-[10px] tracking-widest uppercase text-right">SIGNED UP</span>
        </div>

        {/* Rows */}
        {data.users.length === 0 && (
          <div className="px-4 py-6 text-center">
            <p className="font-mono text-sm text-muted">No users in this period</p>
          </div>
        )}
        {data.users.map((user) => (
          <div
            key={user.id}
            className="grid grid-cols-[1fr_80px_80px_80px_100px] gap-2 px-4 py-2.5 border-b border-border/50 hover:bg-white/2 transition-colors"
          >
            <div className="min-w-0">
              <p className="font-mono text-xs text-foreground truncate">{user.email}</p>
              {(user.firstName || user.lastName) && (
                <p className="font-mono text-[10px] text-muted truncate">
                  {[user.firstName, user.lastName].filter(Boolean).join(" ")}
                </p>
              )}
            </div>
            <div className="flex justify-center">
              <Milestone done={!!user.emailVerified} label="Email Verified" />
            </div>
            <div className="flex justify-center">
              <Milestone done={user.onboardingStarted} label="Onboarding Started" />
            </div>
            <div className="flex justify-center">
              <Milestone done={user.onboardingCompleted} label="Onboarding Completed" />
            </div>
            <p className="font-mono text-[10px] text-muted text-right self-center">
              {timeAgo(user.createdAt)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
