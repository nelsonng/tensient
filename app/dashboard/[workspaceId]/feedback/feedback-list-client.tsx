"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type DataTableColumn } from "@/components/data-table";
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

export interface FeedbackRow {
  id: string;
  trackingId: string;
  category: FeedbackCategory;
  subject: string;
  status: FeedbackStatus;
  priority: FeedbackPriority | null;
  aiPriority: FeedbackPriority | null;
  submitterEmail: string | null;
  submitterName: string | null;
  submitterExternalId: string | null;
  submitterIsAuthenticated: boolean | null;
  assigneeId: string | null;
  assigneeFirstName: string | null;
  assigneeLastName: string | null;
  assigneeEmail: string | null;
  createdAt: string;
  updatedAt: string;
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
  help_request: "text-muted border-border bg-panel",
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

const PRIORITIES: FeedbackPriority[] = ["critical", "high", "medium", "low"];

const STATUS_TABS: Array<{ label: string; value: FeedbackStatus | "all" }> = [
  { label: "ALL", value: "all" },
  { label: "NEW", value: "new" },
  { label: "REVIEWING", value: "reviewing" },
  { label: "ESCALATED", value: "escalated" },
  { label: "RESOLVED", value: "resolved" },
  { label: "SPAM", value: "spam" },
];

const CATEGORY_CHIPS: Array<{ label: string; value: FeedbackCategory | "all" }> = [
  { label: "ALL", value: "all" },
  { label: "BUG", value: "bug_report" },
  { label: "FEATURE", value: "feature_request" },
  { label: "HELP", value: "help_request" },
  { label: "URGENT", value: "urgent_issue" },
];

function submitterLabel(row: FeedbackRow): string {
  if (row.submitterEmail) return row.submitterEmail;
  if (row.submitterName) return row.submitterName;
  if (row.submitterExternalId) return row.submitterExternalId;
  return "Anonymous";
}

export function FeedbackListClient({
  workspaceId,
  rows: initialRows,
}: {
  workspaceId: string;
  rows: FeedbackRow[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState<FeedbackStatus | "all">("all");
  const [activeCategory, setActiveCategory] = useState<FeedbackCategory | "all">("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (activeStatus !== "all" && row.status !== activeStatus) return false;
      if (activeCategory !== "all" && row.category !== activeCategory) return false;
      if (search) {
        const q = search.toLowerCase();
        const match =
          row.subject.toLowerCase().includes(q) ||
          (row.submitterEmail ?? "").toLowerCase().includes(q) ||
          (row.submitterName ?? "").toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [rows, activeStatus, activeCategory, search]);

  const subtitle = useMemo(() => {
    const total = rows.length;
    const newCount = rows.filter((r) => r.status === "new").length;
    return `${total} submission${total !== 1 ? "s" : ""} · ${newCount} new`;
  }, [rows]);

  async function patchRow(id: string, patch: Record<string, unknown>) {
    const workspaceQuery = `workspaceId=${workspaceId}`;
    const res = await fetch(`/api/feedback/${id}?${workspaceQuery}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error("Failed to update");
    return res.json();
  }

  async function cycleStatus(id: string, current: FeedbackStatus) {
    const CYCLE: FeedbackStatus[] = ["new", "reviewing", "resolved", "spam"];
    const idx = CYCLE.indexOf(current);
    const next = CYCLE[(idx + 1) % CYCLE.length];
    setUpdatingId(id);
    try {
      await patchRow(id, { status: next });
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: next } : r))
      );
    } catch {
      alert("Failed to update status.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function setPriority(id: string, priority: FeedbackPriority | null) {
    setUpdatingId(id);
    try {
      await patchRow(id, { priority });
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, priority } : r))
      );
    } catch {
      alert("Failed to update priority.");
    } finally {
      setUpdatingId(null);
    }
  }

  const columns: Array<DataTableColumn<FeedbackRow>> = [
    {
      key: "category",
      label: "Type",
      render: (row) => (
        <span
          className={`inline-block rounded border px-1.5 py-0.5 font-mono text-[10px] tracking-wider ${CATEGORY_COLORS[row.category]}`}
        >
          {CATEGORY_LABELS[row.category]}
        </span>
      ),
    },
    {
      key: "subject",
      label: "Subject",
      render: (row) => (
        <span className="block max-w-[320px] truncate text-sm text-foreground">
          {row.subject}
        </span>
      ),
    },
    {
      key: "submitterEmail",
      label: "Submitter",
      render: (row) => (
        <span className="font-mono text-[11px] text-muted">{submitterLabel(row)}</span>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (row) => (
        <button
          type="button"
          disabled={updatingId === row.id}
          onClick={(e) => {
            e.stopPropagation();
            void cycleStatus(row.id, row.status);
          }}
          className={`font-mono text-[11px] uppercase tracking-wide ${STATUS_COLORS[row.status]}`}
          title="Click to cycle status"
        >
          {row.status.replace("_", " ")}
        </button>
      ),
    },
    {
      key: "priority",
      label: "Priority",
      sortable: true,
      render: (row) => (
        <div
          className="flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {PRIORITIES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => void setPriority(row.id, p)}
              disabled={updatingId === row.id}
              className={`font-mono text-[10px] uppercase tracking-wide ${
                row.priority === p
                  ? "text-primary"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {p.slice(0, 1).toUpperCase()}
            </button>
          ))}
          <button
            type="button"
            onClick={() => void setPriority(row.id, null)}
            disabled={updatingId === row.id}
            className="font-mono text-[10px] text-muted hover:text-foreground"
            title="Clear priority"
          >
            --
          </button>
        </div>
      ),
    },
    {
      key: "assigneeFirstName",
      label: "Assignee",
      render: (row) => {
        const name = [row.assigneeFirstName, row.assigneeLastName].filter(Boolean).join(" ");
        return (
          <span className="font-mono text-[11px] text-muted">
            {name || row.assigneeEmail || "--"}
          </span>
        );
      },
    },
    {
      key: "createdAt",
      label: "Time",
      sortable: true,
      sortValue: (row) => new Date(row.createdAt).getTime(),
      render: (row) => (
        <span className="font-mono text-[11px] text-muted">
          {formatAbsoluteDateTime(row.createdAt)}
        </span>
      ),
    },
  ];

  const toolbar = (
    <input
      type="text"
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      placeholder="Search…"
      className="rounded border border-border bg-background px-3 py-1.5 font-mono text-xs text-foreground placeholder:text-muted/40 focus:border-primary focus:outline-none"
    />
  );

  const filterBar = (
    <div className="mx-auto max-w-[1200px] px-6 mb-4 flex flex-wrap items-center gap-4">
      {/* Status tabs */}
      <div className="flex items-center gap-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveStatus(tab.value)}
            className={`px-2 py-1 font-mono text-[10px] tracking-wider transition-colors ${
              activeStatus === tab.value
                ? "text-primary border-b border-primary"
                : "text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <span className="text-border">|</span>

      {/* Category chips */}
      <div className="flex items-center gap-1">
        {CATEGORY_CHIPS.map((chip) => (
          <button
            key={chip.value}
            type="button"
            onClick={() => setActiveCategory(chip.value)}
            className={`rounded px-2 py-0.5 font-mono text-[10px] tracking-wider transition-colors ${
              activeCategory === chip.value
                ? "bg-primary/10 text-primary border border-primary/30"
                : "text-muted hover:text-foreground border border-transparent"
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      {filterBar}
      <DataTable
        title="Feedback"
        subtitle={subtitle}
        toolbar={toolbar}
        rows={filtered}
        columns={columns}
        onRowClick={(row) =>
          router.push(`/dashboard/${workspaceId}/feedback/${row.id}`)
        }
        emptyTitle="No feedback yet"
        emptyDescription="Feedback submitted via the API will appear here."
      />
    </>
  );
}
