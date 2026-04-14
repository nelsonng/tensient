"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatAbsoluteDateTime } from "@/lib/utils";

type FeedbackCategory = "bug_report" | "feature_request" | "help_request" | "urgent_issue";
type FeedbackStatus =
  | "new"
  | "ai_processed"
  | "reviewing"
  | "awaiting_response"
  | "escalated"
  | "auto_responded"
  | "converted"
  | "resolved"
  | "spam";
type FeedbackPriority = "critical" | "high" | "medium" | "low";

interface FeedbackSubmission {
  id: string;
  trackingId: string;
  workspaceId: string;
  category: FeedbackCategory;
  subject: string;
  description: string;
  status: FeedbackStatus;
  priority: FeedbackPriority | null;
  aiPriority: FeedbackPriority | null;
  aiSummary: string | null;
  aiResponseDraft: string | null;
  sentimentScore: number | null;
  duplicateOfId: string | null;
  signalId: string | null;
  submitterEmail: string | null;
  submitterName: string | null;
  submitterExternalId: string | null;
  submitterIsAuthenticated: boolean | null;
  submitterMeta: unknown;
  assigneeId: string | null;
  assigneeFirstName: string | null;
  assigneeLastName: string | null;
  assigneeEmail: string | null;
  currentUrl: string | null;
  referrerUrl: string | null;
  pageTitle: string | null;
  userAgent: string | null;
  locale: string | null;
  timezone: string | null;
  ipAddress: string | null;
  geoCity: string | null;
  geoRegion: string | null;
  geoCountry: string | null;
  browserInfo: unknown;
  screenInfo: unknown;
  consoleErrors: unknown;
  customContext: unknown;
  tags: string[] | null;
  ratingValue: number | null;
  ratingScale: number | null;
  ratingType: string | null;
  responses: unknown;
  createdAt: string;
  updatedAt: string;
}

interface ReplyRow {
  id: string;
  feedbackSubmissionId: string;
  content: string;
  authorType: string;
  authorName: string | null;
  authorUserId: string | null;
  isInternal: boolean;
  createdAt: string;
}

interface Member {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}

type TaskStatus = "backlog" | "todo" | "in_progress" | "in_review" | "testing" | "done";
type TaskPriority = "critical" | "high" | "medium" | "low";

interface LinkedTask {
  linkId: string;
  relationship: "related" | "blocks";
  taskId: string;
  taskTitle: string;
  taskStatus: TaskStatus;
  taskPriority: TaskPriority | null;
  taskAssigneeId: string | null;
  taskCreatedAt: string;
}

const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  bug_report: "BUG",
  feature_request: "FEATURE",
  help_request: "HELP",
  urgent_issue: "URGENT",
};

const CATEGORY_COLORS: Record<FeedbackCategory, string> = {
  bug_report: "text-destructive border-destructive/30 bg-destructive/10",
  feature_request: "text-primary border-primary/30 bg-primary/10",
  help_request: "text-muted border-border",
  urgent_issue: "text-warning border-warning/30 bg-warning/10",
};

const STATUS_COLORS: Record<FeedbackStatus, string> = {
  new: "text-primary",
  ai_processed: "text-muted",
  reviewing: "text-warning",
  awaiting_response: "text-warning",
  escalated: "text-destructive",
  auto_responded: "text-muted",
  converted: "text-success",
  resolved: "text-success",
  spam: "text-muted",
};

const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "To Do",
  in_progress: "Doing",
  in_review: "In Review",
  testing: "Testing",
  done: "Done",
};

const ALL_STATUSES: FeedbackStatus[] = [
  "new",
  "reviewing",
  "awaiting_response",
  "escalated",
  "resolved",
  "converted",
  "spam",
  "ai_processed",
  "auto_responded",
];

const ALL_PRIORITIES: FeedbackPriority[] = ["critical", "high", "medium", "low"];

