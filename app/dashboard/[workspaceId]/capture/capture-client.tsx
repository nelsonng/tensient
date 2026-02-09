"use client";

import { useState } from "react";
import Link from "next/link";
import { GlitchText } from "@/components/glitch-text";
import { SlantedButton } from "@/components/slanted-button";
import { PanelCard } from "@/components/panel-card";
import { MonoLabel } from "@/components/mono-label";
import { StatusPill } from "@/components/status-pill";

interface ActionItem {
  task: string;
  status: string;
}

interface CaptureResult {
  artifact: {
    id: string;
    alignmentScore: number;
    sentimentScore: number;
    content: string;
    actionItems: ActionItem[];
    feedback: string;
  };
  streakCount: number;
  alignmentScore: number;
}

function getAlignmentColor(score: number): string {
  if (score >= 0.8) return "text-primary";
  if (score >= 0.5) return "text-warning";
  return "text-destructive";
}

function getSentimentLabel(score: number): string {
  if (score >= 0.3) return "POSITIVE";
  if (score >= -0.3) return "NEUTRAL";
  return "FRUSTRATED";
}

interface CaptureClientProps {
  workspaceId: string;
  placeholder: string;
}

export function CaptureClient({ workspaceId, placeholder }: CaptureClientProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit() {
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/captures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Capture failed");
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
        CAPTURE / UNLOAD
      </MonoLabel>

      <GlitchText text="CLEAR YOUR CACHE" as="h1" className="text-4xl mb-6" />

      <p className="font-body text-base text-muted mb-8 max-w-[600px]">
        Unload what is on your mind. What is blocking you? What did you
        accomplish? The system extracts signal, scores alignment, and surfaces
        action items.
      </p>

      {!result ? (
        <div className="space-y-6">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            className="w-full rounded-lg border border-border bg-panel px-6 py-4 font-body text-base text-foreground leading-relaxed placeholder:text-muted focus:border-primary focus:outline-none resize-none"
            placeholder={placeholder}
          />

          {error && (
            <p className="font-mono text-xs text-destructive">{error}</p>
          )}

          <SlantedButton
            onClick={handleSubmit}
            disabled={loading || content.trim().length < 5}
          >
            {loading ? "PROCESSING..." : "SUBMIT CAPTURE"}
          </SlantedButton>

          {loading && (
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-secondary animate-pulse" />
              <span className="font-mono text-xs text-secondary">
                ANALYZING ALIGNMENT...
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Scores Row */}
          <div className="grid grid-cols-2 gap-4">
            <PanelCard>
              <MonoLabel className="mb-2 block">ALIGNMENT</MonoLabel>
              <span
                className={`font-mono text-3xl font-bold ${getAlignmentColor(
                  result.artifact.alignmentScore
                )}`}
              >
                {Math.round(result.artifact.alignmentScore * 100)}%
              </span>
              <span className="block font-mono text-xs text-muted mt-1">
                STREAK: {result.streakCount}
              </span>
            </PanelCard>
            <PanelCard>
              <MonoLabel className="mb-2 block">SENTIMENT</MonoLabel>
              <span className="font-display text-lg font-bold uppercase text-foreground">
                {getSentimentLabel(result.artifact.sentimentScore)}
              </span>
              <span className="block font-mono text-xs text-muted mt-1">
                {result.artifact.sentimentScore.toFixed(2)}
              </span>
            </PanelCard>
          </div>

          {/* Synthesis */}
          <PanelCard>
            <MonoLabel className="mb-3 block text-primary">
              SYNTHESIZED UPDATE
            </MonoLabel>
            <p className="font-body text-base leading-relaxed text-foreground">
              {result.artifact.content}
            </p>
          </PanelCard>

          {/* Action Items */}
          {result.artifact.actionItems.length > 0 && (
            <PanelCard>
              <MonoLabel className="mb-3 block text-primary">
                ACTION ITEMS
              </MonoLabel>
              <div className="space-y-2">
                {result.artifact.actionItems.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between border-b border-border pb-2 last:border-0"
                  >
                    <span className="font-body text-base text-foreground">
                      {item.task}
                    </span>
                    <StatusPill
                      status={
                        item.status === "done"
                          ? "success"
                          : item.status === "blocked"
                          ? "error"
                          : "active"
                      }
                      label={item.status}
                    />
                  </div>
                ))}
              </div>
            </PanelCard>
          )}

          {/* Feedback */}
          {result.artifact.feedback && (
            <PanelCard>
              <MonoLabel className="mb-3 block">COACHING</MonoLabel>
              <p className="font-body text-base text-muted leading-relaxed">
                {result.artifact.feedback}
              </p>
            </PanelCard>
          )}

          <div className="flex gap-4">
            <SlantedButton
              onClick={() => {
                setResult(null);
                setContent("");
              }}
              variant="outline"
            >
              NEW CAPTURE
            </SlantedButton>
            <SlantedButton href={`/dashboard/${workspaceId}`}>
              DASHBOARD
            </SlantedButton>
          </div>
        </div>
      )}
    </div>
  );
}
