"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { GlitchText } from "@/components/glitch-text";
import { SlantedButton } from "@/components/slanted-button";
import { PanelCard } from "@/components/panel-card";
import { MonoLabel } from "@/components/mono-label";

interface StrategyResult {
  canon: { id: string; content: string };
  protocol: { id: string; name: string } | null;
  pillars: string[];
  tone: string;
}

export default function StrategyPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StrategyResult | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit() {
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/strategy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawInput: input }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Strategy setup failed");
      } else {
        setResult(data);
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-[800px] px-6 pt-24 pb-24">
      <Link
        href={`/dashboard/${workspaceId}`}
        className="font-mono text-xs text-muted hover:text-primary mb-6 block"
      >
        &larr; BACK TO DASHBOARD
      </Link>

      <MonoLabel className="mb-4 block text-primary">
        GOALS / SET YOUR DIRECTION
      </MonoLabel>

      <GlitchText text="YOUR GOALS" as="h1" className="text-4xl mb-6" />

      <p className="font-body text-base text-muted mb-8 max-w-[600px]">
        Share what matters most. The system distills your direction
        into clear objectives and selects the right coach for your team.
      </p>

      {!result ? (
        <div className="space-y-6">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={10}
            className="w-full rounded-lg border border-border bg-panel px-6 py-4 font-body text-base text-foreground leading-relaxed placeholder:text-muted focus:border-primary focus:outline-none resize-none"
            placeholder="What matters most right now? What are the goals? What does winning look like in 90 days?"
          />

          {error && (
            <p className="font-mono text-xs text-destructive">{error}</p>
          )}

          <SlantedButton
            onClick={handleSubmit}
            disabled={loading || input.trim().length < 10}
          >
            {loading ? "PROCESSING..." : "SET GOALS"}
          </SlantedButton>

          {loading && (
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-secondary animate-pulse" />
              <span className="font-mono text-xs text-secondary">
                EXTRACTING OBJECTIVES...
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pillars */}
          <PanelCard>
            <MonoLabel className="mb-4 block text-primary">
              STRATEGIC PILLARS
            </MonoLabel>
            <div className="space-y-3">
              {result.pillars.map((pillar, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="font-mono text-xs text-primary mt-1">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="font-body text-base text-foreground">
                    {pillar}
                  </p>
                </div>
              ))}
            </div>
          </PanelCard>

          {/* Tone + Protocol */}
          <div className="grid grid-cols-2 gap-4">
            <PanelCard>
              <MonoLabel className="mb-2 block">DETECTED TONE</MonoLabel>
              <span className="font-display text-lg font-bold uppercase text-primary">
                {result.tone}
              </span>
            </PanelCard>
            <PanelCard>
              <MonoLabel className="mb-2 block">ACTIVE COACH</MonoLabel>
              <span className="font-display text-lg font-bold uppercase text-foreground">
                {result.protocol?.name || "NONE"}
              </span>
            </PanelCard>
          </div>

          {/* Synthesized Strategy */}
          <PanelCard>
            <MonoLabel className="mb-4 block text-primary">
              YOUR GOALS
            </MonoLabel>
            <p className="font-body text-base leading-relaxed text-foreground whitespace-pre-wrap">
              {result.canon.content}
            </p>
          </PanelCard>

          <div className="flex gap-4">
            <SlantedButton
              onClick={() => {
                setResult(null);
                setInput("");
              }}
              variant="outline"
            >
              UPDATE GOALS
            </SlantedButton>
            <SlantedButton href={`/dashboard/${workspaceId}`}>
              GO TO DASHBOARD
            </SlantedButton>
          </div>
        </div>
      )}
    </div>
  );
}
