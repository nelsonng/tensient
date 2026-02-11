"use client";

import { useState } from "react";

export interface OrgSummary {
  id: string;
  name: string;
  domain: string | null;
  createdAt: string; // serialized Date
  userCount: number;
  workspaceCount: number;
  activeUsers7d: number;
  totalCaptures: number;
  totalArtifacts: number;
  totalActions: number;
  adoptionRate: number;
  lastActivityAt: string | null; // serialized Date
}

export interface WorkspaceDetail {
  id: string;
  name: string;
  orgId: string;
  joinCode: string;
  memberCount: number;
  captureCount: number;
  activeMemberCount7d: number;
  coverageRate: number;
  lastCaptureAt: string | null; // serialized Date
}

function AdoptionBar({ rate }: { rate: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-2 bg-border/30 rounded overflow-hidden">
        <div
          className={`h-full rounded ${
            rate >= 70 ? "bg-success" : rate >= 30 ? "bg-warning" : "bg-destructive"
          }`}
          style={{ width: `${Math.max(rate, 2)}%` }}
        />
      </div>
      <span
        className={`font-mono text-[10px] font-bold ${
          rate >= 70 ? "text-success" : rate >= 30 ? "text-warning" : "text-destructive"
        }`}
      >
        {rate}%
      </span>
    </div>
  );
}

