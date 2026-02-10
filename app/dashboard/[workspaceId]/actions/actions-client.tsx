"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PanelCard } from "@/components/panel-card";
import { MonoLabel } from "@/components/mono-label";
import { SlantedButton } from "@/components/slanted-button";

type ActionStatus = "open" | "in_progress" | "blocked" | "done" | "wont_do";
type ActionPriority = "critical" | "high" | "medium" | "low";

interface ActionItem {
  id: string;
  title: string;
  description: string | null;
  status: ActionStatus;
  priority: ActionPriority;
  goalId: string | null;
  goalAlignmentScore: number | null;
  coachAttribution: string | null;
  userName: string;
  createdAt: string;
  updatedAt: string;
}

interface Goal {
  id: string;
  content: string;
}

interface ActionsClientProps {
  workspaceId: string;
  actions: ActionItem[];
  goals: Goal[];
}

const STATUS_ORDER: ActionStatus[] = [
  "open",
  "in_progress",
  "blocked",
  "done",
  "wont_do",
];

const STATUS_LABELS: Record<ActionStatus, string> = {
  open: "OPEN",
  in_progress: "IN PROGRESS",
  blocked: "BLOCKED",
  done: "DONE",
  wont_do: "WON'T DO",
};

const STATUS_COLORS: Record<ActionStatus, string> = {
  open: "border-primary/50 text-primary",
  in_progress: "border-blue-500/50 text-blue-400",
  blocked: "border-destructive/50 text-destructive",
  done: "border-muted text-muted",
  wont_do: "border-muted text-muted line-through",
};

const PRIORITY_LABELS: Record<ActionPriority, string> = {
  critical: "CRITICAL",
  high: "HIGH",
  medium: "MED",
  low: "LOW",
};

const PRIORITY_COLORS: Record<ActionPriority, string> = {
  critical: "text-destructive",
  high: "text-warning",
  medium: "text-muted",
  low: "text-muted/50",
};

