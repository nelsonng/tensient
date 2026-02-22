"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { SlantedButton } from "@/components/slanted-button";

interface Document {
  id: string;
  title: string;
  content: string | null;
  fileUrl: string | null;
  fileType: string | null;
  fileName: string | null;
  scope: string;
  createdAt: string;
  updatedAt: string;
}

interface DocumentListClientProps {
  workspaceId: string;
  documents: Document[];
  kind: "brain" | "canon";
}

export function DocumentListClient({
  workspaceId,
  documents,
  kind,
}: DocumentListClientProps) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);

  const label = kind === "brain" ? "My Context" : "Workspace Context";
  const apiPath = `/api/workspaces/${workspaceId}/${kind}`;
  const pagePath = `/dashboard/${workspaceId}/${kind}`;

  async function handleNew() {
    setCreating(true);
    try {
      const res = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled document", content: "" }),
      });
      if (!res.ok) throw new Error("Failed to create document");
      const doc = await res.json();
      router.push(`${pagePath}/${doc.id}`);
    } catch {
      setCreating(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const path = `${kind}/${workspaceId}/${Date.now()}-${file.name}`;
      const result = await upload(path, file, {
        access: "public",
        handleUploadUrl: "/api/uploads/token",
      });

      const res = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: file.name.replace(/\.[^.]+$/, ""),
          fileUrl: result.url,
          fileType: file.type,
          fileName: file.name,
        }),
      });
      if (!res.ok) throw new Error("Failed to create document");
      const doc = await res.json();
      router.push(`${pagePath}/${doc.id}`);
    } catch (error) {
      console.error("Upload failed:", error);
      setUploading(false);
    }
  }

  function formatRelativeTime(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays < 1) return "Today";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  async function handleDelete(documentId: string) {
    const confirmed = window.confirm("Delete this document?");
    if (!confirmed) return;

    const res = await fetch(`${apiPath}/${documentId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      alert("Failed to delete document.");
      return;
    }

    router.refresh();
  }

  const columns: Array<DataTableColumn<Document>> = [
    {
      key: "title",
      label: "Title",
      sortable: true,
      render: (doc) => (
        <div className="min-w-0">
          <p className="truncate font-body text-sm text-foreground">{doc.title}</p>
        </div>
      ),
    },
    {
      key: "fileType",
      label: "Type",
      sortable: true,
      render: (doc) =>
        doc.fileType?.split("/")[1]?.toUpperCase() ?? (doc.fileUrl ? "FILE" : "TEXT"),
    },
    {
      key: "content",
      label: "Preview",
      render: (doc) => (
        <span className="block max-w-[460px] truncate text-xs text-muted">
          {doc.content?.slice(0, 120) || "--"}
        </span>
      ),
    },
    {
      key: "updatedAt",
      label: "Updated",
      sortable: true,
      sortValue: (doc) => new Date(doc.updatedAt).getTime(),
      render: (doc) => (
        <span className="font-mono text-[11px] text-muted">
          {formatRelativeTime(doc.updatedAt)}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      title={label}
      subtitle={`${kind === "brain" ? "Your personal context" : "Shared workspace knowledge"} · ${
        documents.length
      } document${documents.length !== 1 ? "s" : ""}`}
      rows={documents}
      columns={columns}
      toolbar={
        <>
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.md"
              onChange={handleFileUpload}
              className="hidden"
            />
            <span
              className="inline-flex items-center rounded border border-border px-4 py-2 font-mono text-xs tracking-wider text-muted transition-colors hover:border-primary/30 hover:text-foreground"
              style={{ clipPath: "polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)" }}
            >
              {uploading ? "Uploading..." : "Upload File"}
            </span>
          </label>
          <SlantedButton onClick={handleNew} disabled={creating}>
            {creating ? "Creating..." : "+ New Document"}
          </SlantedButton>
        </>
      }
      onRowClick={(doc) => router.push(`${pagePath}/${doc.id}`)}
      rowActions={[
        {
          label: "Delete",
          variant: "danger",
          onClick: async (doc) => {
            await handleDelete(doc.id);
          },
        },
      ]}
      emptyTitle={`No ${label.toLowerCase()} documents yet`}
      emptyDescription={
        kind === "brain"
          ? "Add personal context that Tensient will use in your conversations."
          : "Add shared knowledge that everyone in the workspace can reference."
      }
    />
  );
}
