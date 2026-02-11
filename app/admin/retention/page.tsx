import { db } from "@/lib/db";
import { users, captures, platformEvents } from "@/lib/db/schema";
import { sql, count, gte } from "drizzle-orm";

interface CohortRow {
  cohortWeek: string;
  signups: number;
  retention: number[]; // % active in week 0, 1, 2, ...
}

async function getRetentionData() {
  // Get weekly signup cohorts (last 12 weeks)
  const cohorts = await db
    .select({
      cohortWeek: sql<string>`TO_CHAR(DATE_TRUNC('week', ${users.createdAt}), 'YYYY-MM-DD')`,
      signups: count(),
    })
    .from(users)
    .where(
      sql`${users.createdAt} > NOW() - INTERVAL '12 weeks'`
    )
    .groupBy(sql`DATE_TRUNC('week', ${users.createdAt})`)
    .orderBy(sql`DATE_TRUNC('week', ${users.createdAt})`);

  // Get weekly activity per user (captures as activity signal)
  const weeklyActivity = await db
    .select({
      userId: captures.userId,
      signupWeek: sql<string>`TO_CHAR(DATE_TRUNC('week', u.created_at), 'YYYY-MM-DD')`,
      activityWeek: sql<string>`TO_CHAR(DATE_TRUNC('week', ${captures.createdAt}), 'YYYY-MM-DD')`,
    })
    .from(captures)
    .innerJoin(sql`users u`, sql`u.id = ${captures.userId}`)
    .where(
      sql`u.created_at > NOW() - INTERVAL '12 weeks'`
    )
    .groupBy(
      captures.userId,
      sql`DATE_TRUNC('week', u.created_at)`,
      sql`DATE_TRUNC('week', ${captures.createdAt})`
    );

  // Build cohort retention matrix
  const cohortRows: CohortRow[] = cohorts.map((cohort) => {
    const cohortDate = new Date(cohort.cohortWeek);
    const cohortUsers = new Set(
      weeklyActivity
        .filter((a) => a.signupWeek === cohort.cohortWeek)
        .map((a) => a.userId)
    );

    // For users with NO captures, count them as unretained beyond week 0
    const allCohortSignups = cohort.signups;

    // Calculate retention for each week offset
    const now = new Date();
    const maxWeeks = Math.min(
      12,
      Math.floor((now.getTime() - cohortDate.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
    );

    const retention: number[] = [];
    for (let weekOffset = 0; weekOffset < maxWeeks; weekOffset++) {
      const targetWeek = new Date(cohortDate);
      targetWeek.setDate(targetWeek.getDate() + weekOffset * 7);
      const targetWeekStr = targetWeek.toISOString().split("T")[0];

      // Count users active in this week
      const activeUsers = weeklyActivity.filter(
        (a) => a.signupWeek === cohort.cohortWeek && a.activityWeek === targetWeekStr
      );
      const uniqueActive = new Set(activeUsers.map((a) => a.userId)).size;

      retention.push(
        allCohortSignups > 0 ? Math.round((uniqueActive / allCohortSignups) * 100) : 0
      );
    }

    return {
      cohortWeek: cohort.cohortWeek,
      signups: cohort.signups,
      retention,
    };
  });

  // DAU/WAU/MAU
  const [dau] = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${captures.userId})` })
    .from(captures)
    .where(sql`${captures.createdAt} > NOW() - INTERVAL '1 day'`);

  const [wau] = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${captures.userId})` })
    .from(captures)
    .where(sql`${captures.createdAt} > NOW() - INTERVAL '7 days'`);

  const [mau] = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${captures.userId})` })
    .from(captures)
    .where(sql`${captures.createdAt} > NOW() - INTERVAL '30 days'`);

  const [totalUsers] = await db.select({ count: count() }).from(users);

  // Sign-in events (last 30d)
  const [signIns30d] = await db
    .select({ count: count() })
    .from(platformEvents)
    .where(
      sql`${platformEvents.type} = 'sign_in_success' AND ${platformEvents.createdAt} > NOW() - INTERVAL '30 days'`
    );

  return {
    cohorts: cohortRows,
    dau: Number(dau.count),
    wau: Number(wau.count),
    mau: Number(mau.count),
    totalUsers: totalUsers.count,
    signIns30d: Number(signIns30d.count),
  };
}

function retentionColor(pct: number): string {
  if (pct >= 50) return "bg-success/30 text-success";
  if (pct >= 25) return "bg-warning/20 text-warning";
  if (pct > 0) return "bg-destructive/15 text-destructive";
  return "bg-border/20 text-muted/30";
}

export default async function RetentionPage() {
  const data = await getRetentionData();

  const dauWauRatio = data.wau > 0 ? Math.round((data.dau / data.wau) * 100) : 0;
  const wauMauRatio = data.mau > 0 ? Math.round((data.wau / data.mau) * 100) : 0;

  return (
    <div className="max-w-[1100px]">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-xl font-bold tracking-wider text-foreground uppercase">
          Retention
        </h1>
        <p className="font-mono text-xs text-muted mt-1">
          Weekly cohort retention -- are users coming back?
        </p>
      </div>

      {/* Activity Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-panel border border-border rounded-lg p-4">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">DAU</p>
          <p className="font-display text-2xl font-bold text-foreground">{data.dau}</p>
        </div>
        <div className="bg-panel border border-border rounded-lg p-4">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">WAU</p>
          <p className="font-display text-2xl font-bold text-foreground">{data.wau}</p>
        </div>
        <div className="bg-panel border border-border rounded-lg p-4">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">MAU</p>
          <p className="font-display text-2xl font-bold text-foreground">{data.mau}</p>
        </div>
        <div className="bg-panel border border-border rounded-lg p-4">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">DAU/WAU</p>
          <p className={`font-display text-2xl font-bold ${dauWauRatio >= 30 ? "text-success" : "text-warning"}`}>
            {dauWauRatio}%
          </p>
        </div>
        <div className="bg-panel border border-border rounded-lg p-4">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">SIGN-INS (30D)</p>
          <p className="font-display text-2xl font-bold text-foreground">{data.signIns30d}</p>
        </div>
      </div>

      {/* Cohort Retention Triangle */}
      <div className="bg-panel border border-border rounded-lg p-6 mb-6 overflow-x-auto">
        <p className="font-mono text-[10px] tracking-widest text-muted uppercase mb-4">
          WEEKLY COHORT RETENTION (% active)
        </p>

        {data.cohorts.length === 0 ? (
          <p className="font-mono text-sm text-muted text-center py-8">
            Not enough data yet for cohort analysis
          </p>
        ) : (
          <table className="w-full text-center">
            <thead>
              <tr>
                <th className="font-mono text-[10px] tracking-widest text-muted text-left py-2 px-2 min-w-[100px]">
                  COHORT
                </th>
                <th className="font-mono text-[10px] tracking-widest text-muted py-2 px-1 min-w-[50px]">
                  N
                </th>
                {Array.from({ length: 12 }, (_, i) => (
                  <th
                    key={i}
                    className="font-mono text-[10px] tracking-widest text-muted py-2 px-1 min-w-[44px]"
                  >
                    W{i}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.cohorts.map((cohort) => (
                <tr key={cohort.cohortWeek} className="border-t border-border/30">
                  <td className="font-mono text-[10px] text-foreground text-left py-1.5 px-2">
                    {cohort.cohortWeek}
                  </td>
                  <td className="font-mono text-[10px] text-muted py-1.5 px-1">
                    {cohort.signups}
                  </td>
                  {Array.from({ length: 12 }, (_, i) => (
                    <td key={i} className="py-1.5 px-1">
                      {i < cohort.retention.length ? (
                        <span
                          className={`inline-block w-10 py-0.5 rounded font-mono text-[10px] font-bold ${retentionColor(
                            cohort.retention[i]
                          )}`}
                        >
                          {cohort.retention[i]}%
                        </span>
                      ) : (
                        <span className="inline-block w-10 py-0.5 font-mono text-[10px] text-muted/20">
                          --
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-6">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-success/30" />
          <span className="font-mono text-[10px] text-muted">50%+</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-warning/20" />
          <span className="font-mono text-[10px] text-muted">25-49%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-destructive/15" />
          <span className="font-mono text-[10px] text-muted">1-24%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-border/20" />
          <span className="font-mono text-[10px] text-muted">0%</span>
        </div>
      </div>
    </div>
  );
}
