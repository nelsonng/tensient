"use client";

import { useRouter } from "next/navigation";
import { DataTable, type DataTableColumn } from "@/components/data-table";

interface CommitRow {
  id: string;
  summary: string;
  trigger: "conversation_end" | "manual" | "scheduled";
  signalCount: number;
  createdAt: string;
}

function formatRelativeTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function HistoryListClient({
  workspaceId,
  rows,
}: {
  workspaceId: string;
  rows: CommitRow[];
}) {
  const router = useRouter();

  const columns: Array<DataTableColumn<CommitRow>> = [
    {
      key: "summary",
      label: "Summary",
      sortable: true,
      render: (row) => (
        <span className="block max-w-[600px] truncate text-sm text-foreground">
          {row.summary}
        </span>
      ),
    },
    {
      key: "trigger",
      label: "Trigger",
      sortable: true,
      render: (row) => (
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
          {row.trigger}
        </span>
      ),
    },
    {
      key: "signalCount",
      label: "Signals",
      sortable: true,
      sortValue: (row) => row.signalCount,
      render: (row) => (
        <span className="font-mono text-[11px] text-muted">{row.signalCount}</span>
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
      title="Synthesis History"
      subtitle={`${rows.length} commit${rows.length !== 1 ? "s" : ""}`}
      rows={rows}
      columns={columns}
      onRowClick={(row) =>
        router.push(`/dashboard/${workspaceId}/synthesis/history/${row.id}`)
      }
      emptyTitle="No synthesis commits yet"
      emptyDescription="Run synthesis to generate your first commit."
    />
  );
}
