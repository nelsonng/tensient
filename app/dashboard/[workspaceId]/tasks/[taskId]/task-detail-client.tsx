"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatAbsoluteDateTime } from "@/lib/utils";

type TaskStatus = "backlog" | "todo" | "in_progress" | "in_review" | "testing" | "done";
type TaskPriority = "critical" | "high" | "medium" | "low";

interface TaskDetail {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority | null;
  assigneeId: string | null;
  assigneeFirstName: string | null;
  assigneeLastName: string | null;
  assigneeEmail: string | null;
  createdById: string;
  position: number;
  dueDate: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface LinkedFeedback {
  linkId: string;
  relationship: "related" | "blocks";
  feedbackId: string;
  feedbackSubject: string;
  feedbackStatus: string;
  feedbackCategory: string;
  feedbackPriority: string | null;
  feedbackCreatedAt: string;
}

interface FeedbackSearchResult {
  id: string;
  subject: string;
  status: string;
  category: string;
  priority: string | null;
  createdAt: string;
}

interface Member {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "To Do",
  in_progress: "Doing",
  in_review: "In Review",
  testing: "Testing",
  done: "Done",
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  backlog: "text-muted",
  todo: "text-primary",
  in_progress: "text-warning",
  in_review: "text-warning",
  testing: "text-primary/80",
  done: "text-success",
};

const ALL_STATUSES: TaskStatus[] = ["backlog", "todo", "in_progress", "in_review", "testing", "done"];
const ALL_PRIORITIES: TaskPriority[] = ["critical", "high", "medium", "low"];

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; active: string; inactive: string }> = {
  critical: {
    label: "CRITICAL",
    active: "border-destructive/50 bg-destructive/15 text-destructive font-bold",
    inactive: "border-border/40 text-muted/40 hover:text-destructive/60 hover:border-destructive/30",
  },
  high: {
    label: "HIGH",
    active: "border-warning/40 bg-warning/10 text-warning",
    inactive: "border-border/40 text-muted/40 hover:text-warning/70 hover:border-warning/30",
  },
  medium: {
    label: "MED",
    active: "border-border bg-panel text-foreground/70",
    inactive: "border-border/40 text-muted/30 hover:text-foreground/50 hover:border-border",
  },
  low: {
    label: "LOW",
    active: "border-border/60 bg-background text-muted/60",
    inactive: "border-border/30 text-muted/20 hover:text-muted/50 hover:border-border/50",
  },
};

const FEEDBACK_CATEGORY_LABELS: Record<string, string> = {
  bug_report: "BUG",
  feature_request: "FEATURE",
  help_request: "HELP",
  urgent_issue: "URGENT",
};

const FEEDBACK_CATEGORY_COLORS: Record<string, string> = {
  bug_report: "text-destructive border-destructive/30 bg-destructive/10",
  feature_request: "text-primary border-primary/30 bg-primary/10",
  help_request: "text-muted border-border",
  urgent_issue: "text-warning border-warning/30 bg-warning/10",
};

