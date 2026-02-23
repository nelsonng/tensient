"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { SlantedButton } from "@/components/slanted-button";

interface SynthesisDocumentRow {
  id: string;
  title: string;
  content: string | null;
  commitCount: number;
  signalCount: number;
  updatedAt: string;
}

interface SynthesisRunResult {
  summary: string;
  operations: Array<{
    action: "create" | "modify" | "delete";
    title: string;
  }>;
  priorityRecommendations: Array<{ signalId: string; recommended: string }>;
}

export function SynthesisDocumentListClient({
  workspaceId,
  rows,
  unprocessedCount,
}: {
  workspaceId: string;
  rows: SynthesisDocumentRow[];
  unprocessedCount: number;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SynthesisRunResult | null>(null);
  const [items, setItems] = useState(rows);

  const subtitle = useMemo(
    () =>
      `${items.length} document${items.length !== 1 ? "s" : ""} · ${unprocessedCount} unprocessed signal${
        unprocessedCount !== 1 ? "s" : ""
      }`,
    [items.length, unprocessedCount]
  );

  async function handleDelete(docId: string) {
    const confirmed = window.confirm("Delete this synthesis document?");
    if (!confirmed) return;
    const res = await fetch(
      `/api/workspaces/${workspaceId}/synthesis/documents/${docId}`,
      { method: "DELETE" }
    );
    if (!res.ok) {
      alert("Failed to delete document.");
      return;
    }
    setItems((prev) => prev.filter((doc) => doc.id !== docId));
  }

  async function runSynthesis() {
    setRunning(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/synthesis/run`, {
        method: "POST",
      });
      const rawBody = await res.text();
      let body: (SynthesisRunResult & { error?: string }) | null = null;
      if (rawBody) {
        try {
          body = JSON.parse(rawBody) as SynthesisRunResult & { error?: string };
        } catch {
          body = null;
        }
      }

      if (!res.ok) {
        throw new Error(
          body?.error || `Failed to run synthesis (HTTP ${res.status})`
        );
      }
      if (!body) {
        throw new Error("Synthesis failed: empty response body.");
      }
      setResult({
        summary: body.summary,
        operations: body.operations ?? [],
        priorityRecommendations: body.priorityRecommendations ?? [],
      });
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Synthesis failed.");
    } finally {
      setRunning(false);
    }
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

  const columns: Array<DataTableColumn<SynthesisDocumentRow>> = [
    {
      key: "title",
      label: "Title",
      sortable: true,
      render: (row) => (
        <span className="block max-w-[400px] truncate text-sm text-foreground">
          {row.title}
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
      key: "commitCount",
      label: "Commits",
      sortable: true,
      sortValue: (row) => row.commitCount,
      render: (row) => (
        <span className="font-mono text-[11px] text-muted">{row.commitCount}</span>
      ),
    },
    {
      key: "updatedAt",
      label: "Updated",
      sortable: true,
      sortValue: (row) => new Date(row.updatedAt).getTime(),
      render: (row) => (
        <span className="font-mono text-[11px] text-muted">
          {formatRelativeTime(row.updatedAt)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {result ? (
        <div className="mx-auto max-w-[1200px] rounded-lg border border-border bg-panel p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
            Latest Synthesis Result
          </p>
          <p className="mt-2 text-sm text-foreground">{result.summary}</p>
          <p className="mt-2 font-mono text-[11px] text-muted">
            {result.operations.length} operations · {result.priorityRecommendations.length} priority recommendations
          </p>
        </div>
      ) : null}

      <DataTable
        title="Synthesis Documents"
        subtitle={subtitle}
        rows={items}
        columns={columns}
        toolbar={
          <SlantedButton onClick={runSynthesis} disabled={running}>
            {running ? "Synthesizing..." : "Synthesize Now"}
          </SlantedButton>
        }
        onRowClick={(row) =>
          router.push(`/dashboard/${workspaceId}/synthesis/documents/${row.id}`)
        }
        rowActions={[
          {
            label: "Delete",
            variant: "danger",
            onClick: async (row) => {
              await handleDelete(row.id);
            },
          },
        ]}
        emptyTitle="No synthesis documents yet"
        emptyDescription="Run synthesis to generate the first synthesis document."
      />
    </div>
  );
}
