"use client";

import Link from "next/link";
import { PanelCard } from "@/components/panel-card";
import { MonoLabel } from "@/components/mono-label";
import { SlantedButton } from "@/components/slanted-button";

// ── Types ────────────────────────────────────────────────────────────────

interface DigestItem {
  rank: number;
  title: string;
  detail: string;
  goalPillar: string | null;
  priority: string;
}

interface DashboardProps {
  workspace: { id: string; name: string; joinCode: string };
  weekLabel: string;
  isCurrentWeek: boolean;
  weekPulse: {
    thoughtCount: number;
    synthesisCount: number;
    avgAlignment: number;
    activeTeamCount: number;
    totalTeamCount: number;
    newActionCount: number;
    completedActionCount: number;
  };
  digest: {
    summary: string;
    items: DigestItem[];
  } | null;
  teamMembers: Array<{
    userId: string;
    name: string;
    role: string;
    streakCount: number;
    alignmentScore: number;
    lastCaptureAt: string | null;
    activeThisWeek: boolean;
  }>;
  alignmentTrend: Array<{
    alignmentScore: number;
    createdAt: string;
  }>;
  allCoaches: Array<{ id: string; name: string }>;
  currentUserId: string;
  needsAttention: {
    blockedActions: number;
    unlinkedActions: number;
    quietMembers: number;
  };
  flowCounts: {
    goals: number;
    thoughts: number;
    coaches: number;
    synthesis: number;
    actions: number;
  };
  hasStrategy: boolean;
  goalPillars: Array<{
    name: string;
    contributors: string[];
    synthSnippets: string[];
    actions: Array<{ title: string; status: string; priority: string }>;
    blockers: string[];
  }>;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function getPriorityColor(priority: string): string {
  if (priority === "critical") return "text-destructive";
  if (priority === "high") return "text-warning";
  return "text-muted";
}

// ── Main Component ───────────────────────────────────────────────────────

export function DashboardClient({
  workspace,
  weekLabel,
  isCurrentWeek,
  digest,
  teamMembers,
  currentUserId,
  hasStrategy,
  goalPillars,
}: DashboardProps) {
  const basePath = `/dashboard/${workspace.id}`;

  return (
    <div className="mx-auto max-w-[1200px] px-6 pb-24">
      {/* Week Header */}
      <div className="flex items-center gap-3 mb-8">
        {!isCurrentWeek && (
          <span className="font-mono text-xs text-warning border border-warning/30 px-1.5 py-0.5 rounded">
            LATEST
          </span>
        )}
        <MonoLabel className="text-primary text-base">
          WEEK OF {weekLabel.toUpperCase()}
        </MonoLabel>
      </div>

      {!hasStrategy ? (
        <PanelCard className="text-center py-12 mb-6">
          <MonoLabel className="block mb-3 text-muted">NO GOALS SET</MonoLabel>
          <p className="font-body text-sm text-muted mb-4">
            Set your goals to define your team&apos;s direction and unlock the Top 5 digest.
          </p>
          <SlantedButton href={`${basePath}/strategy`}>SET GOALS</SlantedButton>
        </PanelCard>
      ) : (
        <>
          {/* ── TOP 5 THIS WEEK — Hero Section ──────────────────────── */}
          <PanelCard className="mb-8 border-primary/20">
            <MonoLabel className="text-primary text-base mb-5 block">
              TOP 5 THIS WEEK
            </MonoLabel>

            {digest ? (
              <>
                <p className="font-body text-sm text-muted mb-6 leading-relaxed max-w-[700px]">
                  {digest.summary}
                </p>
                <div className="space-y-0">
                  {digest.items.map((item) => (
                    <div
                      key={item.rank}
                      className="flex gap-3 py-3 border-b border-border/30 last:border-b-0"
                    >
                      <span className="font-mono text-xl font-bold text-primary/40 shrink-0 w-6 text-right pt-0.5">
                        {item.rank}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-body text-sm font-semibold text-foreground leading-snug mb-0.5">
                          {item.title}
                        </p>
                        <p className="font-body text-sm text-muted leading-relaxed mb-1">
                          {item.detail}
                        </p>
                        <div className="flex items-center gap-3">
                          <span
                            className={`font-mono text-xs ${getPriorityColor(
                              item.priority
                            )}`}
                          >
                            {item.priority.toUpperCase()}
                          </span>
                          {item.goalPillar && (
                            <span className="font-mono text-xs text-muted">
                              {item.goalPillar}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="py-10 text-center">
                <p className="font-body text-sm text-muted mb-2">
                  Your Top 5 is being generated...
                </p>
                <p className="font-body text-xs text-muted">
                  Share thoughts to fuel the weekly digest.
                </p>
              </div>
            )}
          </PanelCard>

          {/* ── Two-column: Goals + Team Pulse ──────────────────────── */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* GOALS (left 2/3) */}
            {goalPillars.length > 0 && (
              <div className="lg:col-span-2">
                <PanelCard>
                  <div className="flex items-center justify-between mb-4">
                    <MonoLabel className="text-primary">
                      GOALS
                    </MonoLabel>
                    <Link
                      href={`${basePath}/goals`}
                      className="font-mono text-xs text-muted hover:text-primary transition-colors"
                    >
                      VIEW ALL &rarr;
                    </Link>
                  </div>
                  <div className="divide-y divide-border/50">
                    {goalPillars.map((pillar) => {
                      const isSilent = pillar.contributors.length === 0;
                      const isBlocked = pillar.blockers.length > 0;
                      return (
                        <div key={pillar.name} className="py-3 first:pt-0 last:pb-0">
                          <p className="font-body text-sm font-semibold text-foreground mb-1">
                            {pillar.name}
                          </p>

                          {isSilent ? (
                            <span className="font-mono text-xs text-warning">
                              No activity this week
                            </span>
                          ) : (
                            <>
                              <p className="font-mono text-xs text-muted mb-1">
                                {pillar.contributors.join(", ")}
                              </p>

                              {pillar.synthSnippets.length > 0 && (
                                <p className="font-body text-xs text-muted leading-relaxed mb-1 line-clamp-2">
                                  {pillar.synthSnippets[0]}
                                  {pillar.synthSnippets[0] &&
                                  !pillar.synthSnippets[0].endsWith(".")
                                    ? "..."
                                    : ""}
                                </p>
                              )}

                              {isBlocked && (
                                <div className="mt-1.5">
                                  {pillar.blockers.map((b, i) => (
                                    <p
                                      key={i}
                                      className="font-mono text-xs text-destructive leading-relaxed"
                                    >
                                      BLOCKED: {b}
                                    </p>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </PanelCard>
              </div>
            )}

            {/* TEAM PULSE (right 1/3) */}
            <div>
              <PanelCard>
                <MonoLabel className="mb-3 block text-primary">TEAM PULSE</MonoLabel>
                {teamMembers.length <= 1 ? (
                  <div className="text-center py-6 space-y-3">
                    <p className="font-body text-sm text-muted">
                      Just you so far.
                    </p>
                    <p className="font-body text-base text-foreground leading-snug">
                      Invite your team to see alignment patterns emerge.
                    </p>
                    <SlantedButton variant="primary">INVITE TEAM</SlantedButton>
                    <p className="font-mono text-xs text-muted mt-2">
                      JOIN CODE: {workspace.joinCode}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {teamMembers.map((member) => (
                      <div
                        key={member.userId}
                        className={`flex items-center justify-between py-1 ${
                          member.userId === currentUserId
                            ? "border-l-2 border-primary pl-2"
                            : ""
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-block w-2 h-2 rounded-full ${
                              member.activeThisWeek ? "bg-primary" : "bg-border"
                            }`}
                            title={
                              member.activeThisWeek
                                ? "Active this week"
                                : "No activity this week"
                            }
                          />
                          <span className="font-body text-sm text-foreground">
                            {member.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs text-muted">
                            ALIGNMENT
                          </span>
                          <span className="font-mono text-sm font-bold text-primary">
                            {Math.round(member.alignmentScore * 100)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </PanelCard>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
