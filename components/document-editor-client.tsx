"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MonoLabel } from "@/components/mono-label";

interface DocumentEditorClientProps {
  workspaceId: string;
  document: {
    id: string;
    title: string;
    content: string | null;
    fileUrl: string | null;
    fileType: string | null;
    fileName: string | null;
  };
  kind: "brain" | "canon";
}

export function DocumentEditorClient({
  workspaceId,
  document: doc,
  kind,
}: DocumentEditorClientProps) {
  const router = useRouter();
  const [title, setTitle] = useState(doc.title);
  const [content, setContent] = useState(doc.content || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const apiPath = `/api/workspaces/${workspaceId}/${kind}/${doc.id}`;
  const listPath = `/dashboard/${workspaceId}/${kind}`;

  const save = useCallback(
    async (updates: { title?: string; content?: string }) => {
      setSaving(true);
      setSaved(false);
      try {
        const res = await fetch(apiPath, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (!res.ok) throw new Error("Save failed");
        setSaved(true);
      } catch (error) {
        console.error("Save failed:", error);
      } finally {
        setSaving(false);
      }
    },
    [apiPath]
  );

  // Auto-save on content change (debounced)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (content !== (doc.content || "")) {
        save({ content });
      }
    }, 1500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [content, doc.content, save]);

  function handleTitleBlur() {
    if (title !== doc.title) {
      save({ title });
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this document? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await fetch(apiPath, { method: "DELETE" });
      router.push(listPath);
    } catch {
      setDeleting(false);
    }
  }

  const isImage = doc.fileType?.startsWith("image/");
  const isPdf = doc.fileType === "application/pdf";

  return (
    <div className="mx-auto max-w-[1200px] px-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.push(listPath)}
          className="font-mono text-xs text-muted hover:text-foreground transition-colors"
        >
          ← Back to {kind === "brain" ? "Brain" : "Canon"}
        </button>
        <div className="flex items-center gap-4">
          <span className="font-mono text-[10px] text-muted">
            {saving ? "Saving..." : saved ? "Saved" : "Unsaved changes"}
          </span>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="font-mono text-xs text-destructive hover:text-destructive/80 transition-colors"
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>

      {/* Title */}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={handleTitleBlur}
        className="w-full font-display text-2xl font-bold tracking-tight bg-transparent text-foreground outline-none border-none mb-6 placeholder:text-muted/30"
        placeholder="Document title"
      />

      {/* File preview */}
      {doc.fileUrl && (
        <div className="mb-6">
          <MonoLabel className="text-[10px] mb-2 block">
            ATTACHED FILE: {doc.fileName || "file"}
          </MonoLabel>
          {isImage && (
            <img
              src={doc.fileUrl}
              alt={doc.fileName || "Attached image"}
              className="max-w-full max-h-96 rounded border border-border"
            />
          )}
          {isPdf && (
            <a
              href={doc.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded border border-border text-sm text-info hover:border-info/30 transition-colors font-mono"
            >
              📄 Open PDF
            </a>
          )}
          {!isImage && !isPdf && doc.fileUrl && (
            <a
              href={doc.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded border border-border text-sm text-info hover:border-info/30 transition-colors font-mono"
            >
              📎 Download file
            </a>
          )}
        </div>
      )}

      {/* Content editor */}
      <textarea
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          setSaved(false);
        }}
        className="w-full min-h-[60vh] bg-panel border border-border rounded-lg p-6 text-sm text-foreground placeholder:text-muted/30 outline-none focus:border-primary/20 resize-none font-body leading-relaxed"
        placeholder="Start writing... (supports markdown)"
      />
    </div>
  );
}
