"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SlantedButton } from "@/components/slanted-button";
import { PanelCard } from "@/components/panel-card";
import { MonoLabel } from "@/components/mono-label";

interface Conversation {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export function ConversationListClient({
  workspaceId,
  conversations,
}: {
  workspaceId: string;
  conversations: Conversation[];
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  async function handleNewConversation() {
    setCreating(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Failed to create conversation");
      const data = await res.json();
      router.push(`/dashboard/${workspaceId}/conversations/${data.id}`);
    } catch {
      setCreating(false);
    }
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

  return (
    <div className="mx-auto max-w-[1200px] px-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            Conversations
          </h1>
          <p className="font-mono text-xs text-muted mt-1">
            {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
          </p>
        </div>
        <SlantedButton onClick={handleNewConversation} disabled={creating}>
          {creating ? "Creating..." : "+ New Conversation"}
        </SlantedButton>
      </div>

      {/* Empty state */}
      {conversations.length === 0 && (
        <PanelCard className="text-center py-16">
          <MonoLabel className="text-muted mb-4 block">No conversations yet</MonoLabel>
          <p className="text-sm text-muted mb-6">
            Start your first conversation to begin thinking with Tensient.
          </p>
          <SlantedButton onClick={handleNewConversation} disabled={creating}>
            Start First Conversation
          </SlantedButton>
        </PanelCard>
      )}

      {/* Conversation list */}
      <div className="space-y-2">
        {conversations.map((convo) => (
          <Link
            key={convo.id}
            href={`/dashboard/${workspaceId}/conversations/${convo.id}`}
            className="block"
          >
            <PanelCard className="hover:border-primary/30 transition-colors cursor-pointer group">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-body text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                    {convo.title || "Untitled conversation"}
                  </h3>
                </div>
                <span className="font-mono text-[10px] text-muted ml-4 shrink-0">
                  {formatRelativeTime(convo.updatedAt)}
                </span>
              </div>
            </PanelCard>
          </Link>
        ))}
      </div>
    </div>
  );
}
