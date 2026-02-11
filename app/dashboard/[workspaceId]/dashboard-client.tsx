"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
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
    memberName: string;
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
  isFresh?: boolean;
  ghostTeam?: Array<{ name: string; role: string }>;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function getPriorityDot(priority: string): string {
  if (priority === "critical") return "bg-destructive";
  if (priority === "high") return "bg-warning";
  return "bg-muted";
}

function getAlignmentColor(score: number): string {
  if (score >= 0.8) return "text-primary";
  if (score >= 0.5) return "text-warning";
  return "text-destructive";
}

function getAlignmentFill(score: number): string {
  if (score >= 0.8) return "#CCFF00";
  if (score >= 0.5) return "#FFB800";
  return "#FF3333";
}

// ── Alignment Dot Plot ──────────────────────────────────────────────────

function getWeekKey(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + mondayOffset);
  return monday.toISOString().slice(0, 10);
}

function formatWeekLabel(weekKey: string): string {
  const d = new Date(weekKey + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function AlignmentDotPlot({
  data,
}: {
  data: Array<{ alignmentScore: number; createdAt: string; memberName: string }>;
}) {
  if (data.length === 0) return null;

  // Group data points by week
  const weekMap = new Map<string, typeof data>();
  for (const point of data) {
    const key = getWeekKey(point.createdAt);
    if (!weekMap.has(key)) weekMap.set(key, []);
    weekMap.get(key)!.push(point);
  }

  const weeks = Array.from(weekMap.keys()).sort();
  if (weeks.length === 0) return null;

  // Auto-scale Y-axis to data range with padding
  const allScores = data.map((d) => d.alignmentScore);
  const rawMin = Math.min(...allScores);
  const rawMax = Math.max(...allScores);
  const range = rawMax - rawMin || 0.1; // avoid zero-range
  const pad = range * 0.15; // 15% breathing room above and below
  // Round to nice increments (nearest 5%)
  const yMin = Math.max(0, Math.floor((rawMin - pad) * 20) / 20);
  const yMax = Math.min(1, Math.ceil((rawMax + pad) * 20) / 20);
  const yRange = yMax - yMin || 0.1;

  // Generate grid lines at nice 10% increments within the visible range
  const gridLines: number[] = [];
  const step = yRange > 0.3 ? 0.1 : 0.05;
  for (let v = Math.ceil(yMin / step) * step; v <= yMax + 0.001; v += step) {
    gridLines.push(Math.round(v * 100) / 100);
  }

  // SVG dimensions -- compact
  const height = 120;
  const paddingLeft = 36;
  const paddingRight = 8;
  const paddingTop = 8;
  const paddingBottom = 22;
  const plotHeight = height - paddingTop - paddingBottom;
  const chartWidth = Math.max(weeks.length * 64 + paddingLeft + paddingRight, 240);
  const plotRight = chartWidth - paddingRight;

  const yScale = (score: number) =>
    paddingTop + plotHeight * (1 - (score - yMin) / yRange);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${chartWidth} ${height}`}
        className="w-full"
        style={{ minWidth: `${chartWidth}px`, maxHeight: `${height}px` }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid lines */}
        {gridLines.map((pct) => (
          <g key={pct}>
            <line
              x1={paddingLeft}
              y1={yScale(pct)}
              x2={plotRight}
              y2={yScale(pct)}
              stroke="#2A2A2A"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <text
              x={paddingLeft - 6}
              y={yScale(pct) + 3}
              textAnchor="end"
              fill="#666666"
              fontSize={9}
              fontFamily="monospace"
            >
              {Math.round(pct * 100)}%
            </text>
          </g>
        ))}

        {/* 80% threshold line if within range */}
        {yMin <= 0.8 && yMax >= 0.8 && (
          <line
            x1={paddingLeft}
            y1={yScale(0.8)}
            x2={plotRight}
            y2={yScale(0.8)}
            stroke="#CCFF00"
            strokeWidth={1}
            strokeOpacity={0.15}
          />
        )}

        {/* Bottom axis line */}
        <line
          x1={paddingLeft}
          y1={paddingTop + plotHeight}
          x2={plotRight}
          y2={paddingTop + plotHeight}
          stroke="#2A2A2A"
          strokeWidth={1}
        />

        {/* Per-week columns */}
        {weeks.map((weekKey, weekIdx) => {
          const points = weekMap.get(weekKey)!;
          const colCenter = paddingLeft + weekIdx * 64 + 32;

          return (
            <g key={weekKey}>
              {/* Week label */}
              <text
                x={colCenter}
                y={height - 3}
                textAnchor="middle"
                fill="#666666"
                fontSize={9}
                fontFamily="monospace"
              >
                {formatWeekLabel(weekKey)}
              </text>

              {/* Dots */}
              {points.map((point, i) => {
                const jitter = points.length === 1
                  ? 0
                  : (i / (points.length - 1) - 0.5) * Math.min(points.length * 7, 32);
                const cx = colCenter + jitter;
                const cy = yScale(point.alignmentScore);

                return (
                  <circle
                    key={`${weekKey}-${i}`}
                    cx={cx}
                    cy={cy}
                    r={4}
                    fill={getAlignmentFill(point.alignmentScore)}
                    fillOpacity={0.85}
                    stroke={getAlignmentFill(point.alignmentScore)}
                    strokeWidth={1}
                    strokeOpacity={0.3}
                  >
                    <title>
                      {point.memberName}: {Math.round(point.alignmentScore * 100)}%
                    </title>
                  </circle>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────

// ── Skeleton Pulse Component ─────────────────────────────────────────────

function SkeletonPulse({ className = "", children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div className={`animate-pulse ${className}`}>
      {children || <div className="h-4 bg-border/50 rounded w-3/4" />}
    </div>
  );
}

// ── Onboarding Status Tracker ───────────────────────────────────────────

interface OnboardStatus {
  hasCanon: boolean;
  hasArtifact: boolean;
  hasDigest: boolean;
  ghostTeam: Array<{ name: string; role: string }>;
}

const POLL_INTERVAL = 3000;
const POLL_TIMEOUT = 90000; // 90s max polling

function useOnboardPolling(workspaceId: string, enabled: boolean) {
  const router = useRouter();
  const [status, setStatus] = useState<OnboardStatus>({
    hasCanon: false,
    hasArtifact: false,
    hasDigest: false,
    ghostTeam: [],
  });
  const [timedOut, setTimedOut] = useState(false);
  const startTimeRef = useRef(Date.now());
  const lastRefreshRef = useRef<string>("");

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/onboard/status`);
      if (!res.ok) return;
      const data: OnboardStatus = await res.json();
      setStatus(data);

      // Build a fingerprint of what's available
      const fingerprint = `${data.hasCanon}-${data.hasArtifact}-${data.hasDigest}`;

      // If something new arrived since last check, refresh the server component
      if (fingerprint !== lastRefreshRef.current && (data.hasCanon || data.hasArtifact || data.hasDigest)) {
        lastRefreshRef.current = fingerprint;
        router.refresh();
      }
    } catch {
      // Polling errors are non-critical
    }
  }, [workspaceId, router]);

  useEffect(() => {
    if (!enabled) return;

    startTimeRef.current = Date.now();
    const interval = setInterval(() => {
      if (Date.now() - startTimeRef.current > POLL_TIMEOUT) {
        setTimedOut(true);
        clearInterval(interval);
        return;
      }
      poll();
    }, POLL_INTERVAL);

    // Initial poll immediately
    poll();

    return () => clearInterval(interval);
  }, [enabled, poll]);

  // Stop polling once everything is ready
  const isComplete = status.hasCanon && status.hasArtifact && status.hasDigest;

  return { status, isComplete, timedOut };
}

