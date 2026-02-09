"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { PanelCard } from "@/components/panel-card";
import { MonoLabel } from "@/components/mono-label";
import { SlantedButton } from "@/components/slanted-button";

interface DashboardProps {
  workspace: { id: string; name: string; joinCode: string };
  canon: { id: string; content: string; createdAt: string } | null;
  recentArtifacts: Array<{
    id: string;
    driftScore: number;
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
    tractionScore: number;
    lastCaptureAt: string | null;
  }>;
  driftTrend: Array<{
    driftScore: number;
    createdAt: string;
  }>;
  currentUserId: string;
}

function getDriftColor(score: number): string {
  if (score <= 0.2) return "text-primary";
  if (score <= 0.5) return "text-warning";
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

function DriftChart({ data }: { data: Array<{ driftScore: number }> }) {
  if (data.length === 0) return null;

  const width = 400;
  const height = 80;
  const padding = 4;

  const maxDrift = Math.max(...data.map((d) => d.driftScore), 0.5);
  const points = data.map((d, i) => {
    const x =
      padding + (i / Math.max(data.length - 1, 1)) * (width - padding * 2);
    const y =
      height - padding - (d.driftScore / maxDrift) * (height - padding * 2);
    return `${x},${y}`;
  });

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-20"
      preserveAspectRatio="none"
    >
      {/* Grid line at 0.5 */}
      <line
        x1={padding}
        y1={height / 2}
        x2={width - padding}
        y2={height / 2}
        stroke="#2A2A2A"
        strokeDasharray="4"
      />
      {/* Path */}
      <path d={pathD} fill="none" stroke="#CCFF00" strokeWidth="2" />
      {/* Dots */}
      {data.map((d, i) => {
        const x =
          padding +
          (i / Math.max(data.length - 1, 1)) * (width - padding * 2);
        const y =
          height -
          padding -
          (d.driftScore / maxDrift) * (height - padding * 2);
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="3"
            fill={d.driftScore <= 0.2 ? "#CCFF00" : d.driftScore <= 0.5 ? "#FFB800" : "#FF3333"}
          />
        );
      })}
    </svg>
  );
}

export function DashboardClient({
  workspace,
  canon,
  recentArtifacts,
  teamMembers,
  driftTrend,
  currentUserId,
}: DashboardProps) {
  return (
    <div className="mx-auto max-w-[1200px] px-6 pt-8 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link href="/" className="font-display text-sm font-bold uppercase tracking-wider text-foreground">
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
            href={`/dashboard/${workspace.id}/capture`}
            variant="primary"
          >
            NEW CAPTURE
          </SlantedButton>
          <SlantedButton
            href={`/dashboard/${workspace.id}/genesis`}
            variant="outline"
          >
            GENESIS
          </SlantedButton>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="font-mono text-xs text-muted hover:text-destructive transition-colors cursor-pointer"
          >
            SIGN OUT
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column: Canon + Drift Trend */}
        <div className="lg:col-span-2 space-y-6">
          {/* The Canon */}
          {canon ? (
            <PanelCard>
              <div className="flex items-center justify-between mb-4">
                <MonoLabel className="text-primary">THE CANON</MonoLabel>
                <span className="font-mono text-xs text-muted">
                  {timeAgo(canon.createdAt)}
                </span>
              </div>
              <p className="font-body text-base leading-relaxed text-foreground whitespace-pre-wrap">
                {canon.content}
              </p>
            </PanelCard>
          ) : (
            <PanelCard className="text-center py-12">
              <MonoLabel className="block mb-3 text-muted">
                NO CANON DEFINED
              </MonoLabel>
              <p className="font-body text-sm text-muted mb-4">
                Run Genesis to define your strategic direction.
              </p>
              <SlantedButton href={`/dashboard/${workspace.id}/genesis`}>
                RUN GENESIS
              </SlantedButton>
            </PanelCard>
          )}

          {/* Drift Trend */}
          {driftTrend.length > 1 && (
            <PanelCard>
              <MonoLabel className="mb-4 block text-primary">
                DRIFT TREND
              </MonoLabel>
              <DriftChart data={driftTrend} />
              <div className="flex justify-between mt-2">
                <span className="font-mono text-xs text-muted">OLDEST</span>
                <span className="font-mono text-xs text-muted">LATEST</span>
              </div>
            </PanelCard>
          )}

          {/* Recent Artifacts */}
          <div>
            <MonoLabel className="mb-4 block">RECENT ARTIFACTS</MonoLabel>
            {recentArtifacts.length === 0 ? (
              <PanelCard className="text-center py-8">
                <p className="font-body text-sm text-muted">
                  No captures yet. Start by submitting your first update.
                </p>
              </PanelCard>
            ) : (
              <div className="space-y-3">
                {recentArtifacts.map((artifact) => (
                  <PanelCard key={artifact.id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-body text-sm text-foreground leading-relaxed line-clamp-2">
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
                          className={`font-mono text-xl font-bold ${getDriftColor(
                            artifact.driftScore
                          )}`}
                        >
                          {artifact.driftScore.toFixed(2)}
                        </span>
                        <MonoLabel className="block text-xs">DRIFT</MonoLabel>
                      </div>
                    </div>
                  </PanelCard>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Team Traction */}
        <div className="space-y-6">
          <PanelCard>
            <MonoLabel className="mb-4 block text-primary">
              TEAM TRACTION
            </MonoLabel>
            {teamMembers.length === 0 ? (
              <p className="font-body text-sm text-muted">No team members.</p>
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
                        <span className="font-body text-sm font-medium text-foreground">
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
                        {Math.round(member.tractionScore * 100)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PanelCard>

          {/* Quick Actions */}
          <PanelCard>
            <MonoLabel className="mb-4 block">QUICK ACTIONS</MonoLabel>
            <div className="space-y-2">
              <Link
                href={`/dashboard/${workspace.id}/capture`}
                className="block font-body text-sm text-muted hover:text-primary transition-colors"
              >
                &rarr; Submit a capture
              </Link>
              <Link
                href={`/dashboard/${workspace.id}/genesis`}
                className="block font-body text-sm text-muted hover:text-primary transition-colors"
              >
                &rarr; Update The Canon
              </Link>
            </div>
          </PanelCard>
        </div>
      </div>
    </div>
  );
}