function timeAgo(date: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(date).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function ActionsClient({
  workspaceId,
  actions: initialActions,
  goals,
}: ActionsClientProps) {
  const router = useRouter();
  const [actionsList, setActionsList] = useState(initialActions);
  const [statusFilter, setStatusFilter] = useState<ActionStatus | "all">("all");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<ActionPriority>("medium");
  const [creating, setCreating] = useState(false);

  const filtered =
    statusFilter === "all"
      ? actionsList
      : actionsList.filter((a) => a.status === statusFilter);

  // Sort: critical first, then by status, then by date
  const sorted = [...filtered].sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const statusOrder = { open: 0, in_progress: 1, blocked: 2, done: 3, wont_do: 4 };
    const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (pDiff !== 0) return pDiff;
    const sDiff = statusOrder[a.status] - statusOrder[b.status];
    if (sDiff !== 0) return sDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const unlinkedCount = actionsList.filter(
    (a) =>
      !a.goalId &&
      a.status !== "done" &&
      a.status !== "wont_do"
  ).length;

  const updateAction = useCallback(
    async (actionId: string, updates: Partial<ActionItem>) => {
      try {
        const res = await fetch(
          `/api/workspaces/${workspaceId}/actions/${actionId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates),
          }
        );
        if (res.ok) {
          setActionsList((prev) =>
            prev.map((a) =>
              a.id === actionId ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a
            )
          );
        }
      } catch {
        // silently fail
      }
    },
    [workspaceId]
  );

  const cycleStatus = useCallback(
    (action: ActionItem) => {
      const idx = STATUS_ORDER.indexOf(action.status);
      const next = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
      updateAction(action.id, { status: next });
    },
    [updateAction]
  );

  const createAction = useCallback(async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/actions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: newTitle.trim(),
            priority: newPriority,
          }),
        }
      );
      if (res.ok) {
        setNewTitle("");
        setNewPriority("medium");
        setShowCreateForm(false);
        router.refresh();
      }
    } catch {
      // silently fail
    } finally {
      setCreating(false);
    }
  }, [workspaceId, newTitle, newPriority, router]);

  // Status counts
  const statusCounts = actionsList.reduce(
    (acc, a) => {
      acc[a.status] = (acc[a.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="mx-auto max-w-[1000px] px-6 pb-24">
      <div className="flex items-center justify-between mb-6">
        <div>
          <MonoLabel className="mb-2 block text-primary">ACTIONS</MonoLabel>
          <h1 className="font-display text-2xl font-bold uppercase tracking-tight">
            Action Items
          </h1>
          <p className="font-body text-base text-muted mt-2">
            Concrete next steps extracted from your team&apos;s thoughts. Click status to cycle it.
          </p>
        </div>
        <SlantedButton onClick={() => setShowCreateForm(!showCreateForm)}>
          + ACTION
        </SlantedButton>
      </div>

      {/* Unlinked callout */}
      {unlinkedCount > 0 && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 mb-6">
          <span className="font-mono text-xs text-warning">
            {unlinkedCount} ACTION{unlinkedCount !== 1 ? "S" : ""} NOT LINKED
            TO ANY GOAL
          </span>
          <p className="font-body text-sm text-muted mt-1">
            These actions may indicate focus drift. Consider linking them to a
            goal or marking as won&apos;t do.
          </p>
        </div>
      )}

      {/* Create form */}
      {showCreateForm && (
        <PanelCard className="mb-6">
          <MonoLabel className="mb-3 block">NEW ACTION</MonoLabel>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="What needs to happen?"
            className="w-full rounded border border-border bg-background px-4 py-2 font-body text-base text-foreground placeholder:text-muted focus:border-primary focus:outline-none mb-3"
            onKeyDown={(e) => e.key === "Enter" && createAction()}
          />
          <div className="flex items-center gap-3">
            <select
              value={newPriority}
              onChange={(e) =>
                setNewPriority(e.target.value as ActionPriority)
              }
              className="rounded border border-border bg-background px-3 py-1.5 font-mono text-xs text-foreground"
            >
              <option value="critical">CRITICAL</option>
              <option value="high">HIGH</option>
              <option value="medium">MEDIUM</option>
              <option value="low">LOW</option>
            </select>
            <SlantedButton
              onClick={createAction}
              disabled={creating || newTitle.trim().length < 2}
            >
              {creating ? "CREATING..." : "CREATE"}
            </SlantedButton>
            <button
              onClick={() => setShowCreateForm(false)}
              className="font-mono text-xs text-muted hover:text-foreground cursor-pointer"
            >
              CANCEL
            </button>
          </div>
        </PanelCard>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setStatusFilter("all")}
          className={`px-3 py-1 rounded font-mono text-xs border cursor-pointer transition-colors ${
            statusFilter === "all"
              ? "border-primary text-primary"
              : "border-border text-muted hover:text-foreground"
          }`}
        >
          ALL ({actionsList.length})
        </button>
        {STATUS_ORDER.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded font-mono text-xs border cursor-pointer transition-colors ${
              statusFilter === s
                ? "border-primary text-primary"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            {STATUS_LABELS[s]} ({statusCounts[s] || 0})
          </button>
        ))}
      </div>

      {/* Actions list */}
      {sorted.length === 0 ? (
        <PanelCard className="text-center py-12">
          <p className="font-body text-base text-muted">
            {statusFilter === "all"
              ? "No actions yet. Share a thought and actions will be extracted automatically."
              : `No ${STATUS_LABELS[statusFilter].toLowerCase()} actions.`}
          </p>
        </PanelCard>
      ) : (
        <div className="space-y-2">
          {sorted.map((action) => (
            <PanelCard
              key={action.id}
              className={`p-4 ${
                action.status === "done" || action.status === "wont_do"
                  ? "opacity-60"
                  : ""
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Status toggle */}
                <button
                  onClick={() => cycleStatus(action)}
                  className={`shrink-0 mt-0.5 px-2 py-0.5 rounded border font-mono text-xs cursor-pointer transition-colors ${STATUS_COLORS[action.status]}`}
                  title={`Click to change status (currently: ${STATUS_LABELS[action.status]})`}
                >
                  {STATUS_LABELS[action.status]}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p
                    className={`font-body text-base text-foreground ${
                      action.status === "wont_do" ? "line-through" : ""
                    }`}
                  >
                    {action.title}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <span className={`font-mono text-xs ${PRIORITY_COLORS[action.priority]}`}>
                      {PRIORITY_LABELS[action.priority]}
                    </span>
                    <span className="font-mono text-xs text-muted">
                      {action.userName}
                    </span>
                    <span className="font-mono text-xs text-muted">
                      {timeAgo(action.createdAt)}
                    </span>
                    {action.coachAttribution && (
                      <span className="font-mono text-xs text-muted">
                        via {action.coachAttribution}
                      </span>
                    )}
                  </div>
                </div>

                {/* Goal linkage */}
                <div className="shrink-0 text-right">
                  {action.goalId ? (
                    <span className="font-mono text-xs text-primary" title="Linked to a goal">
                      GOAL-LINKED
                    </span>
                  ) : (
                    action.status !== "done" &&
                    action.status !== "wont_do" && (
                      <span className="font-mono text-xs text-warning" title="Not linked to any goal">
                        NO GOAL
                      </span>
                    )
                  )}
                  {action.goalAlignmentScore != null && action.goalAlignmentScore > 0 && (
                    <span className="block font-mono text-xs text-muted mt-0.5">
                      {Math.round(action.goalAlignmentScore * 100)}% aligned
                    </span>
                  )}
                </div>
              </div>
            </PanelCard>
          ))}
        </div>
      )}
    </div>
  );
}
