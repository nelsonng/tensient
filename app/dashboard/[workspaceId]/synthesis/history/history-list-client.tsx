"use client";

import { useRouter } from "next/navigation";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { formatAbsoluteDateTime } from "@/lib/utils";

interface CommitRow {
  id: string;
  summary: string;
  trigger: "conversation_end" | "manual" | "scheduled";
  signalCount: number;
  createdAt: string;
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
          {formatAbsoluteDateTime(row.createdAt)}
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
