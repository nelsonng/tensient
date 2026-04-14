"use client";

import { useCallback, useMemo, useState } from "react";
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

const PRIORITY_STYLES: Record<FeedbackPriority, string> = {
  critical: "text-destructive font-bold tracking-wider",
  high: "text-warning tracking-wide",
  medium: "text-muted/80",
  low: "text-muted/40",
};

const PRIORITY_LABELS: Record<FeedbackPriority, string> = {
  critical: "CRITICAL",
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW",
};

type ActiveTab = FeedbackStatus | "all" | "archived";

const STATUS_TABS: Array<{ label: string; value: ActiveTab }> = [
  { label: "ALL", value: "all" },
  { label: "NEW", value: "new" },
  { label: "REVIEWING", value: "reviewing" },
  { label: "ESCALATED", value: "escalated" },
  { label: "RESOLVED", value: "resolved" },
  { label: "SPAM", value: "spam" },
  { label: "ARCHIVED", value: "archived" },
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
  const [archivedRows, setArchivedRows] = useState<FeedbackRow[]>([]);
  const [archivedLoaded, setArchivedLoaded] = useState(false);
  const [loadingArchived, setLoadingArchived] = useState(false);

  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("all");
  const [activeCategory, setActiveCategory] = useState<FeedbackCategory | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const isArchiveView = activeTab === "archived";
  const activeRows = isArchiveView ? archivedRows : rows;

  const loadArchivedRows = useCallback(async () => {
    if (archivedLoaded) return;
    setLoadingArchived(true);
    try {
      const res = await fetch(`/api/feedback?workspaceId=${workspaceId}&archived=true`);
      if (res.ok) {
        const data = await res.json();
        setArchivedRows(data);
        setArchivedLoaded(true);
      }
    } finally {
      setLoadingArchived(false);
    }
  }, [workspaceId, archivedLoaded]);

  function handleTabChange(tab: ActiveTab) {
    setActiveTab(tab);
    setSelectedIds(new Set());
    if (tab === "archived") {
      void loadArchivedRows();
    }
  }

  const filtered = useMemo(() => {
    return activeRows.filter((row) => {
      if (!isArchiveView && activeTab !== "all" && row.status !== activeTab) return false;
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
  }, [activeRows, activeTab, isArchiveView, activeCategory, search]);

  const subtitle = useMemo(() => {
    if (isArchiveView) {
      return `${archivedRows.length} archived`;
    }
    const total = rows.length;
    const newCount = rows.filter((r) => r.status === "new").length;
    return `${total} submission${total !== 1 ? "s" : ""} · ${newCount} new`;
  }, [rows, archivedRows, isArchiveView]);

  async function patchRow(id: string, patch: Record<string, unknown>) {
    const res = await fetch(`/api/feedback/${id}?workspaceId=${workspaceId}`, {
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
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: next } : r)));
    } catch {
      alert("Failed to update status.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function archiveRow(id: string) {
    setUpdatingId(id);
    try {
      await patchRow(id, { archive: true });
      setRows((prev) => prev.filter((r) => r.id !== id));
      setArchivedLoaded(false);
    } catch {
      alert("Failed to archive.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function unarchiveRow(id: string) {
    setUpdatingId(id);
    try {
      await patchRow(id, { unarchive: true });
      setArchivedRows((prev) => prev.filter((r) => r.id !== id));
    } catch {
      alert("Failed to unarchive.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function deleteRow(id: string) {
    if (!confirm("Permanently delete this feedback? This cannot be undone.")) return;
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/feedback/${id}?workspaceId=${workspaceId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setRows((prev) => prev.filter((r) => r.id !== id));
      setArchivedRows((prev) => prev.filter((r) => r.id !== id));
    } catch {
      alert("Failed to delete.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function bulkAction(action: "archive" | "unarchive" | "delete") {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (action === "delete" && !confirm(`Permanently delete ${ids.length} item${ids.length !== 1 ? "s" : ""}? This cannot be undone.`)) return;
    setBulkLoading(true);
    try {
      const res = await fetch(`/api/feedback/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action, workspaceId }),
      });
      if (!res.ok) throw new Error("Bulk action failed");
      if (action === "archive") {
        setRows((prev) => prev.filter((r) => !ids.includes(r.id)));
        setArchivedLoaded(false);
      } else if (action === "unarchive") {
        setArchivedRows((prev) => prev.filter((r) => !ids.includes(r.id)));
      } else {
        setRows((prev) => prev.filter((r) => !ids.includes(r.id)));
        setArchivedRows((prev) => prev.filter((r) => !ids.includes(r.id)));
      }
      setSelectedIds(new Set());
    } catch {
      alert("Bulk action failed.");
    } finally {
      setBulkLoading(false);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((r) => r.id)));
    }
  }

  const columns: Array<DataTableColumn<FeedbackRow>> = [
    {
      key: "id",
      label: "",
      widthClassName: "w-8",
      render: (row) => (
        <input
          type="checkbox"
          checked={selectedIds.has(row.id)}
          onChange={() => toggleSelect(row.id)}
          onClick={(e) => e.stopPropagation()}
          className="accent-primary cursor-pointer"
        />
      ),
    },
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
    ...(isArchiveView
      ? []
      : [
          {
            key: "status" as keyof FeedbackRow,
            label: "Status",
            sortable: true,
            render: (row: FeedbackRow) => (
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
                {row.status.replace(/_/g, " ")}
              </button>
            ),
          },
        ]),
    {
      key: "priority",
      label: "Priority",
      sortable: true,
      render: (row) => {
        if (!row.priority) return null;
        return (
          <span className={`font-mono text-[10px] ${PRIORITY_STYLES[row.priority]}`}>
            {PRIORITY_LABELS[row.priority]}
          </span>
        );
      },
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
    <div className="flex items-center gap-2">
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-1.5 rounded border border-border bg-panel px-2 py-1">
          <span className="font-mono text-[10px] text-muted">{selectedIds.size} selected</span>
          {isArchiveView ? (
            <button
              type="button"
              disabled={bulkLoading}
              onClick={() => void bulkAction("unarchive")}
              className="font-mono text-[10px] text-primary hover:text-primary/80 disabled:opacity-40 transition-colors"
            >
              UNARCHIVE
            </button>
          ) : (
            <button
              type="button"
              disabled={bulkLoading}
              onClick={() => void bulkAction("archive")}
              className="font-mono text-[10px] text-muted hover:text-foreground disabled:opacity-40 transition-colors"
            >
              ARCHIVE
            </button>
          )}
          <button
            type="button"
            disabled={bulkLoading}
            onClick={() => void bulkAction("delete")}
            className="font-mono text-[10px] text-destructive hover:text-destructive/80 disabled:opacity-40 transition-colors"
          >
            DELETE
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="font-mono text-[10px] text-muted/50 hover:text-muted transition-colors"
          >
            ✕
          </button>
        </div>
      )}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search…"
        className="rounded border border-border bg-background px-3 py-1.5 font-mono text-xs text-foreground placeholder:text-muted/40 focus:border-primary focus:outline-none"
      />
    </div>
  );

  const filterBar = (
    <div className="mx-auto max-w-[1200px] px-6 mb-4 flex flex-wrap items-center gap-4">
      {/* Status / archive tabs */}
      <div className="flex items-center gap-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => handleTabChange(tab.value)}
            className={`px-2 py-1 font-mono text-[10px] tracking-wider transition-colors ${
              activeTab === tab.value
                ? "text-primary border-b border-primary"
                : "text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {!isArchiveView && (
        <>
          <span className="text-border">|</span>
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
        </>
      )}

      {/* Select all */}
      {filtered.length > 0 && (
        <button
          type="button"
          onClick={toggleSelectAll}
          className="ml-auto font-mono text-[10px] text-muted hover:text-foreground transition-colors"
        >
          {selectedIds.size === filtered.length ? "DESELECT ALL" : "SELECT ALL"}
        </button>
      )}
    </div>
  );

  if (loadingArchived) {
    return (
      <div className="mx-auto max-w-[1200px] px-6 pt-4">
        {filterBar}
        <p className="font-mono text-xs text-muted py-8 text-center">Loading archived…</p>
      </div>
    );
  }

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
        rowActions={[
          ...(isArchiveView
            ? [
                {
                  label: "Unarchive",
                  onClick: (row: FeedbackRow) => void unarchiveRow(row.id),
                },
              ]
            : [
                {
                  label: "Archive",
                  onClick: (row: FeedbackRow) => void archiveRow(row.id),
                },
              ]),
          {
            label: "Delete",
            variant: "danger" as const,
            onClick: (row: FeedbackRow) => void deleteRow(row.id),
          },
        ]}
        emptyTitle={isArchiveView ? "No archived feedback" : "No feedback yet"}
        emptyDescription={
          isArchiveView
            ? "Archived feedback will appear here."
            : "Feedback submitted via the API will appear here."
        }
      />
    </>
  );
}
