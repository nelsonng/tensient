"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { PanelCard } from "@/components/panel-card";
import { MonoLabel } from "@/components/mono-label";
import { SlantedButton } from "@/components/slanted-button";

interface DashboardProps {
  workspace: { id: string; name: string; joinCode: string };
  strategy: { id: string; content: string; createdAt: string } | null;
  recentArtifacts: Array<{
    id: string;
    alignmentScore: number;
    sentimentScore: number;
    content: string;
    actionItemCount: number;
    createdAt: string;
    userId: string;
  }>;
  teamMembers: Array<{
    userId: string;
    name: string;
    role: string;
    streakCount: number;
    alignmentScore: number;
    lastCaptureAt: string | null;
  }>;
  alignmentTrend: Array<{
    alignmentScore: number;
    createdAt: string;
  }>;
  activeProtocol: { id: string; name: string; description: string | null } | null;
  allCoaches: Array<{ id: string; name: string }>;
  currentUserId: string;
  openActionCount: number;
  unlinkedActionCount: number;
}

const NAV_ITEMS = [
  { label: "GOALS", path: "goals" },
  { label: "THOUGHTS", path: "thoughts" },
  { label: "COACHES", path: "coaches" },
  { label: "SYNTHESIS", path: "synthesis" },
  { label: "ACTIONS", path: "actions" },
] as const;

function getAlignmentColor(score: number): string {
  if (score >= 0.8) return "text-primary";
  if (score >= 0.5) return "text-warning";
  return "text-destructive";
}

