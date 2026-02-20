"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { upload } from "@vercel/blob/client";
import { SlantedButton } from "@/components/slanted-button";
import { PanelCard } from "@/components/panel-card";
import { MonoLabel } from "@/components/mono-label";

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

  return (
    <div className="mx-auto max-w-[1200px] px-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            {label}
          </h1>
          <p className="font-mono text-xs text-muted mt-1">
            {kind === "brain" ? "Your personal context" : "Shared workspace knowledge"}
            {" · "}
            {documents.length} document{documents.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.md"
              onChange={handleFileUpload}
              className="hidden"
            />
            <span className="inline-flex items-center px-4 py-2 font-mono text-xs tracking-wider border border-border text-muted hover:border-primary/30 hover:text-foreground transition-colors rounded"
              style={{ clipPath: "polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)" }}
            >
              {uploading ? "Uploading..." : "Upload File"}
            </span>
          </label>
          <SlantedButton onClick={handleNew} disabled={creating}>
            {creating ? "Creating..." : "+ New Document"}
          </SlantedButton>
        </div>
      </div>

      {/* Empty state */}
      {documents.length === 0 && (
        <PanelCard className="text-center py-16">
          <MonoLabel className="text-muted mb-4 block">
            No {label.toLowerCase()} documents yet
          </MonoLabel>
          <p className="text-sm text-muted mb-6">
            {kind === "brain"
              ? "Add personal context that Tensient will use in your conversations."
              : "Add shared knowledge that everyone in the workspace can reference."}
          </p>
          <SlantedButton onClick={handleNew} disabled={creating}>
            Create First Document
          </SlantedButton>
        </PanelCard>
      )}

      {/* Document list */}
      <div className="space-y-2">
        {documents.map((doc) => (
          <Link key={doc.id} href={`${pagePath}/${doc.id}`} className="block">
            <PanelCard className="hover:border-primary/30 transition-colors cursor-pointer group">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-body text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {doc.title}
                    </h3>
                    {doc.fileUrl && (
                      <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-info/10 text-info border border-info/20">
                        {doc.fileType?.split("/")[1]?.toUpperCase() || "FILE"}
                      </span>
                    )}
                  </div>
                  {doc.content && (
                    <p className="text-xs text-muted truncate mt-0.5">
                      {doc.content.slice(0, 120)}
                    </p>
                  )}
                </div>
                <span className="font-mono text-[10px] text-muted ml-4 shrink-0">
                  {formatRelativeTime(doc.updatedAt)}
                </span>
              </div>
            </PanelCard>
          </Link>
        ))}
      </div>
    </div>
  );
}