export function TaskDetailClient({
  workspaceId,
  task: initialTask,
  initialLinkedFeedback,
  members,
}: {
  workspaceId: string;
  task: TaskDetail;
  initialLinkedFeedback: LinkedFeedback[];
  members: Member[];
}) {
  const router = useRouter();
  const [task, setTask] = useState(initialTask);
  const [linkedFeedback, setLinkedFeedback] = useState(initialLinkedFeedback);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDescription, setEditDescription] = useState(task.description ?? "");
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [linkSearch, setLinkSearch] = useState("");
  const [linkSearchResults, setLinkSearchResults] = useState<FeedbackSearchResult[]>([]);
  const [isSearchingFeedback, setIsSearchingFeedback] = useState(false);
  const [linkingFeedbackId, setLinkingFeedbackId] = useState<string | null>(null);

  async function patchTask(patch: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}?workspaceId=${workspaceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Failed to update");
      const updated = await res.json();
      setTask((prev) => ({
        ...prev,
        ...updated,
        createdAt: prev.createdAt,
        updatedAt: updated.updatedAt ?? prev.updatedAt,
      }));
    } catch {
      alert("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    if (!editTitle.trim()) return;
    await patchTask({ title: editTitle.trim(), description: editDescription.trim() || null });
    setIsEditing(false);
  }

  async function archiveTask() {
    if (!confirm("Archive this task? You can restore it from the archived view.")) return;
    await patchTask({ archive: true });
    router.push(`/dashboard/${workspaceId}/tasks`);
  }

  async function deleteTask() {
    if (!confirm("Permanently delete this task? This cannot be undone.")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}?workspaceId=${workspaceId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      router.push(`/dashboard/${workspaceId}/tasks`);
    } catch {
      alert("Failed to delete task.");
      setSaving(false);
    }
  }

  async function unlinkFeedback(feedbackSubmissionId: string) {
    setUnlinkingId(feedbackSubmissionId);
    try {
      const res = await fetch(
        `/api/tasks/${task.id}/feedback-links?workspaceId=${workspaceId}&feedbackSubmissionId=${feedbackSubmissionId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to unlink");
      setLinkedFeedback((prev) => prev.filter((f) => f.feedbackId !== feedbackSubmissionId));
    } catch {
      alert("Failed to unlink feedback.");
    } finally {
      setUnlinkingId(null);
    }
  }

  useEffect(() => {
    const term = linkSearch.trim();
    if (term.length < 2) {
      setLinkSearchResults([]);
      setIsSearchingFeedback(false);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setIsSearchingFeedback(true);
      try {
        const res = await fetch(
          `/api/feedback?workspaceId=${workspaceId}&search=${encodeURIComponent(term)}`
        );
        if (!res.ok) throw new Error("Failed to search feedback");
        const rows: FeedbackSearchResult[] = await res.json();
        const linkedIds = new Set(linkedFeedback.map((f) => f.feedbackId));
        setLinkSearchResults(rows.filter((row) => !linkedIds.has(row.id)).slice(0, 5));
      } catch {
        setLinkSearchResults([]);
      } finally {
        setIsSearchingFeedback(false);
      }
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [linkSearch, linkedFeedback, workspaceId]);

  async function linkFeedback(result: FeedbackSearchResult) {
    setLinkingFeedbackId(result.id);
    try {
      const res = await fetch(`/api/tasks/${task.id}/feedback-links?workspaceId=${workspaceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedbackSubmissionId: result.id, relationship: "related" }),
      });
      if (!res.ok) throw new Error("Failed to link feedback");
      const link = await res.json();
      setLinkedFeedback((prev) => [
        ...prev,
        {
          linkId: link.id,
          relationship: link.relationship,
          feedbackId: result.id,
          feedbackSubject: result.subject,
          feedbackStatus: result.status,
          feedbackCategory: result.category,
          feedbackPriority: result.priority,
          feedbackCreatedAt: result.createdAt,
        },
      ]);
      setLinkSearch("");
      setLinkSearchResults([]);
    } catch {
      alert("Failed to link feedback.");
    } finally {
      setLinkingFeedbackId(null);
    }
  }

  const assigneeName = [task.assigneeFirstName, task.assigneeLastName].filter(Boolean).join(" ")
    || task.assigneeEmail
    || "";

  return (
    <div className="mx-auto max-w-[1200px] px-6">
      {/* Back link */}
      <div className="mb-4">
        <Link
          href={`/dashboard/${workspaceId}/tasks`}
          className="font-mono text-xs uppercase tracking-wider text-muted hover:text-foreground"
        >
          ← Tasks
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        {/* ── Left column ── */}
        <div className="space-y-5">
          {/* Title + description */}
          <div className="rounded-lg border border-border bg-panel p-5">
            {isEditing ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded border border-border bg-background px-3 py-2 font-display text-xl font-bold text-foreground focus:border-primary focus:outline-none"
                  autoFocus
                />
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={5}
                  placeholder="Description…"
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/40 focus:border-primary focus:outline-none resize-none"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void saveEdit()}
                    disabled={saving || !editTitle.trim()}
                    className="rounded border border-primary/30 bg-primary/10 px-3 py-1.5 font-mono text-xs tracking-wider text-primary hover:bg-primary/20 disabled:opacity-40 transition-colors"
                  >
                    {saving ? "SAVING…" : "SAVE"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsEditing(false); setEditTitle(task.title); setEditDescription(task.description ?? ""); }}
                    className="rounded border border-border px-3 py-1.5 font-mono text-xs text-muted hover:text-foreground transition-colors"
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h1 className="font-display text-xl font-bold tracking-tight text-foreground">
                    {task.title}
                  </h1>
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="shrink-0 font-mono text-[10px] text-muted/60 hover:text-foreground transition-colors mt-1"
                  >
                    EDIT
                  </button>
                </div>
                <p className="mt-0.5 font-mono text-[11px] text-muted">
                  {formatAbsoluteDateTime(task.createdAt)}
                </p>
                {task.description ? (
                  <p className="mt-4 whitespace-pre-wrap text-sm text-foreground leading-relaxed">
                    {task.description}
                  </p>
                ) : (
                  <p className="mt-4 text-sm text-muted/40 italic">No description</p>
                )}
              </div>
            )}
          </div>

          {/* Linked Feedback */}
          <div className="rounded-lg border border-border bg-panel p-5">
            <h2 className="mb-4 font-mono text-[11px] uppercase tracking-widest text-muted">
              Linked Feedback
            </h2>
            {linkedFeedback.length === 0 ? (
              <p className="text-sm text-muted/50">No feedback linked to this task.</p>
            ) : (
              <div className="space-y-2">
                {linkedFeedback.map((f) => (
                  <div
                    key={f.linkId}
                    className="flex items-center gap-3 rounded border border-border bg-background px-3 py-2.5"
                  >
                    <span
                      className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] tracking-wider ${FEEDBACK_CATEGORY_COLORS[f.feedbackCategory] ?? "text-muted border-border"}`}
                    >
                      {FEEDBACK_CATEGORY_LABELS[f.feedbackCategory] ?? f.feedbackCategory}
                    </span>
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/dashboard/${workspaceId}/feedback/${f.feedbackId}`}
                        className="block truncate text-sm text-foreground hover:text-primary transition-colors"
                      >
                        {f.feedbackSubject}
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-[10px] text-muted uppercase">
                          {f.feedbackStatus.replace(/_/g, " ")}
                        </span>
                        <span className="font-mono text-[10px] text-muted/40">
                          {f.relationship === "blocks" ? "· blocks resolution" : "· related"}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={unlinkingId === f.feedbackId}
                      onClick={() => void unlinkFeedback(f.feedbackId)}
                      className="shrink-0 font-mono text-[10px] text-muted/40 hover:text-destructive transition-colors"
                      title="Unlink"
                    >
                      {unlinkingId === f.feedbackId ? "…" : "✕"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 border-t border-border pt-3">
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted">
                Link Feedback
              </label>
              <input
                type="text"
                value={linkSearch}
                onChange={(e) => setLinkSearch(e.target.value)}
                placeholder="Search feedback by subject…"
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/40 focus:border-primary focus:outline-none"
              />
              {isSearchingFeedback && (
                <p className="mt-2 font-mono text-[10px] text-muted">Searching…</p>
              )}
              {!isSearchingFeedback && linkSearch.trim().length >= 2 && linkSearchResults.length > 0 && (
                <div className="mt-2 space-y-1 rounded border border-border bg-background p-1.5">
                  {linkSearchResults.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => void linkFeedback(result)}
                      disabled={linkingFeedbackId === result.id}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-panel disabled:opacity-50"
                    >
                      <span
                        className={`rounded border px-1.5 py-0.5 font-mono text-[10px] tracking-wider ${FEEDBACK_CATEGORY_COLORS[result.category] ?? "text-muted border-border"}`}
                      >
                        {FEEDBACK_CATEGORY_LABELS[result.category] ?? result.category}
                      </span>
                      <span className="truncate text-sm text-foreground">{result.subject}</span>
                    </button>
                  ))}
                </div>
              )}
              {!isSearchingFeedback &&
                linkSearch.trim().length >= 2 &&
                linkSearchResults.length === 0 && (
                  <p className="mt-2 font-mono text-[10px] text-muted/60">
                    No matching feedback to link.
                  </p>
                )}
            </div>
          </div>
        </div>

        {/* ── Right sidebar ── */}
        <div className="space-y-4">
          {/* Status */}
          <div className="rounded-lg border border-border bg-panel p-4">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted">Status</p>
            <select
              value={task.status}
              disabled={saving}
              onChange={(e) => void patchTask({ status: e.target.value })}
              className={`w-full rounded border border-border bg-background px-2 py-1.5 font-mono text-xs focus:border-primary focus:outline-none ${STATUS_COLORS[task.status]}`}
            >
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div className="rounded-lg border border-border bg-panel p-4">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted">Priority</p>
            <div className="flex items-center gap-1.5">
              {ALL_PRIORITIES.map((p) => {
                const cfg = PRIORITY_CONFIG[p];
                const isActive = task.priority === p;
                return (
                  <button
                    key={p}
                    type="button"
                    disabled={saving}
                    onClick={() => void patchTask({ priority: p })}
                    className={`flex-1 rounded border py-1.5 font-mono text-[10px] tracking-wider transition-colors ${isActive ? cfg.active : cfg.inactive}`}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>
            {task.priority && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void patchTask({ priority: null })}
                className="mt-1.5 font-mono text-[10px] text-muted/40 hover:text-muted transition-colors"
              >
                clear
              </button>
            )}
          </div>

          {/* Assignee */}
          <div className="rounded-lg border border-border bg-panel p-4">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted">Assigned</p>
            <select
              value={task.assigneeId ?? ""}
              disabled={saving}
              onChange={(e) => void patchTask({ assigneeId: e.target.value || null })}
              className="w-full rounded border border-border bg-background px-2 py-1.5 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
            >
              <option value="">-- Unassigned</option>
              {members.map((m) => {
                const name = [m.firstName, m.lastName].filter(Boolean).join(" ") || m.email || m.id;
                return <option key={m.id} value={m.id}>{name}</option>;
              })}
            </select>
          </div>

          {/* Due Date */}
          <div className="rounded-lg border border-border bg-panel p-4">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted">Due Date</p>
            <input
              type="date"
              value={task.dueDate ? task.dueDate.slice(0, 10) : ""}
              disabled={saving}
              onChange={(e) => void patchTask({ dueDate: e.target.value || null })}
              className="w-full rounded border border-border bg-background px-2 py-1.5 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
            />
            {task.dueDate && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void patchTask({ dueDate: null })}
                className="mt-1 font-mono text-[10px] text-muted/40 hover:text-muted transition-colors"
              >
                clear
              </button>
            )}
          </div>

          {/* Status info */}
          {task.archivedAt && (
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
              <p className="font-mono text-[10px] text-warning">
                Archived {formatAbsoluteDateTime(task.archivedAt)}
              </p>
              <button
                type="button"
                disabled={saving}
                onClick={() => void patchTask({ unarchive: true })}
                className="mt-2 font-mono text-[10px] text-muted hover:text-foreground transition-colors"
              >
                Restore task
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="rounded-lg border border-border bg-panel p-4 space-y-2">
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted">Actions</p>
            {!task.archivedAt && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void archiveTask()}
                className="w-full rounded border border-border px-3 py-2 font-mono text-xs tracking-wider text-muted hover:text-foreground hover:border-foreground/30 disabled:opacity-40 transition-colors"
              >
                ARCHIVE TASK
              </button>
            )}
            <button
              type="button"
              disabled={saving}
              onClick={() => void deleteTask()}
              className="w-full rounded border border-destructive/30 bg-destructive/5 px-3 py-2 font-mono text-xs tracking-wider text-destructive hover:bg-destructive/10 disabled:opacity-40 transition-colors"
            >
              DELETE TASK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
