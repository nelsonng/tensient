"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { SlantedButton } from "@/components/slanted-button";

interface Conversation {
  id: string;
  title: string | null;
  messageCount: number;
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

  async function handleDeleteConversation(conversationId: string) {
    const confirmed = window.confirm("Delete this conversation?");
    if (!confirmed) return;

    const res = await fetch(
      `/api/workspaces/${workspaceId}/conversations/${conversationId}`,
      { method: "DELETE" }
    );
    if (!res.ok) {
      alert("Failed to delete conversation.");
      return;
    }
    router.refresh();
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

  const columns: Array<DataTableColumn<Conversation>> = [
    {
      key: "title",
      label: "Title",
      sortable: true,
      render: (convo) => (
        <span className="truncate font-body text-sm text-foreground">
          {convo.title || "Untitled conversation"}
        </span>
      ),
    },
    {
      key: "messageCount",
      label: "Messages",
      sortable: true,
      sortValue: (convo) => convo.messageCount,
      render: (convo) => (
        <span className="font-mono text-[11px] text-muted">{convo.messageCount}</span>
      ),
    },
    {
      key: "updatedAt",
      label: "Updated",
      sortable: true,
      sortValue: (convo) => new Date(convo.updatedAt).getTime(),
      render: (convo) => (
        <span className="font-mono text-[11px] text-muted">
          {formatRelativeTime(convo.updatedAt)}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      title="Conversations"
      subtitle={`${conversations.length} conversation${
        conversations.length !== 1 ? "s" : ""
      }`}
      rows={conversations}
      columns={columns}
      toolbar={
        <SlantedButton onClick={handleNewConversation} disabled={creating}>
          {creating ? "Creating..." : "+ New Conversation"}
        </SlantedButton>
      }
      onRowClick={(convo) => router.push(`/dashboard/${workspaceId}/conversations/${convo.id}`)}
      rowActions={[
        {
          label: "Delete",
          variant: "danger",
          onClick: async (convo) => {
            await handleDeleteConversation(convo.id);
          },
        },
      ]}
      emptyTitle="No conversations yet"
      emptyDescription="Start your first conversation to begin thinking with Tensient."
    />
  );
}