// ── Main Component ───────────────────────────────────────────────────────

export function DashboardClient({
  workspace,
  weekLabel,
  isCurrentWeek,
  digest,
  teamMembers,
  alignmentTrend,
  currentUserId,
  hasStrategy,
  goalPillars,
  isFresh = false,
  ghostTeam = [],
}: DashboardProps) {
  const basePath = `/dashboard/${workspace.id}`;
  const { status: onboardStatus, timedOut } = useOnboardPolling(
    workspace.id,
    isFresh && !hasStrategy
  );

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

      {/* ── Fresh onboarding: skeleton states while processing ─────── */}
      {isFresh && !hasStrategy ? (
        <AnimatePresence mode="wait">
          <motion.div
            key="fresh-skeleton"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {/* Timeout error */}
            {timedOut && (
              <PanelCard className="text-center py-8 mb-6 border-destructive/30">
                <MonoLabel className="block mb-3 text-destructive">SOMETHING WENT WRONG</MonoLabel>
                <p className="font-body text-sm text-muted mb-4">
                  Setup is taking longer than expected. You can try again.
                </p>
                <SlantedButton href={`${basePath}/welcome`}>TRY AGAIN</SlantedButton>
              </PanelCard>
            )}

            {/* Top 5 skeleton */}
            {!timedOut && (
              <PanelCard className="mb-8 border-primary/20">
                <MonoLabel className="text-primary text-base mb-5 block">
                  TOP 5 THIS WEEK
                </MonoLabel>
                <div className="py-8 text-center">
                  <div className="flex justify-center mb-4">
                    <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
                  </div>
                  <p className="font-mono text-sm text-primary font-bold tracking-wider mb-2">
                    {onboardStatus.hasDigest
                      ? "TOP 5 READY"
                      : onboardStatus.hasArtifact
                        ? "SYNTHESIZING YOUR TOP 5..."
                        : onboardStatus.hasCanon
                          ? "ANALYZING YOUR THOUGHTS..."
                          : "EXTRACTING YOUR GOALS..."}
                  </p>
                  <p className="font-body text-xs text-muted">
                    Your coaches are reading your input through 8 lenses.
                  </p>
                </div>
              </PanelCard>
            )}

            {/* Goals skeleton */}
            {!timedOut && (
              <PanelCard className="mb-8">
                <MonoLabel className="text-primary mb-4 block">GOALS</MonoLabel>
                <div className="space-y-3">
                  <SkeletonPulse><div className="h-4 bg-border/50 rounded w-4/5" /></SkeletonPulse>
                  <SkeletonPulse><div className="h-4 bg-border/50 rounded w-3/5" /></SkeletonPulse>
                  <SkeletonPulse><div className="h-4 bg-border/50 rounded w-2/3" /></SkeletonPulse>
                </div>
              </PanelCard>
            )}

            {/* Ghost team + real team pulse */}
            {!timedOut && (
              <PanelCard>
                <MonoLabel className="mb-3 block text-primary">TEAM PULSE</MonoLabel>
                {/* Show real team members if they exist */}
                {teamMembers.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {teamMembers.map((member) => (
                      <div key={member.userId} className="flex items-center justify-between py-1 border-l-2 border-primary pl-2">
                        <div className="flex items-center gap-2">
                          <span className="inline-block w-2 h-2 rounded-full bg-primary" />
                          <span className="font-body text-sm text-foreground">{member.name}</span>
                        </div>
                        <span className="font-mono text-xs text-muted">CALCULATING...</span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Ghost team from AI extraction */}
                {(ghostTeam.length > 0 || onboardStatus.ghostTeam.length > 0) && (
                  <>
                    {(onboardStatus.ghostTeam.length > 0 ? onboardStatus.ghostTeam : ghostTeam).map((member, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 opacity-60">
                        <div className="flex items-center gap-2">
                          <span className="inline-block w-2 h-2 rounded-full bg-border" />
                          <span className="font-body text-sm text-foreground">{member.name}</span>
                          <span className="font-mono text-[10px] text-muted">{member.role}</span>
                        </div>
                        <span className="font-mono text-xs text-muted">--%</span>
                      </div>
                    ))}
                    <p className="font-body text-xs text-muted mt-3 leading-relaxed">
                      When they share their first thought, you&apos;ll see their alignment here.
                    </p>
                  </>
                )}
                {ghostTeam.length === 0 && onboardStatus.ghostTeam.length === 0 && teamMembers.length <= 1 && (
                  <div className="text-center py-4">
                    <p className="font-body text-sm text-muted">
                      Invite your team to see alignment patterns emerge.
                    </p>
                  </div>
                )}
              </PanelCard>
            )}
          </motion.div>
        </AnimatePresence>
      ) : !hasStrategy ? (
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
              <div className="space-y-0">
                {digest.items.map((item) => (
                  <div
                    key={item.rank}
                    className="flex items-center gap-2 py-1.5"
                  >
                    <span className="font-mono text-sm text-primary/40 w-4 text-right shrink-0">
                      {item.rank}
                    </span>
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${getPriorityDot(
                        item.priority
                      )}`}
                    />
                    <span className="font-body text-sm text-foreground">
                      {item.title}
                    </span>
                  </div>
                ))}
              </div>
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

          {/* ── ALIGNMENT OVER TIME — Dot Plot ──────────────────────── */}
          {alignmentTrend.length > 0 && (
            <PanelCard className="mb-8">
              <MonoLabel className="text-primary mb-4 block">
                ALIGNMENT OVER TIME
              </MonoLabel>
              <AlignmentDotPlot data={alignmentTrend} />
            </PanelCard>
          )}

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
                {teamMembers.length <= 1 && ghostTeam.length === 0 ? (
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
                    {/* Real team members */}
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
                          <span className={`font-mono text-sm font-bold ${getAlignmentColor(member.alignmentScore)}`}>
                            {Math.round(member.alignmentScore * 100)}%
                          </span>
                        </div>
                      </div>
                    ))}
                    {/* Ghost team members from onboarding extraction */}
                    {ghostTeam.length > 0 && (
                      <>
                        {ghostTeam.map((ghost, i) => (
                          <div key={`ghost-${i}`} className="flex items-center justify-between py-1 opacity-50">
                            <div className="flex items-center gap-2">
                              <span className="inline-block w-2 h-2 rounded-full bg-border" />
                              <span className="font-body text-sm text-foreground">{ghost.name}</span>
                              <span className="font-mono text-[10px] text-muted">{ghost.role}</span>
                            </div>
                            <span className="font-mono text-xs text-muted">--%</span>
                          </div>
                        ))}
                        <p className="font-body text-xs text-muted mt-2 leading-relaxed">
                          When they share their first thought, you&apos;ll see their alignment here.
                        </p>
                      </>
                    )}
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
