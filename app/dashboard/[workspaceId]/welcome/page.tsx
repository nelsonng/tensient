"use client";

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { GlitchText } from "@/components/glitch-text";
import { SlantedButton } from "@/components/slanted-button";
import { MonoLabel } from "@/components/mono-label";
import { VoiceRecorder } from "@/components/voice-recorder";

// ── Main Component ────────────────────────────────────────────────────

export default function WelcomePage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.workspaceId as string;

  const [input, setInput] = useState("");
  const [inputMode, setInputMode] = useState<"voice" | "text">("voice");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const handleVoiceUnsupported = useCallback(() => {
    setInputMode("text");
  }, []);

  function handleSubmit() {
    if (input.trim().length < 10) return;
    setSubmitting(true);

    // Fire onboard API — don't await the response.
    // The serverless function will continue running on Vercel (maxDuration=60)
    // even after the client navigates away.
    fetch(`/api/workspaces/${workspaceId}/onboard`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rawInput: input,
        source: audioUrl ? "voice" : "web",
        audioUrl: audioUrl || undefined,
      }),
    }).catch(() => {
      // Fire-and-forget: errors are logged server-side
    });

    // Navigate to dashboard immediately — zero wait
    router.push(`/dashboard/${workspaceId}?fresh=1`);
  }

  return (
    <div className="mx-auto max-w-[700px] px-6 pt-16 pb-24">
      {/* Header */}
      <MonoLabel className="mb-4 block text-primary">
        WELCOME TO TENSIENT
      </MonoLabel>

      <GlitchText
        text="WHAT'S GOING ON WITH YOUR TEAM?"
        as="h1"
        className="text-2xl md:text-3xl mb-4"
      />

      <p className="font-body text-base text-muted mb-8 max-w-[540px] leading-relaxed">
        Goals, frustrations, blockers, wins, who&apos;s doing what — just let it
        out. We&apos;ll extract your goals, synthesize your thoughts, and
        identify your team. One ramble does it all.
      </p>

      {/* Voice input (default) */}
      {inputMode === "voice" && !submitting && (
        <>
          <VoiceRecorder
            workspaceId={workspaceId}
            onTranscription={(text, url) => {
              setVoiceError(null);
              setInput(text);
              if (url) setAudioUrl(url);
              setInputMode("text");
            }}
            onError={(errMsg, url) => {
              if (url) setAudioUrl(url);
              setVoiceError(errMsg);
              setInputMode("text");
            }}
            onUnsupported={handleVoiceUnsupported}
          />
          <button
            onClick={() => setInputMode("text")}
            className="block mx-auto mt-4 font-mono text-xs text-muted underline underline-offset-4 cursor-pointer hover:text-foreground transition-colors"
          >
            or type instead
          </button>
        </>
      )}

      {/* Text input (fallback or after transcription) */}
      {inputMode === "text" && !submitting && (
        <>
          {voiceError && (
            <p className="font-mono text-xs text-destructive mb-4">
              {voiceError} — you can type manually or try again.
            </p>
          )}

          <textarea
            value={input}
            onChange={(e) => {
              if (voiceError) setVoiceError(null);
              setInput(e.target.value);
            }}
            rows={6}
            className="w-full rounded-lg border border-border bg-panel px-6 py-4 font-body text-base text-foreground leading-relaxed placeholder:text-muted/50 focus:border-primary focus:outline-none resize-none mb-4"
            placeholder="We need to ship the mobile app by March. Marcus is behind on the API integration and Rachel is stretched across three projects. Our biggest risk is churn — onboarding is broken and customers are complaining. I want the team focused on fixing retention before we chase new features."
          />

          {!input && (
            <button
              onClick={() => {
                setVoiceError(null);
                setInputMode("voice");
              }}
              className="font-mono text-xs text-muted underline underline-offset-4 cursor-pointer hover:text-foreground transition-colors mb-4 block"
            >
              or use voice instead
            </button>
          )}

          <SlantedButton
            onClick={handleSubmit}
            disabled={input.trim().length < 10}
          >
            LET&apos;S GO
          </SlantedButton>
        </>
      )}

      {/* Submitting state — brief transition before navigation */}
      {submitting && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-3 h-3 rounded-full bg-primary animate-pulse mb-4" />
          <p className="font-mono text-sm text-primary font-bold tracking-wider">
            LAUNCHING YOUR DASHBOARD...
          </p>
        </div>
      )}
    </div>
  );
}
