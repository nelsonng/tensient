"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type DataTableColumn } from "@/components/data-table";

interface SignalRow {
  id: string;
  content: string;
  conversationId: string;
  conversationTitle: string | null;
  status: "open" | "resolved" | "dismissed";
  aiPriority: "critical" | "high" | "medium" | "low" | null;
  humanPriority: "critical" | "high" | "medium" | "low" | null;
  reviewedAt: string | null;
  createdAt: string;
}

interface SignalListClientProps {
  workspaceId: string;
  rows: SignalRow[];
  conversationFilter?: string | null;
}

const PRIORITIES: Array<"critical" | "high" | "medium" | "low"> = [
  "critical",
  "high",
  "medium",
  "low",
];
const STATUSES: Array<"open" | "resolved" | "dismissed"> = [
  "open",
  "resolved",
  "dismissed",
];

function priorityBadge(priority: string | null) {
  if (!priority) return "--";
  return priority.toUpperCase();
}

function formatRelativeTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function SignalListClient({
  workspaceId,
  rows,
  conversationFilter,
}: SignalListClientProps) {
  const router = useRouter();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [items, setItems] = useState(rows);

  const subtitle = useMemo(() => {
    const unreviewed = items.filter((item) => !item.humanPriority).length;
    const openCount = items.filter((item) => item.status === "open").length;
    return `${items.length} signal${items.length !== 1 ? "s" : ""} · ${openCount} open · ${unreviewed} unreviewed`;
  }, [items]);

  async function setPriority(signalId: string, priority: string | null) {
    setUpdatingId(signalId);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/signals/${signalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ humanPriority: priority }),
      });
      if (!res.ok) throw new Error("Failed to update priority");

      const updated = await res.json();
      setItems((prev) =>
        prev.map((item) =>
          item.id === signalId
            ? {
                ...item,
                humanPriority: updated.humanPriority,
                reviewedAt: updated.reviewedAt,
              }
            : item
        )
      );
    } catch {
      alert("Failed to update signal priority.");
    } finally {
      setUpdatingId(null);
    }
  }

  function nextStatus(current: "open" | "resolved" | "dismissed") {
    const idx = STATUSES.indexOf(current);
    return STATUSES[(idx + 1) % STATUSES.length];
  }

  async function cycleStatus(signalId: string, current: "open" | "resolved" | "dismissed") {
    setUpdatingId(signalId);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/signals/${signalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus(current) }),
      });
      if (!res.ok) throw new Error("Failed to update status");

      const updated = await res.json();
      setItems((prev) =>
        prev.map((item) =>
          item.id === signalId
            ? {
                ...item,
                status: updated.status,
              }
            : item
        )
      );
    } catch {
      alert("Failed to update signal status.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function deleteSignal(signalId: string) {
    const confirmed = window.confirm("Delete this signal?");
    if (!confirmed) return;

    const res = await fetch(`/api/workspaces/${workspaceId}/signals/${signalId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      alert("Failed to delete signal.");
      return;
    }

    setItems((prev) => prev.filter((item) => item.id !== signalId));
  }

  const columns: Array<DataTableColumn<SignalRow>> = [
    {
      key: "content",
      label: "Content",
      render: (row) => (
        <span className="block max-w-[430px] truncate text-sm text-foreground">
          {row.content}
        </span>
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
          onClick={(event) => {
            event.stopPropagation();
            void cycleStatus(row.id, row.status);
          }}
          className={`font-mono text-[11px] uppercase tracking-wide ${
            row.status === "open"
              ? "text-primary"
              : row.status === "resolved"
                ? "text-success"
                : "text-muted"
          }`}
          title="Click to cycle status"
        >
          {row.status.toUpperCase()}
        </button>
      ),
    },
    {
      key: "source",
      label: "Source",
      render: (row) => (
        <span className="font-mono text-[11px] text-muted">
          {row.conversationTitle || "Untitled conversation"}
        </span>
      ),
    },
    {
      key: "aiPriority",
      label: "AI",
      sortable: true,
      render: (row) => (
        <span className="font-mono text-[11px] text-warning">
          {priorityBadge(row.aiPriority)}
        </span>
      ),
    },
    {
      key: "humanPriority",
      label: "You",
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
          {PRIORITIES.map((priority) => (
            <button
              key={priority}
              type="button"
              onClick={() => void setPriority(row.id, priority)}
              disabled={updatingId === row.id}
              className={`font-mono text-[10px] uppercase tracking-wide ${
                row.humanPriority === priority
                  ? "text-primary"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {priority.slice(0, 1)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => void setPriority(row.id, null)}
            disabled={updatingId === row.id}
            className="font-mono text-[10px] uppercase tracking-wide text-muted hover:text-foreground"
            title="Clear"
          >
            --
          </button>
        </div>
      ),
    },
    {
      key: "createdAt",
      label: "Time",
      sortable: true,
      sortValue: (row) => new Date(row.createdAt).getTime(),
      render: (row) => (
        <span className="font-mono text-[11px] text-muted">
          {formatRelativeTime(row.createdAt)}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      title="Signals"
      subtitle={
        conversationFilter ? `${subtitle} · filtered by conversation` : subtitle
      }
      rows={items}
      columns={columns}
      onRowClick={(row) =>
        router.push(`/dashboard/${workspaceId}/synthesis/signals/${row.id}`)
      }
      rowActions={[
        {
          label: "Delete",
          variant: "danger",
          onClick: async (row) => {
            await deleteSignal(row.id);
          },
        },
      ]}
      emptyTitle="No signals yet"
      emptyDescription="Signals appear when assistant messages extract action items."
    />
  );
}
