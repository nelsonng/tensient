"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SlantedButton } from "@/components/slanted-button";
import { PanelCard } from "@/components/panel-card";
import { MonoLabel } from "@/components/mono-label";

interface Coach {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  ownerType: string;
  ownerId: string | null;
  createdBy: string | null;
  isPublic: boolean;
  parentId: string | null;
  version: number;
  systemPrompt: string;
}

export function CoachesListClient({
  workspaceId,
  currentUserId,
  coaches,
}: {
  workspaceId: string;
  currentUserId: string;
  coaches: Coach[];
}) {
  const router = useRouter();
  const [forking, setForking] = useState<string | null>(null);

  const systemCoaches = coaches.filter((c) => c.ownerType === "system");
  const customCoaches = coaches.filter((c) => c.createdBy === currentUserId);

  async function handleFork(coach: Coach) {
    setForking(coach.id);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/protocols`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${coach.name} (Custom)`,
          description: coach.description,
          systemPrompt: coach.systemPrompt,
          category: coach.category,
          parentId: coach.id,
        }),
      });
      if (!res.ok) throw new Error("Failed to fork coach");
      const forked = await res.json();
      router.push(`/dashboard/${workspaceId}/coaches/${forked.id}`);
    } catch {
      setForking(null);
    }
  }

  async function handleNew() {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/protocols`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "New Coach",
          description: "",
          systemPrompt: "You are a helpful coach. Provide insightful feedback and ask thought-provoking questions.",
          category: "custom",
        }),
      });
      if (!res.ok) throw new Error("Failed to create coach");
      const coach = await res.json();
      router.push(`/dashboard/${workspaceId}/coaches/${coach.id}`);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="mx-auto max-w-[1200px] px-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            Coaches
          </h1>
          <p className="font-mono text-xs text-muted mt-1">
            Select coaches to shape how Tensient responds in conversations
          </p>
        </div>
        <SlantedButton onClick={handleNew}>+ New Coach</SlantedButton>
      </div>

      {/* Custom coaches */}
      {customCoaches.length > 0 && (
        <div className="mb-10">
          <MonoLabel className="text-primary mb-3 block">YOUR COACHES</MonoLabel>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {customCoaches.map((coach) => (
              <div
                key={coach.id}
                onClick={() =>
                  router.push(`/dashboard/${workspaceId}/coaches/${coach.id}`)
                }
                className="cursor-pointer"
              >
              <PanelCard
                className="hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-display text-sm font-bold text-foreground">
                    {coach.name}
                  </span>
                  {coach.parentId && (
                    <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-secondary/10 text-secondary border border-secondary/20">
                      FORKED
                    </span>
                  )}
                </div>
                {coach.description && (
                  <p className="font-body text-xs text-muted leading-relaxed">
                    {coach.description}
                  </p>
                )}
              </PanelCard>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* System coaches */}
      <MonoLabel className="text-muted mb-3 block">SYSTEM COACHES</MonoLabel>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {systemCoaches.map((coach) => (
          <PanelCard key={coach.id}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-display text-sm font-bold text-foreground">
                {coach.name}
              </span>
              <button
                onClick={() => handleFork(coach)}
                disabled={forking === coach.id}
                className="font-mono text-[10px] px-2 py-0.5 rounded border border-border text-muted hover:border-primary/30 hover:text-primary transition-colors"
              >
                {forking === coach.id ? "Forking..." : "Fork"}
              </button>
            </div>
            {coach.description && (
              <p className="font-body text-xs text-muted leading-relaxed mb-2">
                {coach.description}
              </p>
            )}
            {coach.category && (
              <span className="font-mono text-[9px] text-muted">
                {coach.category.toUpperCase()}
              </span>
            )}
          </PanelCard>
        ))}
      </div>
    </div>
  );
}