function timeAgo(date: string | null): string {
  if (!date) return "never";
  const d = new Date(date);
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 0) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function NukeModal({
  org,
  onClose,
  onConfirm,
}: {
  org: OrgSummary;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [typedName, setTypedName] = useState("");
  const [nuking, setNuking] = useState(false);
  const [error, setError] = useState("");

  const nameMatches = typedName.trim() === org.name;

  async function handleNuke() {
    setNuking(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/orgs/${org.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to delete organization");
      }
      onConfirm();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
      setNuking(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-panel border border-destructive/30 rounded-lg w-full max-w-md">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-mono text-sm font-bold text-destructive tracking-wider">
            NUKE ORGANIZATION
          </h3>
          <p className="font-mono text-[10px] text-muted mt-1">
            This permanently deletes everything.
          </p>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="bg-destructive/5 border border-destructive/20 rounded p-3">
            <p className="font-mono text-xs text-foreground font-bold mb-2">
              {org.name}
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="font-mono text-[10px] text-muted">USERS</p>
                <p className="font-mono text-xs text-foreground">{org.userCount}</p>
              </div>
              <div>
                <p className="font-mono text-[10px] text-muted">WORKSPACES</p>
                <p className="font-mono text-xs text-foreground">{org.workspaceCount}</p>
              </div>
              <div>
                <p className="font-mono text-[10px] text-muted">CAPTURES</p>
                <p className="font-mono text-xs text-foreground">{org.totalCaptures}</p>
              </div>
            </div>
          </div>

          <p className="font-mono text-[10px] text-muted/70">
            All users, workspaces, captures, artifacts, actions, and related data
            will be permanently destroyed. THIS CANNOT BE UNDONE.
          </p>

          <div>
            <label className="block font-mono text-[10px] tracking-widest text-muted uppercase mb-1">
              TYPE &quot;{org.name}&quot; TO CONFIRM
            </label>
            <input
              type="text"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder={org.name}
              className="w-full bg-background border border-border rounded px-3 py-1.5 font-mono text-xs text-foreground placeholder:text-muted/30 focus:outline-none focus:border-destructive/50"
              autoFocus
            />
          </div>

          {error && (
            <p className="font-mono text-xs text-destructive">{error}</p>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-xs tracking-wider text-muted hover:text-foreground transition-colors cursor-pointer"
          >
            CANCEL
          </button>
          <button
            type="button"
            onClick={handleNuke}
            disabled={!nameMatches || nuking}
            className="px-4 py-1.5 rounded bg-destructive/10 text-destructive border border-destructive/20 font-mono text-xs tracking-wider hover:bg-destructive/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            {nuking ? "NUKING..." : "NUKE FOREVER"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function OrgsClient({
  orgs: initialOrgs,
  workspacesByOrg: initialWsByOrg,
}: {
  orgs: OrgSummary[];
  workspacesByOrg: Record<string, WorkspaceDetail[]>;
}) {
  const [orgs, setOrgs] = useState(initialOrgs);
  const [workspacesByOrg] = useState(initialWsByOrg);
  const [nukeTarget, setNukeTarget] = useState<OrgSummary | null>(null);

  function handleNuked() {
    if (!nukeTarget) return;
    setOrgs((prev) => prev.filter((o) => o.id !== nukeTarget.id));
    setNukeTarget(null);
  }

  const totalOrgs = orgs.length;
  const activeOrgs = orgs.filter((o) => o.activeUsers7d > 0).length;
  const totalUsersAcrossOrgs = orgs.reduce((s, o) => s + o.userCount, 0);

  return (
    <>
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-panel border border-border rounded-lg p-4">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">TOTAL ORGS</p>
          <p className="font-display text-2xl font-bold text-foreground">{totalOrgs}</p>
        </div>
        <div className="bg-panel border border-border rounded-lg p-4">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">ACTIVE ORGS (7D)</p>
          <p className={`font-display text-2xl font-bold ${activeOrgs > 0 ? "text-success" : "text-muted"}`}>
            {activeOrgs}
          </p>
        </div>
        <div className="bg-panel border border-border rounded-lg p-4">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">TOTAL USERS</p>
          <p className="font-display text-2xl font-bold text-foreground">{totalUsersAcrossOrgs}</p>
        </div>
        <div className="bg-panel border border-border rounded-lg p-4">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">ORG ACTIVATION</p>
          <p
            className={`font-display text-2xl font-bold ${
              totalOrgs > 0 && activeOrgs / totalOrgs >= 0.5 ? "text-success" : "text-warning"
            }`}
          >
            {totalOrgs > 0 ? Math.round((activeOrgs / totalOrgs) * 100) : 0}%
          </p>
        </div>
      </div>

      {/* Organization List */}
      {orgs.map((org) => {
        const orgWorkspaces = workspacesByOrg[org.id] || [];
        return (
          <div key={org.id} className="bg-panel border border-border rounded-lg mb-4 overflow-hidden">
            {/* Org Header */}
            <div className="px-5 py-4 border-b border-border">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-mono text-sm font-bold text-foreground tracking-wider">
                    {org.name}
                  </h3>
                  {org.domain && (
                    <p className="font-mono text-[10px] text-primary">{org.domain}</p>
                  )}
                </div>
                <div className="flex items-start gap-3">
                  <div className="text-right">
                    <p className="font-mono text-[10px] text-muted">
                      Last activity: {timeAgo(org.lastActivityAt)}
                    </p>
                    <p className="font-mono text-[10px] text-muted/50">
                      Created: {new Date(org.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNukeTarget(org)}
                    className="px-2 py-1 rounded font-mono text-[10px] tracking-widest text-destructive border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 transition-colors cursor-pointer"
                    title="Delete this organization and all its data"
                  >
                    NUKE
                  </button>
                </div>
              </div>

              {/* Org Metrics */}
              <div className="grid grid-cols-3 md:grid-cols-7 gap-3 mt-3">
                <div>
                  <p className="font-mono text-[10px] text-muted uppercase">USERS</p>
                  <p className="font-mono text-sm text-foreground font-bold">{org.userCount}</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] text-muted uppercase">ACTIVE (7D)</p>
                  <p
                    className={`font-mono text-sm font-bold ${
                      org.activeUsers7d > 0 ? "text-success" : "text-muted/50"
                    }`}
                  >
                    {org.activeUsers7d}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[10px] text-muted uppercase">WORKSPACES</p>
                  <p className="font-mono text-sm text-foreground font-bold">{org.workspaceCount}</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] text-muted uppercase">CAPTURES</p>
                  <p className="font-mono text-sm text-foreground font-bold">{org.totalCaptures}</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] text-muted uppercase">ARTIFACTS</p>
                  <p className="font-mono text-sm text-foreground font-bold">{org.totalArtifacts}</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] text-muted uppercase">ACTIONS</p>
                  <p className="font-mono text-sm text-foreground font-bold">{org.totalActions}</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] text-muted uppercase">ADOPTION</p>
                  <AdoptionBar rate={org.adoptionRate} />
                </div>
              </div>
            </div>

            {/* Workspace Breakdown */}
            {orgWorkspaces.length > 0 && (
              <div>
                <div className="grid grid-cols-[1fr_80px_80px_80px_80px_100px] gap-2 px-5 py-2 border-b border-border/50 text-muted">
                  <span className="font-mono text-[10px] tracking-widest uppercase">WORKSPACE</span>
                  <span className="font-mono text-[10px] tracking-widest uppercase text-center">MEMBERS</span>
                  <span className="font-mono text-[10px] tracking-widest uppercase text-center">ACTIVE</span>
                  <span className="font-mono text-[10px] tracking-widest uppercase text-center">CAPTURES</span>
                  <span className="font-mono text-[10px] tracking-widest uppercase text-center">COVERAGE</span>
                  <span className="font-mono text-[10px] tracking-widest uppercase text-right">LAST ACTIVE</span>
                </div>
                {orgWorkspaces.map((ws) => (
                  <div
                    key={ws.id}
                    className="grid grid-cols-[1fr_80px_80px_80px_80px_100px] gap-2 px-5 py-2 border-b border-border/30 hover:bg-white/2 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-foreground truncate">{ws.name}</p>
                      <p className="font-mono text-[10px] text-muted/50">{ws.joinCode}</p>
                    </div>
                    <p className="font-mono text-xs text-muted text-center self-center">
                      {ws.memberCount}
                    </p>
                    <p
                      className={`font-mono text-xs text-center self-center ${
                        ws.activeMemberCount7d > 0 ? "text-success" : "text-muted/50"
                      }`}
                    >
                      {ws.activeMemberCount7d}
                    </p>
                    <p className="font-mono text-xs text-muted text-center self-center">
                      {ws.captureCount}
                    </p>
                    <div className="flex justify-center self-center">
                      <AdoptionBar rate={ws.coverageRate} />
                    </div>
                    <p className="font-mono text-[10px] text-muted text-right self-center">
                      {timeAgo(ws.lastCaptureAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {orgs.length === 0 && (
        <div className="bg-panel border border-border rounded-lg p-8 text-center">
          <p className="font-mono text-sm text-muted">No organizations yet</p>
        </div>
      )}

      {/* Nuke Modal */}
      {nukeTarget && (
        <NukeModal
          org={nukeTarget}
          onClose={() => setNukeTarget(null)}
          onConfirm={handleNuked}
        />
      )}
    </>
  );
}
