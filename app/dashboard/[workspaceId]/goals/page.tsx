import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { canons, workspaces } from "@/lib/db/schema";
import { getWorkspaceMembership } from "@/lib/auth/workspace-access";
import { PanelCard } from "@/components/panel-card";
import { MonoLabel } from "@/components/mono-label";
import { SlantedButton } from "@/components/slanted-button";

function SmartBadges({ smart }: { smart: Record<string, boolean> }) {
  const labels: Record<string, string> = {
    specific: "S",
    measurable: "M",
    achievable: "A",
    relevant: "R",
    timeBound: "T",
  };
  return (
    <span className="inline-flex gap-1">
      {Object.entries(labels).map(([key, letter]) => (
        <span
          key={key}
          className={`inline-block w-5 h-5 text-center leading-5 rounded font-mono text-xs ${
            smart[key]
              ? "bg-primary/20 text-primary"
              : "bg-border/30 text-muted"
          }`}
          title={`${key}: ${smart[key] ? "yes" : "needs work"}`}
        >
          {letter}
        </span>
      ))}
    </span>
  );
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function GoalsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const { workspaceId } = await params;

  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) redirect("/dashboard");

  const [workspace] = await db
    .select({ id: workspaces.id, name: workspaces.name })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!workspace) redirect("/dashboard");

  const allCanons = await db
    .select({
      id: canons.id,
      content: canons.content,
      rawInput: canons.rawInput,
      healthScore: canons.healthScore,
      healthAnalysis: canons.healthAnalysis,
      createdAt: canons.createdAt,
    })
    .from(canons)
    .where(eq(canons.workspaceId, workspaceId))
    .orderBy(desc(canons.createdAt));

  // Goal health from latest canon
  const latestCanon = allCanons[0] ?? null;
  const goalHealth =
    latestCanon?.healthScore != null && latestCanon?.healthAnalysis
      ? {
          overallScore: latestCanon.healthScore,
          analysis: latestCanon.healthAnalysis as {
            overallScore: number;
            pillars: Array<{
              title: string;
              score: number;
              smart: Record<string, boolean>;
              suggestion: string;
            }>;
          },
        }
      : null;

  return (
    <div className="mx-auto max-w-[1000px] px-6 pb-24">
      <div className="flex items-center justify-between mb-8">
        <div>
          <MonoLabel className="mb-2 block text-primary">GOALS</MonoLabel>
          <h1 className="font-display text-2xl font-bold uppercase tracking-tight">
            Team Goals
          </h1>
          <p className="font-body text-base text-muted mt-2">
            Your strategic direction. Each version captures a moment in time.
          </p>
        </div>
        <SlantedButton href={`/dashboard/${workspaceId}/strategy`}>
          + SET GOALS
        </SlantedButton>
      </div>

      {/* Goal Health Analysis */}
      {goalHealth && (
        <PanelCard className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <MonoLabel className="text-primary">GOAL HEALTH</MonoLabel>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-primary">
                {Math.round(goalHealth.overallScore * 100)}%
              </span>
              <span className="font-mono text-xs text-muted">SMART score</span>
            </div>
          </div>
          <div className="w-full h-2 bg-border rounded-full mb-5 overflow-hidden">
            <div
              className="h-full bg-primary rounded-full"
              style={{ width: `${goalHealth.overallScore * 100}%` }}
            />
          </div>
          <div className="space-y-3">
            {goalHealth.analysis.pillars.map((pillar, i) => (
              <div key={i} className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-body text-sm text-foreground">
                      {pillar.title}
                    </span>
                    <SmartBadges smart={pillar.smart} />
                  </div>
                  <p className="font-mono text-xs text-muted leading-relaxed">
                    {pillar.suggestion}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </PanelCard>
      )}

      {allCanons.length === 0 ? (
        <PanelCard className="text-center py-12">
          <p className="font-body text-base text-muted mb-4">
            No goals set yet. Set your first goals to define your team&apos;s direction.
          </p>
          <SlantedButton href={`/dashboard/${workspaceId}/strategy`}>
            SET GOALS
          </SlantedButton>
        </PanelCard>
      ) : (
        <div className="space-y-4">
          {allCanons.map((canon, i) => (
            <PanelCard key={canon.id}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <MonoLabel className={i === 0 ? "text-primary" : "text-muted"}>
                    {i === 0 ? "CURRENT" : `V${allCanons.length - i}`}
                  </MonoLabel>
                  <span className="font-mono text-xs text-muted">
                    {timeAgo(canon.createdAt)}
                  </span>
                </div>
              </div>
              <p className="font-body text-base leading-relaxed text-foreground whitespace-pre-wrap">
                {canon.content}
              </p>
              {canon.rawInput && (
                <details className="mt-4">
                  <summary className="font-mono text-xs text-muted cursor-pointer hover:text-foreground transition-colors">
                    SHOW RAW INPUT
                  </summary>
                  <p className="font-body text-sm text-muted mt-2 leading-relaxed whitespace-pre-wrap border-l-2 border-border pl-4">
                    {canon.rawInput}
                  </p>
                </details>
              )}
            </PanelCard>
          ))}
        </div>
      )}
    </div>
  );
}