function timeAgo(date: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(date).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function AlignmentChart({
  data,
}: {
  data: Array<{ alignmentScore: number; createdAt: string }>;
}) {
  if (data.length === 0) return null;

  const width = 600;
  const height = 200;
  const marginLeft = 40;
  const marginRight = 16;
  const marginTop = 20;
  const marginBottom = 28;

  const plotW = width - marginLeft - marginRight;
  const plotH = height - marginTop - marginBottom;

  // Y-axis: fixed 0-100% scale for stability
  const yLabels = [0, 25, 50, 75, 100];

  // Compute points
  const points = data.map((d, i) => {
    const x =
      marginLeft +
      (i / Math.max(data.length - 1, 1)) * plotW;
    const y = marginTop + plotH - d.alignmentScore * plotH;
    return { x, y, score: d.alignmentScore, date: d.createdAt };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x},${p.y}`)
    .join(" ");

  // Area fill path (line + bottom edge)
  const areaD =
    pathD +
    ` L ${points[points.length - 1].x},${marginTop + plotH}` +
    ` L ${points[0].x},${marginTop + plotH} Z`;

  // X-axis labels: show ~5 evenly spaced dates
  const xLabelCount = Math.min(5, data.length);
  const xLabelIndices = Array.from({ length: xLabelCount }, (_, i) =>
    Math.round((i / Math.max(xLabelCount - 1, 1)) * (data.length - 1))
  );

  // Trend delta
  const first = data[0].alignmentScore;
  const last = data[data.length - 1].alignmentScore;
  const delta = Math.round((last - first) * 100);
  const deltaStr = delta >= 0 ? `+${delta}%` : `${delta}%`;

  return (
    <div>
      {/* Current score + delta annotation */}
      <div className="flex items-baseline justify-between mb-3">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-3xl font-bold text-primary">
            {Math.round(last * 100)}%
          </span>
          <span className="font-mono text-sm text-muted">current</span>
        </div>
        <span
          className={`font-mono text-sm ${
            delta >= 0 ? "text-primary" : "text-destructive"
          }`}
        >
          {deltaStr} over {data.length} updates
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height: "200px" }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Y-axis gridlines and labels */}
        {yLabels.map((pct) => {
          const y = marginTop + plotH - (pct / 100) * plotH;
          return (
            <g key={pct}>
              <line
                x1={marginLeft}
                y1={y}
                x2={marginLeft + plotW}
                y2={y}
                stroke="#1A1A1A"
                strokeWidth="1"
              />
              <text
                x={marginLeft - 8}
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

        {/* Area fill with gradient */}
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#CCFF00" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#CCFF00" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#areaGrad)" />

        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke="#CCFF00"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* X-axis date labels */}
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
    </div>
  );
}

export function DashboardClient({
  workspace,
  strategy,
  recentArtifacts,
  teamMembers,
  alignmentTrend,
  activeProtocol,
  allCoaches,
  currentUserId,
  openActionCount,
  unlinkedActionCount,
}: DashboardProps) {
  const pathname = usePathname();
  const basePath = `/dashboard/${workspace.id}`;

  return (
    <div className="mx-auto max-w-[1200px] px-6 pt-8 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <Link href="/" className="font-display text-base font-bold uppercase tracking-wider text-foreground">
            TENSIENT
          </Link>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="font-display text-lg font-bold uppercase tracking-tight">
              {workspace.name}
            </h1>
            <span className="font-mono text-xs text-muted">
              CODE: {workspace.joinCode}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <SlantedButton
            href={`${basePath}/capture`}
            variant="primary"
          >
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
      <nav className="flex items-center gap-1 mb-8 border-b border-border pb-3">
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column: Strategy + Alignment Trend */}
        <div className="lg:col-span-2 space-y-6">
          {/* Your Strategy */}
          {strategy ? (
            <PanelCard>
              <div className="flex items-center justify-between mb-4">
                <MonoLabel className="text-primary">YOUR GOALS</MonoLabel>
                <span className="font-mono text-xs text-muted">
                  {timeAgo(strategy.createdAt)}
                </span>
              </div>
              <p className="font-body text-base leading-relaxed text-foreground whitespace-pre-wrap">
                {strategy.content}
              </p>
            </PanelCard>
          ) : (
            <PanelCard className="text-center py-12">
              <MonoLabel className="block mb-3 text-muted">
                NO GOALS SET
              </MonoLabel>
              <p className="font-body text-base text-muted mb-4">
                Set your goals to define your team&apos;s direction.
              </p>
              <SlantedButton href={`${basePath}/strategy`}>
                SET GOALS
              </SlantedButton>
            </PanelCard>
          )}

          {/* Alignment Trend */}
          {alignmentTrend.length > 1 && (
            <PanelCard>
              <MonoLabel className="mb-2 block text-primary">
                ALIGNMENT TREND
              </MonoLabel>
              <AlignmentChart data={alignmentTrend} />
            </PanelCard>
          )}

          {/* Recent Artifacts */}
          <div>
            <MonoLabel className="mb-4 block">RECENT SYNTHESIS</MonoLabel>
            {recentArtifacts.length === 0 ? (
              <PanelCard className="text-center py-8">
                <p className="font-body text-base text-muted">
                  No thoughts yet. Start by sharing what&apos;s on your mind.
                </p>
              </PanelCard>
            ) : (
              <div className="space-y-3">
                {recentArtifacts.map((artifact) => (
                  <PanelCard key={artifact.id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-body text-base text-foreground leading-relaxed line-clamp-2">
                          {artifact.content}
                        </p>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="font-mono text-xs text-muted">
                            {timeAgo(artifact.createdAt)}
                          </span>
                          <span className="font-mono text-xs text-muted">
                            {artifact.actionItemCount} ACTIONS
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className={`font-mono text-xl font-bold ${getAlignmentColor(
                            artifact.alignmentScore
                          )}`}
                        >
                          {Math.round(artifact.alignmentScore * 100)}%
                        </span>
                        <MonoLabel className="block text-xs">ALIGNMENT</MonoLabel>
                      </div>
                    </div>
                  </PanelCard>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Team Alignment */}
        <div className="space-y-6">
          <PanelCard>
            <MonoLabel className="mb-4 block text-primary">
              TEAM ALIGNMENT
            </MonoLabel>
            {teamMembers.length === 0 ? (
              <p className="font-body text-base text-muted">No team members.</p>
            ) : (
              <div className="space-y-4">
                {teamMembers.map((member, i) => (
                  <div
                    key={member.userId}
                    className={`flex items-center justify-between ${
                      member.userId === currentUserId
                        ? "border-l-2 border-primary pl-3"
                        : ""
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted">
                          #{i + 1}
                        </span>
                        <span className="font-body text-base font-medium text-foreground">
                          {member.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="font-mono text-xs text-muted">
                          {member.role.toUpperCase()}
                        </span>
                        {member.streakCount > 0 && (
                          <span className="font-mono text-xs text-primary">
                            {member.streakCount} STREAK
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-2xl font-bold text-primary">
                        {Math.round(member.alignmentScore * 100)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PanelCard>

          {/* Coaches */}
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
            {allCoaches.length > 0 ? (
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
            ) : (
              <p className="font-body text-sm text-muted">
                No coaches configured.
              </p>
            )}
            <p className="font-mono text-xs text-muted mt-3">
              All coaches analyze every thought. More coaches = richer synthesis.
            </p>
          </PanelCard>

          {/* Actions Summary */}
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
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-body text-base text-foreground">
                  Open actions
                </span>
                <span className="font-mono text-xl font-bold text-primary">
                  {openActionCount}
                </span>
              </div>
              {unlinkedActionCount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="font-body text-sm text-warning">
                    Not linked to any goal
                  </span>
                  <span className="font-mono text-sm font-bold text-warning">
                    {unlinkedActionCount}
                  </span>
                </div>
              )}
            </div>
          </PanelCard>

          {/* Invite Team */}
          {teamMembers.length <= 1 && (
            <PanelCard className="border-primary/30">
              <MonoLabel className="mb-3 block text-primary">
                INVITE YOUR TEAM
              </MonoLabel>
              <p className="font-body text-base text-muted mb-4 leading-relaxed">
                Tensient works best with your whole team. Share this code
                so they can join your workspace.
              </p>
              <div className="rounded-lg border border-border bg-background px-4 py-3 text-center">
                <span className="font-mono text-2xl font-bold tracking-widest text-primary">
                  {workspace.joinCode}
                </span>
              </div>
              <p className="font-mono text-xs text-muted mt-3 text-center">
                WORKSPACE JOIN CODE
              </p>
            </PanelCard>
          )}

          {/* Quick Actions */}
          <PanelCard>
            <MonoLabel className="mb-4 block">QUICK ACTIONS</MonoLabel>
            <div className="space-y-2">
              <Link
                href={`${basePath}/capture`}
                className="block font-body text-base text-muted hover:text-primary transition-colors"
              >
                &rarr; Share a thought
              </Link>
              <Link
                href={`${basePath}/strategy`}
                className="block font-body text-base text-muted hover:text-primary transition-colors"
              >
                &rarr; Update goals
              </Link>
            </div>
          </PanelCard>
        </div>
      </div>
    </div>
  );
}
