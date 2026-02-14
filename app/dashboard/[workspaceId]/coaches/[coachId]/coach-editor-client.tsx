"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SlantedButton } from "@/components/slanted-button";
import { MonoLabel } from "@/components/mono-label";

interface CoachEditorClientProps {
  workspaceId: string;
  coach: {
    id: string;
    name: string;
    description: string | null;
    systemPrompt: string;
    category: string | null;
    ownerType: string;
    parentId: string | null;
  };
  isEditable: boolean;
}

export function CoachEditorClient({
  workspaceId,
  coach,
  isEditable,
}: CoachEditorClientProps) {
  const router = useRouter();
  const [name, setName] = useState(coach.name);
  const [description, setDescription] = useState(coach.description || "");
  const [systemPrompt, setSystemPrompt] = useState(coach.systemPrompt);
  const [category, setCategory] = useState(coach.category || "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const apiPath = `/api/workspaces/${workspaceId}/protocols/${coach.id}`;

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(apiPath, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, systemPrompt, category }),
      });
      if (!res.ok) throw new Error("Save failed");
      router.refresh();
    } catch (error) {
      console.error("Save failed:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this coach? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await fetch(apiPath, { method: "DELETE" });
      router.push(`/dashboard/${workspaceId}/coaches`);
    } catch {
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-[800px] px-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.push(`/dashboard/${workspaceId}/coaches`)}
          className="font-mono text-xs text-muted hover:text-foreground transition-colors"
        >
          ← Back to Coaches
        </button>
        <div className="flex items-center gap-3">
          {!isEditable && (
            <span className="font-mono text-[10px] text-warning">
              SYSTEM COACH (READ-ONLY)
            </span>
          )}
          {isEditable && (
            <>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="font-mono text-xs text-destructive hover:text-destructive/80 transition-colors"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
              <SlantedButton onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </SlantedButton>
            </>
          )}
        </div>
      </div>

      {coach.parentId && (
        <div className="mb-4">
          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-secondary/10 text-secondary border border-secondary/20">
            FORKED FROM SYSTEM COACH
          </span>
        </div>
      )}

      {/* Name */}
      <div className="mb-6">
        <MonoLabel className="text-[10px] mb-2 block">NAME</MonoLabel>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={!isEditable}
          className="w-full bg-panel border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted/30 outline-none focus:border-primary/30 font-body disabled:opacity-50"
          placeholder="Coach name"
        />
      </div>

      {/* Description */}
      <div className="mb-6">
        <MonoLabel className="text-[10px] mb-2 block">DESCRIPTION</MonoLabel>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={!isEditable}
          rows={2}
          className="w-full bg-panel border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted/30 outline-none focus:border-primary/30 resize-none font-body disabled:opacity-50"
          placeholder="What does this coach do?"
        />
      </div>

      {/* Category */}
      <div className="mb-6">
        <MonoLabel className="text-[10px] mb-2 block">CATEGORY</MonoLabel>
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          disabled={!isEditable}
          className="w-full bg-panel border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted/30 outline-none focus:border-primary/30 font-body disabled:opacity-50"
          placeholder="e.g., strategy, operations, mindset"
        />
      </div>

      {/* System Prompt */}
      <div className="mb-6">
        <MonoLabel className="text-[10px] mb-2 block">SYSTEM PROMPT</MonoLabel>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          disabled={!isEditable}
          rows={16}
          className="w-full bg-panel border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted/30 outline-none focus:border-primary/30 resize-none font-mono leading-relaxed disabled:opacity-50"
          placeholder="The system prompt that defines this coach's personality and behavior..."
        />
      </div>
    </div>
  );
}
