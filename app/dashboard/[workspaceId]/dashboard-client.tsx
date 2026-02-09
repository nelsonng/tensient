"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { PanelCard } from "@/components/panel-card";
import { MonoLabel } from "@/components/mono-label";
import { SlantedButton } from "@/components/slanted-button";
import { formatShortDate } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────

interface DigestItem {
  rank: number;
  title: string;
  detail: string;
  coachAttribution: string;
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

const NAV_ITEMS = [
  { label: "GOALS", path: "goals" },
  { label: "THOUGHTS", path: "thoughts" },
  { label: "COACHES", path: "coaches" },
  { label: "SYNTHESIS", path: "synthesis" },
  { label: "ACTIONS", path: "actions" },
] as const;

// ── Helpers ──────────────────────────────────────────────────────────────

// formatShortDate imported from @/lib/utils

function getPriorityColor(priority: string): string {
  if (priority === "critical") return "text-destructive";
  if (priority === "high") return "text-warning";
  return "text-muted";
}

// ── Alignment Sparkline (auto-scaled Y) ─────────────────────────────────

function AlignmentSparkline({
  data,
}: {
  data: Array<{ alignmentScore: number; createdAt: string }>;
}) {
  if (data.length < 2) return null;

  const width = 600;
  const height = 180;
  const ml = 40;
  const mr = 12;
  const mt = 16;
  const mb = 24;
  const plotW = width - ml - mr;
  const plotH = height - mt - mb;

  // Auto-scale Y-axis from data range with padding
  const scores = data.map((d) => d.alignmentScore);
  const rawMin = Math.min(...scores);
  const rawMax = Math.max(...scores);
  const range = rawMax - rawMin || 0.1; // prevent zero range
  const padding = range * 0.15;
  const yMin = Math.max(0, rawMin - padding);
  const yMax = Math.min(1, rawMax + padding);
  const yRange = yMax - yMin;

  // Y-axis grid: 3-4 evenly spaced labels within the auto-scaled range
  const yStep = yRange / 3;
  const yLabels = [yMin, yMin + yStep, yMin + yStep * 2, yMax].map(
    (v) => Math.round(v * 100)
  );

  const points = data.map((d, i) => {
    const x = ml + (i / Math.max(data.length - 1, 1)) * plotW;
    const normalized = (d.alignmentScore - yMin) / yRange;
    const y = mt + plotH - normalized * plotH;
    return { x, y };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x},${p.y}`)
    .join(" ");

  const areaD =
    pathD +
    ` L ${points[points.length - 1].x},${mt + plotH}` +
    ` L ${points[0].x},${mt + plotH} Z`;

  const xLabelCount = Math.min(4, data.length);
  const xLabelIndices = Array.from({ length: xLabelCount }, (_, i) =>
    Math.round((i / Math.max(xLabelCount - 1, 1)) * (data.length - 1))
  );

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      style={{ height: "180px" }}
      preserveAspectRatio="xMidYMid meet"
    >
      {yLabels.map((pct) => {
        const normalized = (pct / 100 - yMin) / yRange;
        const y = mt + plotH - normalized * plotH;
        return (
          <g key={pct}>
            <line x1={ml} y1={y} x2={ml + plotW} y2={y} stroke="#1A1A1A" strokeWidth="1" />
            <text
              x={ml - 6}
              y={y + 4}
              textAnchor="end"
              className="fill-current text-muted"
              style={{ fontSize: "10px", fontFamily: "var(--font-mono)" }}
            >
              {pct}%
            </text>
          </g>
        );
      })}
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#CCFF00" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#CCFF00" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#sparkGrad)" />
      <path d={pathD} fill="none" stroke="#CCFF00" strokeWidth="2.5" strokeLinejoin="round" />
      {xLabelIndices.map((idx) => (
        <text
          key={idx}
          x={points[idx].x}
          y={height - 4}
          textAnchor="middle"
          className="fill-current text-muted"
          style={{ fontSize: "10px", fontFamily: "var(--font-mono)" }}
        >
          {formatShortDate(data[idx].createdAt)}
        </text>
      ))}
    </svg>
  );
}

// ── Main Component ───────────────────────────────────────────────────────

export function DashboardClient({
  workspace,
  weekLabel,
  isCurrentWeek,
  weekPulse,
  digest,
  teamMembers,
  alignmentTrend,
  allCoaches,
  currentUserId,
  needsAttention,
  flowCounts,
  hasStrategy,
  goalPillars,
}: DashboardProps) {
  const pathname = usePathname();
  const basePath = `/dashboard/${workspace.id}`;

  const totalAttention =
    needsAttention.blockedActions +
    needsAttention.unlinkedActions +
    needsAttention.quietMembers;

  return (
    <div className="mx-auto max-w-[1200px] px-6 pt-8 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <Link
            href="/"
            className="font-display text-base font-bold uppercase tracking-wider text-foreground"
          >
            TENSIENT
          </Link>
          <h1 className="font-display text-lg font-bold uppercase tracking-tight mt-1">
            {workspace.name}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <SlantedButton href={`${basePath}/capture`} variant="primary">
            + THOUGHT
          </SlantedButton>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="font-mono text-xs text-muted hover:text-destructive transition-colors cursor-pointer"
          >
            SIGN OUT
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex items-center gap-1 mb-6 border-b border-border pb-3">
        <Link
          href={basePath}
          className={`px-3 py-1.5 font-mono text-xs tracking-wider transition-colors ${
            pathname === basePath
              ? "text-primary border-b-2 border-primary"
              : "text-muted hover:text-foreground"
          }`}
        >
          HOME
        </Link>
        {NAV_ITEMS.map((item) => {
          const href = `${basePath}/${item.path}`;
          const isActive = pathname === href;
          return (
            <Link
              key={item.path}
              href={href}
              className={`px-3 py-1.5 font-mono text-xs tracking-wider transition-colors ${
                isActive
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Week Header + Pulse Stats */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {!isCurrentWeek && (
            <span className="font-mono text-xs text-warning border border-warning/30 px-1.5 py-0.5 rounded">
              LATEST
            </span>
          )}
          <MonoLabel className="text-primary">WEEK OF {weekLabel.toUpperCase()}</MonoLabel>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-xs text-muted">
            {weekPulse.thoughtCount} thoughts
          </span>
          <span className="font-mono text-xs text-muted">
            {weekPulse.activeTeamCount}/{weekPulse.totalTeamCount} active
          </span>
          <span className="font-mono text-xs text-primary">
            {Math.round(weekPulse.avgAlignment * 100)}% avg alignment
          </span>
        </div>
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
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* ── Left column (2/3) ──────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">
            {/* TOP 5 THIS WEEK */}
            <PanelCard>
              <MonoLabel className="text-primary mb-4 block">TOP 5 THIS WEEK</MonoLabel>

              {digest ? (
                <>
                  <p className="font-body text-sm text-muted mb-5 leading-relaxed">
                    {digest.summary}
                  </p>
                  <div className="divide-y divide-border/50">
                    {digest.items.map((item) => (
                      <div key={item.rank} className="flex gap-3 py-3 first:pt-0">
                        <span className="font-mono text-lg font-bold text-muted/60 shrink-0 w-6 text-right pt-0.5">
                          {item.rank}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-body text-sm font-semibold text-foreground leading-snug mb-1">
                            {item.title}
                          </p>
                          <p className="font-body text-sm text-muted leading-relaxed">
                            {item.detail}
                          </p>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span
                              className={`font-mono text-xs ${getPriorityColor(
                                item.priority
                              )}`}
                            >
                              {item.priority.toUpperCase()}
                            </span>
                            {item.goalPillar ? (
                              <span className="font-mono text-xs text-muted">
                                GOAL: {item.goalPillar}
                              </span>
                            ) : (
                              <span className="font-mono text-xs text-warning">
                                NO GOAL
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="font-body text-sm text-muted py-6 text-center">
                  Not enough data yet. Share thoughts to generate the weekly Top 5.
                </p>
              )}
            </PanelCard>

            {/* GOALS THIS WEEK */}
            {goalPillars.length > 0 && (
              <PanelCard>
                <div className="flex items-center justify-between mb-4">
                  <MonoLabel className="text-primary">GOALS THIS WEEK</MonoLabel>
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
                                {pillar.synthSnippets[0] && !pillar.synthSnippets[0].endsWith(".") ? "..." : ""}
                              </p>
                            )}

                            <div className="flex items-center gap-3">
                              {pillar.actions.length > 0 && (
                                <span className="font-mono text-xs text-muted">
                                  {pillar.actions.length} action{pillar.actions.length !== 1 ? "s" : ""}
                                </span>
                              )}
                            </div>

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
            )}

            {/* ALIGNMENT THIS WEEK */}
            {alignmentTrend.length > 1 && (
              <PanelCard>
                <div className="flex items-center justify-between mb-2">
                  <MonoLabel className="text-primary">ALIGNMENT TREND</MonoLabel>
                  <span className="font-mono text-xl font-bold text-primary">
                    {Math.round(
                      alignmentTrend[alignmentTrend.length - 1].alignmentScore * 100
                    )}
                    %
                  </span>
                </div>
                <AlignmentSparkline data={alignmentTrend} />
              </PanelCard>
            )}

            {/* NEEDS ATTENTION */}
            {totalAttention > 0 && (
              <PanelCard>
                <MonoLabel className="text-warning mb-3 block">
                  NEEDS ATTENTION
                </MonoLabel>
                <div className="grid grid-cols-3 gap-4">
                  {needsAttention.blockedActions > 0 && (
                    <Link
                      href={`${basePath}/actions`}
                      className="text-center hover:bg-border/10 rounded p-2 transition-colors"
                    >
                      <span className="block font-mono text-2xl font-bold text-destructive">
                        {needsAttention.blockedActions}
                      </span>
                      <span className="font-mono text-xs text-muted">
                        BLOCKED
                      </span>
                    </Link>
                  )}
                  {needsAttention.unlinkedActions > 0 && (
                    <Link
                      href={`${basePath}/actions`}
                      className="text-center hover:bg-border/10 rounded p-2 transition-colors"
                    >
                      <span className="block font-mono text-2xl font-bold text-warning">
                        {needsAttention.unlinkedActions}
                      </span>
                      <span className="font-mono text-xs text-muted">
                        NO GOAL
                      </span>
                    </Link>
                  )}
                  {needsAttention.quietMembers > 0 && (
                    <Link
                      href={`${basePath}/thoughts`}
                      className="text-center hover:bg-border/10 rounded p-2 transition-colors"
                    >
                      <span className="block font-mono text-2xl font-bold text-muted">
                        {needsAttention.quietMembers}
                      </span>
                      <span className="font-mono text-xs text-muted">
                        QUIET
                      </span>
                    </Link>
                  )}
                </div>
              </PanelCard>
            )}

            {/* THE FLOW -- Mental Model */}
            <PanelCard>
              <MonoLabel className="text-muted mb-4 block">THE FLOW THIS WEEK</MonoLabel>
              <div className="flex items-center justify-between">
                {[
                  { label: "GOALS", count: flowCounts.goals, path: "goals", color: "text-primary" },
                  { label: "THOUGHTS", count: flowCounts.thoughts, path: "thoughts", color: "text-foreground" },
                  { label: "COACHES", count: flowCounts.coaches, path: "coaches", color: "text-foreground" },
                  { label: "SYNTHESIS", count: flowCounts.synthesis, path: "synthesis", color: "text-foreground" },
                  { label: "ACTIONS", count: flowCounts.actions, path: "actions", color: "text-foreground" },
                ].map((node, i) => (
                  <div key={node.label} className="flex items-center">
                    {i > 0 && (
                      <span className="font-mono text-xs text-muted mx-2">&rarr;</span>
                    )}
                    <Link
                      href={`${basePath}/${node.path}`}
                      className="text-center group"
                    >
                      <span className={`block font-mono text-xl font-bold ${node.color} group-hover:text-primary transition-colors`}>
                        {node.count}
                      </span>
                      <span className="font-mono text-xs text-muted group-hover:text-foreground transition-colors">
                        {node.label}
                      </span>
                    </Link>
                  </div>
                ))}
              </div>
            </PanelCard>
          </div>

          {/* ── Right column (1/3) ─────────────────────────────────────── */}
          <div className="space-y-6">
            {/* TEAM PULSE */}
            <PanelCard>
              <MonoLabel className="mb-3 block text-primary">TEAM PULSE</MonoLabel>
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
                    <span className="font-mono text-sm font-bold text-primary">
                      {Math.round(member.alignmentScore * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </PanelCard>

            {/* COACHES */}
            <PanelCard>
              <div className="flex items-center justify-between mb-3">
                <MonoLabel className="text-primary">COACHES</MonoLabel>
                <Link
                  href={`${basePath}/coaches`}
                  className="font-mono text-xs text-muted hover:text-primary transition-colors"
                >
                  VIEW ALL &rarr;
                </Link>
              </div>
              <div className="flex flex-wrap gap-2">
                {allCoaches.map((coach) => (
                  <span
                    key={coach.id}
                    className="inline-block font-mono text-xs px-2 py-1 border border-primary/30 rounded text-foreground"
                  >
                    {coach.name}
                  </span>
                ))}
              </div>
            </PanelCard>

            {/* ACTIONS SNAPSHOT */}
            <PanelCard>
              <div className="flex items-center justify-between mb-3">
                <MonoLabel className="text-primary">ACTIONS</MonoLabel>
                <Link
                  href={`${basePath}/actions`}
                  className="font-mono text-xs text-muted hover:text-primary transition-colors"
                >
                  VIEW ALL &rarr;
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <span className="block font-mono text-xl font-bold text-foreground">
                    {weekPulse.newActionCount}
                  </span>
                  <span className="font-mono text-xs text-muted">NEW</span>
                </div>
                <div>
                  <span className="block font-mono text-xl font-bold text-primary">
                    {weekPulse.completedActionCount}
                  </span>
                  <span className="font-mono text-xs text-muted">DONE</span>
                </div>
                <div>
                  <span className="block font-mono text-xl font-bold text-destructive">
                    {needsAttention.blockedActions}
                  </span>
                  <span className="font-mono text-xs text-muted">BLOCKED</span>
                </div>
              </div>
            </PanelCard>
          </div>
        </div>
      )}
    </div>
  );
}