const PRIORITY_CONFIG: Record<
  FeedbackPriority,
  { label: string; active: string; inactive: string }
> = {
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

function geoLabel(sub: FeedbackSubmission) {
  const parts = [sub.geoCity, sub.geoRegion, sub.geoCountry].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function submitterLabel(sub: FeedbackSubmission): string {
  if (sub.submitterEmail) return sub.submitterEmail;
  if (sub.submitterName) return sub.submitterName;
  if (sub.submitterExternalId) return sub.submitterExternalId;
  return "Anonymous";
}

export function FeedbackDetailClient({
  workspaceId,
  submission: initialSubmission,
  initialReplies,
  initialLinkedTasks,
  members,
}: {
  workspaceId: string;
  submission: FeedbackSubmission;
  initialReplies: ReplyRow[];
  initialLinkedTasks: LinkedTask[];
  members: Member[];
}) {
  const router = useRouter();
  const [submission, setSubmission] = useState(initialSubmission);
  const [replies, setReplies] = useState(initialReplies);
  const [saving, setSaving] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [submittingReply, setSubmittingReply] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState(submission.subject);
  const [taskDescription, setTaskDescription] = useState(submission.description ?? "");
  const [creatingTask, setCreatingTask] = useState(false);
  const [linkedTasks, setLinkedTasks] = useState(initialLinkedTasks);

  async function patchSubmission(patch: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/feedback/${submission.id}?workspaceId=${workspaceId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        }
      );
      if (!res.ok) throw new Error("Failed to update");
      const updated = await res.json();
      setSubmission((prev) => ({
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

  async function submitReply() {
    if (!replyText.trim() || submittingReply) return;
    setSubmittingReply(true);
    try {
      const res = await fetch(
        `/api/feedback/${submission.id}/replies?workspaceId=${workspaceId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: replyText.trim(), isInternal }),
        }
      );
      if (!res.ok) throw new Error("Failed to post reply");
      const reply = await res.json();
      setReplies((prev) => [...prev, reply]);
      setReplyText("");
      if (!isInternal) {
        setSubmission((prev) => ({ ...prev, status: "awaiting_response" }));
      }
    } catch {
      alert("Failed to post reply.");
    } finally {
      setSubmittingReply(false);
    }
  }

  async function convertToTask() {
    if (!taskTitle.trim()) return;
    setCreatingTask(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          title: taskTitle.trim(),
          description: taskDescription.trim() || null,
          status: "backlog",
        }),
      });
      if (!res.ok) throw new Error("Failed to create task");
      const task = await res.json();

      // Link the feedback to the task
      const linkRes = await fetch(`/api/tasks/${task.id}/feedback-links?workspaceId=${workspaceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedbackSubmissionId: submission.id, relationship: "blocks" }),
      });
      if (!linkRes.ok) throw new Error("Failed to link feedback to task");
      const link = await linkRes.json();

      setLinkedTasks((prev) => [
        ...prev,
        {
          linkId: link.id,
          relationship: link.relationship,
          taskId: task.id,
          taskTitle: task.title,
          taskStatus: task.status,
          taskPriority: task.priority,
          taskAssigneeId: task.assigneeId,
          taskCreatedAt: task.createdAt,
        },
      ]);
      setShowTaskModal(false);
    } catch {
      alert("Failed to create task.");
    } finally {
      setCreatingTask(false);
    }
  }

  async function convertToSignal() {
    if (!confirm("Convert this feedback to a Signal?")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/signals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `[FEEDBACK] ${submission.subject}\n\n${submission.description}`,
          source: "feedback",
        }),
      });
      if (!res.ok) throw new Error("Failed to create signal");
      const signal = await res.json();
      await patchSubmission({ status: "converted", signalId: signal.id });
      router.push(`/dashboard/${workspaceId}/synthesis/signals/${signal.id}`);
    } catch {
      alert("Failed to convert to signal.");
    } finally {
      setSaving(false);
    }
  }

  const geo = geoLabel(submission);

  return (
    <>
    <div className="mx-auto max-w-[1200px] px-6">
      {/* Back link */}
      <div className="mb-4">
        <Link
          href={`/dashboard/${workspaceId}/feedback`}
          className="font-mono text-xs uppercase tracking-wider text-muted hover:text-foreground"
        >
          ← Feedback
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        {/* ── Left column: main content + reply thread ── */}
        <div className="space-y-5">
          {/* Header */}
          <div className="rounded-lg border border-border bg-panel p-5">
            <div className="flex items-start gap-3">
              <span
                className={`mt-0.5 inline-block rounded border px-1.5 py-0.5 font-mono text-[10px] tracking-wider ${CATEGORY_COLORS[submission.category]}`}
              >
                {CATEGORY_LABELS[submission.category]}
              </span>
              <div className="flex-1 min-w-0">
                <h1 className="font-display text-xl font-bold tracking-tight text-foreground">
                  {submission.subject}
                </h1>
                <p className="mt-0.5 font-mono text-[11px] text-muted">
                  {formatAbsoluteDateTime(submission.createdAt)}
                  {submission.trackingId && (
                    <> · <span className="opacity-60">{submission.trackingId}</span></>
                  )}
                </p>
              </div>
            </div>

            <p className="mt-4 whitespace-pre-wrap text-sm text-foreground leading-relaxed">
              {submission.description}
            </p>

            {submission.tags && submission.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {submission.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {submission.aiSummary && (
              <div className="mt-4 rounded border border-primary/20 bg-primary/5 px-3 py-2">
                <p className="font-mono text-[10px] uppercase tracking-widest text-primary mb-1">
                  AI Summary
                </p>
                <p className="text-sm text-foreground">{submission.aiSummary}</p>
              </div>
            )}
          </div>

          {/* Linked tasks */}
          <div className="rounded-lg border border-border bg-panel p-5">
            <h2 className="mb-4 font-mono text-[11px] uppercase tracking-widest text-muted">
              Linked Tasks
            </h2>
            {linkedTasks.length === 0 ? (
              <p className="text-sm text-muted/50">No tasks linked to this feedback yet.</p>
            ) : (
              <div className="space-y-2">
                {linkedTasks.map((task) => (
                  <div
                    key={task.linkId}
                    className="flex items-center gap-3 rounded border border-border bg-background px-3 py-2.5"
                  >
                    <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted">
                      {TASK_STATUS_LABELS[task.taskStatus]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/dashboard/${workspaceId}/tasks/${task.taskId}`}
                        className="block truncate text-sm text-foreground hover:text-primary transition-colors"
                      >
                        {task.taskTitle}
                      </Link>
                      <span className="font-mono text-[10px] text-muted/40">
                        {task.relationship === "blocks" ? "blocks resolution" : "related"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reply thread */}
          <div className="rounded-lg border border-border bg-panel p-5">
            <h2 className="mb-4 font-mono text-[11px] uppercase tracking-widest text-muted">
              Replies
            </h2>

            {replies.length === 0 && (
              <p className="text-sm text-muted">No replies yet.</p>
            )}

            <div className="space-y-4">
              {replies.map((reply) => (
                <div
                  key={reply.id}
                  className={`rounded border px-4 py-3 ${
                    reply.isInternal
                      ? "border-warning/20 bg-warning/5"
                      : reply.authorType === "team"
                        ? "border-primary/20 bg-primary/5"
                        : "border-border bg-background"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[11px] text-foreground font-semibold">
                      {reply.authorName ?? reply.authorType.toUpperCase()}
                    </span>
                    {reply.isInternal && (
                      <span className="font-mono text-[10px] text-warning border border-warning/30 rounded px-1">
                        INTERNAL
                      </span>
                    )}
                    <span className="font-mono text-[10px] text-muted ml-auto">
                      {formatAbsoluteDateTime(reply.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {reply.content}
                  </p>
                </div>
              ))}
            </div>

            {/* Reply composer */}
            <div className="mt-5 space-y-2">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={4}
                placeholder="Write a reply…"
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/40 focus:border-primary focus:outline-none resize-none"
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsInternal(false);
                    void submitReply();
                  }}
                  disabled={!replyText.trim() || submittingReply}
                  className="rounded border border-primary/30 bg-primary/10 px-3 py-1.5 font-mono text-xs tracking-wider text-primary hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {submittingReply ? "SENDING…" : "REPLY"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsInternal(true);
                    void submitReply();
                  }}
                  disabled={!replyText.trim() || submittingReply}
                  className="rounded border border-warning/30 bg-warning/5 px-3 py-1.5 font-mono text-xs tracking-wider text-warning hover:bg-warning/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  INTERNAL NOTE
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right column: triage sidebar ── */}
        <div className="space-y-4">
          {/* Status */}
          <div className="rounded-lg border border-border bg-panel p-4">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted">
              Status
            </p>
            <select
              value={submission.status}
              disabled={saving}
              onChange={(e) =>
                void patchSubmission({ status: e.target.value })
              }
              className={`w-full rounded border border-border bg-background px-2 py-1.5 font-mono text-xs focus:border-primary focus:outline-none ${STATUS_COLORS[submission.status]}`}
            >
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ").toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div className="rounded-lg border border-border bg-panel p-4">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted">
              Priority
            </p>
            <div className="flex items-center gap-1.5">
              {ALL_PRIORITIES.map((p) => {
                const cfg = PRIORITY_CONFIG[p];
                const isActive = submission.priority === p;
                return (
                  <button
                    key={p}
                    type="button"
                    disabled={saving}
                    onClick={() => void patchSubmission({ priority: p })}
                    className={`flex-1 rounded border py-1.5 font-mono text-[10px] tracking-wider transition-colors ${
                      isActive ? cfg.active : cfg.inactive
                    }`}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>
            {submission.priority && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void patchSubmission({ priority: null })}
                className="mt-1.5 font-mono text-[10px] text-muted/40 hover:text-muted transition-colors"
              >
                clear
              </button>
            )}
            {submission.aiPriority && (
              <p className="mt-2 font-mono text-[10px] text-warning">
                AI: {submission.aiPriority.toUpperCase()}
              </p>
            )}
          </div>

          {/* Assignee */}
          <div className="rounded-lg border border-border bg-panel p-4">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted">
              Assigned
            </p>
            <select
              value={submission.assigneeId ?? ""}
              disabled={saving}
              onChange={(e) =>
                void patchSubmission({ assigneeId: e.target.value || null })
              }
              className="w-full rounded border border-border bg-background px-2 py-1.5 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
            >
              <option value="">-- Unassigned</option>
              {members.map((m) => {
                const displayName = [m.firstName, m.lastName].filter(Boolean).join(" ");
                return (
                  <option key={m.id} value={m.id}>
                    {displayName || m.email || m.id}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Submitter */}
          <div className="rounded-lg border border-border bg-panel p-4">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted">
              Submitter
            </p>
            <p className="font-mono text-xs text-foreground">{submitterLabel(submission)}</p>
            {submission.submitterIsAuthenticated !== null && (
              <p className="mt-1 font-mono text-[10px] text-muted">
                {submission.submitterIsAuthenticated ? "Authenticated" : "Unauthenticated"}
              </p>
            )}
          </div>

          {/* Context */}
          <div className="rounded-lg border border-border bg-panel p-4">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted">
              Context
            </p>
            <dl className="space-y-1.5">
              {submission.currentUrl && (
                <div>
                  <dt className="font-mono text-[10px] text-muted/70">URL</dt>
                  <dd className="font-mono text-[11px] text-foreground break-all">
                    {submission.currentUrl}
                  </dd>
                </div>
              )}
              {geo && (
                <div>
                  <dt className="font-mono text-[10px] text-muted/70">Geo</dt>
                  <dd className="font-mono text-[11px] text-foreground">{geo}</dd>
                </div>
              )}
              {submission.ipAddress && (
                <div>
                  <dt className="font-mono text-[10px] text-muted/70">IP</dt>
                  <dd className="font-mono text-[11px] text-foreground">
                    {submission.ipAddress}
                  </dd>
                </div>
              )}
              {submission.userAgent && (
                <div>
                  <dt className="font-mono text-[10px] text-muted/70">Browser</dt>
                  <dd className="font-mono text-[11px] text-foreground break-all line-clamp-2">
                    {submission.userAgent}
                  </dd>
                </div>
              )}
              {submission.ratingValue !== null && submission.ratingValue !== undefined && (
                <div>
                  <dt className="font-mono text-[10px] text-muted/70">
                    {submission.ratingType?.toUpperCase() ?? "Rating"}
                  </dt>
                  <dd className="font-mono text-[11px] text-foreground">
                    {submission.ratingValue}
                    {submission.ratingScale ? ` / ${submission.ratingScale}` : ""}
                  </dd>
                </div>
              )}
              {Array.isArray(submission.consoleErrors) &&
                submission.consoleErrors.length > 0 && (
                  <div>
                    <dt className="font-mono text-[10px] text-destructive/80">Console Errors</dt>
                    <dd className="font-mono text-[11px] text-destructive">
                      {(submission.consoleErrors as unknown[]).length} error(s)
                    </dd>
                  </div>
                )}
            </dl>
          </div>

          {/* Actions */}
          <div className="rounded-lg border border-border bg-panel p-4 space-y-2">
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted">
              Actions
            </p>
            <button
              type="button"
              disabled={saving}
              onClick={() => setShowTaskModal(true)}
              className="w-full rounded border border-primary/30 bg-primary/5 px-3 py-2 font-mono text-xs tracking-wider text-primary hover:bg-primary/15 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              CREATE TASK
            </button>
            <button
              type="button"
              disabled={saving || submission.status === "converted"}
              onClick={() => void convertToSignal()}
              className="w-full rounded border border-border px-3 py-2 font-mono text-xs tracking-wider text-muted hover:text-foreground hover:border-foreground/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {submission.signalId ? "SIGNAL CREATED" : "CONVERT TO SIGNAL"}
            </button>
            {submission.signalId && (
              <Link
                href={`/dashboard/${workspaceId}/synthesis/signals/${submission.signalId}`}
                className="block text-center font-mono text-[10px] text-muted hover:text-foreground"
              >
                View Signal →
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* Convert to Task modal */}
    {showTaskModal && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        onClick={(e) => { if (e.target === e.currentTarget) setShowTaskModal(false); }}
      >
        <div className="w-full max-w-md rounded-lg border border-border bg-panel p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
              Create Task
            </h2>
            <button
              onClick={() => setShowTaskModal(false)}
              className="font-mono text-xs text-muted hover:text-foreground"
            >
              ✕
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-widest text-muted mb-1">
                Task Title
              </label>
              <input
                type="text"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                autoFocus
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/40 focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-widest text-muted mb-1">
                Description
              </label>
              <textarea
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                rows={4}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/40 focus:border-primary focus:outline-none resize-none"
              />
            </div>
            <p className="font-mono text-[10px] text-muted/60">
              This feedback will be linked to the new task and marked as a dependency.
              The task will be created in your backlog.
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowTaskModal(false)}
                className="rounded border border-border px-3 py-1.5 font-mono text-xs text-muted hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void convertToTask()}
                disabled={!taskTitle.trim() || creatingTask}
                className="rounded border border-primary/30 bg-primary/10 px-4 py-1.5 font-mono text-xs tracking-wider text-primary hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {creatingTask ? "CREATING…" : "CREATE TASK"}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
