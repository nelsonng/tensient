"use client";

import { useState } from "react";

export type ContextScope = "brain" | "canon";

interface SaveToContextFormProps {
  workspaceId: string;
  initialTitle: string;
  initialContent: string;
  onCancel: () => void;
  onSaved: (scope: ContextScope, title: string) => void;
}

function getScopeLabel(scope: ContextScope): string {
  return scope === "brain" ? "My Context" : "Workspace Context";
}

export function SaveToContextForm({
  workspaceId,
  initialTitle,
  initialContent,
  onCancel,
  onSaved,
}: SaveToContextFormProps) {
  const [scope, setScope] = useState<ContextScope>("brain");
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const trimmedTitle = title.trim() || "Untitled document";
    const trimmedContent = content.trim();
    if (!trimmedContent || saving) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/${scope}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          content: trimmedContent,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save context");
      }

      onSaved(scope, trimmedTitle);
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : "Failed to save context";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 rounded border border-border bg-background/50 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setScope("brain")}
          className={`px-2 py-1 rounded border text-[10px] font-mono uppercase tracking-wide transition-colors ${
            scope === "brain"
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted hover:text-foreground"
          }`}
        >
          My Context
        </button>
        <button
          onClick={() => setScope("canon")}
          className={`px-2 py-1 rounded border text-[10px] font-mono uppercase tracking-wide transition-colors ${
            scope === "canon"
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted hover:text-foreground"
          }`}
        >
          Workspace Context
        </button>
      </div>

      <div className="space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Document title"
          className="w-full bg-panel border border-border rounded px-3 py-2 text-xs text-foreground placeholder:text-muted/60 outline-none focus:border-primary/30"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          placeholder="Context content"
          className="w-full bg-panel border border-border rounded px-3 py-2 text-xs text-foreground whitespace-pre-wrap placeholder:text-muted/60 outline-none focus:border-primary/30 resize-y"
        />
      </div>

      {error && <p className="font-mono text-[10px] text-destructive">{error}</p>}

      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] text-muted">
          Save to {getScopeLabel(scope)}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-muted hover:text-foreground disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !content.trim()}
            className="px-2 py-1 rounded border border-primary/40 bg-primary/10 font-mono text-[10px] uppercase tracking-wide text-primary hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
