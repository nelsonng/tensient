"use client";

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { GlitchText } from "@/components/glitch-text";
import { SlantedButton } from "@/components/slanted-button";
import { PanelCard } from "@/components/panel-card";
import { MonoLabel } from "@/components/mono-label";
import { StatusPill } from "@/components/status-pill";
import { motion, AnimatePresence } from "framer-motion";
import { VoiceRecorder } from "@/components/voice-recorder";

// ── Types ──────────────────────────────────────────────────────────

type Step = "role" | "strategy" | "capture" | "result";

interface StrategyResult {
  canon: { id: string; content: string };
  protocol: { id: string; name: string } | null;
  pillars: string[];
  tone: string;
}

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

// ── Helpers ────────────────────────────────────────────────────────

function getAlignmentColor(score: number): string {
  if (score >= 0.8) return "text-primary";
  if (score >= 0.5) return "text-yellow-400";
  return "text-red-400";
}

function getSentimentLabel(score: number): string {
  if (score >= 0.3) return "POSITIVE";
  if (score >= -0.3) return "NEUTRAL";
  return "FRUSTRATED";
}

function getSentimentColor(score: number): string {
  if (score >= 0.3) return "text-primary";
  if (score >= -0.3) return "text-yellow-400";
  return "text-red-400";
}

// ── Fade wrapper ───────────────────────────────────────────────────

function FadeIn({ children, stepKey }: { children: React.ReactNode; stepKey: string }) {
  return (
    <motion.div
      key={stepKey}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

// ── Main Component ─────────────────────────────────────────────────

export default function WelcomePage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.workspaceId as string;

  const [step, setStep] = useState<Step>("role");
  const [role, setRole] = useState<"manager" | "ic" | null>(null);

  // Strategy state
  const [strategyInput, setStrategyInput] = useState("");
  const [strategyInputMode, setStrategyInputMode] = useState<"text" | "voice">("voice");
  const [strategyLoading, setStrategyLoading] = useState(false);
  const [strategyResult, setStrategyResult] = useState<StrategyResult | null>(null);

  // Capture state
  const [captureInput, setCaptureInput] = useState("");
  const [captureInputMode, setCaptureInputMode] = useState<"text" | "voice">("voice");
  const [captureAudioUrl, setCaptureAudioUrl] = useState<string | null>(null);
  const [captureLoading, setCaptureLoading] = useState(false);
  const [captureResult, setCaptureResult] = useState<CaptureResult | null>(null);

  const [error, setError] = useState("");

  // ── Handlers ───────────────────────────────────────────────────

  function handleRoleSelect(r: "manager" | "ic") {
    setRole(r);
    if (r === "manager") {
      setStep("strategy");
    } else {
      // ICs skip Strategy and go straight to Capture
      setStep("capture");
    }
  }

  async function handleStrategy() {
    setError("");
    setStrategyLoading(true);

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/strategy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawInput: strategyInput }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Strategy setup failed");
      } else {
        setStrategyResult(data);
        setTimeout(() => setStep("capture"), 100);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setStrategyLoading(false);
    }
  }

  async function handleCapture() {
    setError("");
    setCaptureLoading(true);

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/captures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: captureInput,
          source: captureAudioUrl ? "voice" : "web",
          audioUrl: captureAudioUrl || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Capture failed");
      } else {
        setCaptureResult(data);
        setStep("result");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setCaptureLoading(false);
    }
  }

  // Voice unsupported fallbacks
  const handleStrategyVoiceUnsupported = useCallback(() => {
    setStrategyInputMode("text");
  }, []);

  const handleCaptureVoiceUnsupported = useCallback(() => {
    setCaptureInputMode("text");
  }, []);

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-[700px] px-6 pt-16 pb-24">
      {/* Progress indicator */}
      <div className="flex items-center gap-2 mb-12">
        {["role", "strategy", "capture", "result"].map((s, i) => {
          if (s === "strategy" && role === "ic") return null;
          const stepList = role === "ic"
            ? ["role", "capture", "result"]
            : ["role", "strategy", "capture", "result"];
          const currentIndex = stepList.indexOf(step);
          const thisIndex = stepList.indexOf(s);
          const isActive = thisIndex <= currentIndex;
          return (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && !(s === "strategy" && role === "ic") && (
                <div className={`h-px w-8 ${isActive ? "bg-primary" : "bg-border"}`} />
              )}
              <div
                className={`h-2 w-2 rounded-full ${
                  isActive ? "bg-primary" : "bg-border"
                }`}
              />
            </div>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {/* ── Step 1: Role Selection ────────────────────────────── */}
        {step === "role" && (
          <FadeIn stepKey="role">
            <MonoLabel className="mb-4 block text-primary">
              WELCOME TO TENSIENT
            </MonoLabel>

            <h1 className="font-display text-3xl md:text-4xl font-bold uppercase tracking-tight mb-4">
              WHAT DESCRIBES YOU BEST?
            </h1>

            <p className="font-body text-base text-muted mb-10 max-w-[500px]">
              This helps us set up your workspace. You can always switch later.
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <button
                onClick={() => handleRoleSelect("manager")}
                className="group cursor-pointer text-left rounded-lg border border-border bg-panel p-6 transition-colors hover:border-primary"
              >
                <MonoLabel className="mb-3 block text-primary group-hover:text-primary">
                  I LEAD A TEAM
                </MonoLabel>
                <h3 className="font-display text-lg font-bold uppercase tracking-tight mb-2">
                  MANAGER
                </h3>
                <p className="font-body text-base text-muted leading-relaxed">
                  Tell us what your team should be focused on. We&apos;ll turn it
                  into clear objectives everyone can align to.
                </p>
              </button>

              <button
                onClick={() => handleRoleSelect("ic")}
                className="group cursor-pointer text-left rounded-lg border border-border bg-panel p-6 transition-colors hover:border-primary"
              >
                <MonoLabel className="mb-3 block text-primary group-hover:text-primary">
                  I&apos;M A TEAM MEMBER
                </MonoLabel>
                <h3 className="font-display text-lg font-bold uppercase tracking-tight mb-2">
                  INDIVIDUAL CONTRIBUTOR
                </h3>
                <p className="font-body text-base text-muted leading-relaxed">
                  Just talk about your week. What happened, what&apos;s stuck,
                  what&apos;s next. We&apos;ll handle the rest.
                </p>
              </button>
            </div>

            {error && (
              <p className="font-mono text-xs text-red-400 mt-4">{error}</p>
            )}
          </FadeIn>
        )}

        {/* ── Step 2a: Goals (Managers only) ───────────────────── */}
        {step === "strategy" && (
          <FadeIn stepKey="strategy">
            <MonoLabel className="mb-4 block text-primary">
              STEP 1 / SET YOUR GOALS
            </MonoLabel>

            <h1 className="font-display text-3xl md:text-4xl font-bold uppercase tracking-tight mb-4">
              WHAT IS YOUR TEAM TRYING TO ACHIEVE?
            </h1>

            <p className="font-body text-base text-muted mb-8 max-w-[500px] leading-relaxed">
              Just say it in your own words -- we&apos;ll distill it into clear
              objectives. Don&apos;t overthink it.
            </p>

            {/* Voice-first input */}
            {strategyInputMode === "voice" && (
              <>
                <VoiceRecorder
                  workspaceId={workspaceId}
                  onTranscription={(text) => {
                    setStrategyInput(text);
                    setStrategyInputMode("text");
                  }}
                  onError={(errMsg) => {
                    setError(`Audio saved. ${errMsg} -- you can type manually.`);
                    setStrategyInputMode("text");
                  }}
                  onUnsupported={handleStrategyVoiceUnsupported}
                />

                <button
                  onClick={() => setStrategyInputMode("text")}
                  className="block mx-auto mt-4 font-mono text-xs text-muted underline underline-offset-4 cursor-pointer hover:text-foreground transition-colors"
                >
                  or type instead
                </button>
              </>
            )}

            {/* Text input (fallback or after transcription) */}
            {strategyInputMode === "text" && (
              <>
                <textarea
                  value={strategyInput}
                  onChange={(e) => setStrategyInput(e.target.value)}
                  rows={6}
                  className="w-full rounded-lg border border-border bg-panel px-6 py-4 font-body text-base text-foreground leading-relaxed placeholder:text-muted/50 focus:border-primary focus:outline-none resize-none mb-4"
                  placeholder="We need to ship the mobile app by March. Our biggest risk is the payment integration. Quality matters more than speed right now."
                />

                {!strategyInput && (
                  <button
                    onClick={() => setStrategyInputMode("voice")}
                    className="font-mono text-xs text-muted underline underline-offset-4 cursor-pointer hover:text-foreground transition-colors mb-4 block"
                  >
                    or use voice instead
                  </button>
                )}

                <div className="flex items-center gap-4">
                  <SlantedButton
                    onClick={handleStrategy}
                    disabled={strategyLoading || strategyInput.trim().length < 10}
                  >
                    {strategyLoading ? "PROCESSING..." : "SET GOALS"}
                  </SlantedButton>

                  {strategyLoading && (
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                      <span className="font-mono text-xs text-muted">
                        DISTILLING OBJECTIVES...
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}

            {error && (
              <p className="font-mono text-xs text-red-400 mt-4">{error}</p>
            )}

            {/* Show Strategy results inline before advancing */}
            {strategyResult && (
              <div className="mt-8 space-y-4">
                <PanelCard>
                  <MonoLabel className="mb-3 block text-primary">
                    YOUR OBJECTIVES
                  </MonoLabel>
                  <div className="space-y-2">
                    {strategyResult.pillars.map((pillar, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className="font-mono text-xs text-primary mt-0.5">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <p className="font-body text-base text-foreground">
                          {pillar}
                        </p>
                      </div>
                    ))}
                  </div>
                </PanelCard>

                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-muted">
                    TONE: <span className="text-primary uppercase">{strategyResult.tone}</span>
                  </span>
                  {strategyResult.protocol && (
                    <span className="font-mono text-xs text-muted">
                      COACH: <span className="text-foreground uppercase">{strategyResult.protocol.name}</span>
                    </span>
                  )}
                </div>
              </div>
            )}
          </FadeIn>
        )}

        {/* ── Step 2b/3: Capture ──────────────────────────────── */}
        {step === "capture" && (
          <FadeIn stepKey="capture">
            <MonoLabel className="mb-4 block text-primary">
              {role === "manager" ? "STEP 2 / TRY IT AS YOUR TEAM WOULD" : "STEP 1 / TALK IT OUT"}
            </MonoLabel>

            <h1 className="font-display text-3xl md:text-4xl font-bold uppercase tracking-tight mb-4">
              WHAT&apos;S ON YOUR MIND?
            </h1>

            <p className="font-body text-base text-muted mb-8 max-w-[500px] leading-relaxed">
              {role === "manager"
                ? "Pretend you're a team member. What's on your mind today -- blockers, progress, frustrations? Just ramble. We'll compare it to the goals you just set."
                : "What's been on your mind this week? Frustrations, wins, blockers -- just let it out. Don't worry about being polished."}
            </p>

            {role === "ic" && !strategyResult && (
              <div className="mb-6 rounded-lg border border-border bg-panel/50 px-4 py-3">
                <p className="font-mono text-xs text-muted">
                  TIP: Ask your manager to set goals first.
                  You can still share updates now -- alignment scoring will activate once goals are set.
                </p>
              </div>
            )}

            {/* Voice-first input */}
            {captureInputMode === "voice" && (
              <>
                <VoiceRecorder
                  workspaceId={workspaceId}
                  onTranscription={(text, url) => {
                    setCaptureInput(text);
                    setCaptureAudioUrl(url);
                    setCaptureInputMode("text");
                  }}
                  onError={(errMsg, url) => {
                    if (url) setCaptureAudioUrl(url);
                    setError(`Audio saved. ${errMsg} -- you can type manually.`);
                    setCaptureInputMode("text");
                  }}
                  onUnsupported={handleCaptureVoiceUnsupported}
                />

                <button
                  onClick={() => setCaptureInputMode("text")}
                  className="block mx-auto mt-4 font-mono text-xs text-muted underline underline-offset-4 cursor-pointer hover:text-foreground transition-colors"
                >
                  or type instead
                </button>
              </>
            )}

            {/* Text input (fallback or after transcription) */}
            {captureInputMode === "text" && (
              <>
                <textarea
                  value={captureInput}
                  onChange={(e) => setCaptureInput(e.target.value)}
                  rows={6}
                  className="w-full rounded-lg border border-border bg-panel px-6 py-4 font-body text-base text-foreground leading-relaxed placeholder:text-muted/50 focus:border-primary focus:outline-none resize-none mb-4"
                  placeholder="I'm stuck waiting on the design team for the homepage assets. Spent the morning fixing auth bugs instead. Not sure if that's the best use of my time."
                />

                {!captureInput && !captureAudioUrl && (
                  <button
                    onClick={() => setCaptureInputMode("voice")}
                    className="font-mono text-xs text-muted underline underline-offset-4 cursor-pointer hover:text-foreground transition-colors mb-4 block"
                  >
                    or use voice instead
                  </button>
                )}

                {captureAudioUrl && (
                  <p className="font-mono text-xs text-muted mb-4">
                    Voice recorded. Review the transcription above, then submit.
                  </p>
                )}

                <div className="flex items-center gap-4">
                  <SlantedButton
                    onClick={handleCapture}
                    disabled={captureLoading || captureInput.trim().length < 5}
                  >
                    {captureLoading ? "ANALYZING..." : "SUBMIT"}
                  </SlantedButton>

                  {captureLoading && (
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                      <span className="font-mono text-xs text-muted">
                        ANALYZING ALIGNMENT...
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}

            {error && (
              <p className="font-mono text-xs text-red-400 mt-4">{error}</p>
            )}
          </FadeIn>
        )}

        {/* ── Step 4: Result (The Aha Moment) ─────────────────── */}
        {step === "result" && captureResult && (
          <FadeIn stepKey="result">
            <MonoLabel className="mb-4 block text-primary">
              YOUR FIRST SYNTHESIS
            </MonoLabel>

            <GlitchText
              text="THIS IS TENSIENT"
              as="h1"
              className="text-3xl md:text-4xl mb-4"
            />

            <p className="font-body text-base text-muted mb-8 max-w-[500px]">
              {role === "manager"
                ? "This is what your team members will see after every update. Alignment scored, actions extracted, coaching delivered -- automatically."
                : "Every time you talk out what's on your mind, Tensient turns it into this. No more agonizing over weekly summaries."}
            </p>

            {/* Scores Row */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <PanelCard>
                <MonoLabel className="mb-2 block">ALIGNMENT</MonoLabel>
                <span
                  className={`font-mono text-2xl font-bold ${getAlignmentColor(
                    captureResult.artifact.alignmentScore
                  )}`}
                >
                  {Math.round(captureResult.artifact.alignmentScore * 100)}%
                </span>
                <p className="font-mono text-xs text-muted mt-1">
                  {captureResult.artifact.alignmentScore >= 0.8
                    ? "STRONG"
                    : captureResult.artifact.alignmentScore >= 0.5
                    ? "MODERATE"
                    : "WEAK"}
                </p>
              </PanelCard>
              <PanelCard>
                <MonoLabel className="mb-2 block">SENTIMENT</MonoLabel>
                <span
                  className={`font-mono text-2xl font-bold ${getSentimentColor(
                    captureResult.artifact.sentimentScore
                  )}`}
                >
                  {getSentimentLabel(captureResult.artifact.sentimentScore)}
                </span>
                <p className="font-mono text-xs text-muted mt-1">
                  {captureResult.artifact.sentimentScore.toFixed(2)}
                </p>
              </PanelCard>
            </div>

            {/* Synthesized Update */}
            <PanelCard className="mb-4">
              <MonoLabel className="mb-3 block text-primary">
                SYNTHESIZED UPDATE
              </MonoLabel>
              <p className="font-body text-base leading-relaxed text-foreground">
                {captureResult.artifact.content}
              </p>
            </PanelCard>

            {/* Action Items */}
            {captureResult.artifact.actionItems.length > 0 && (
              <PanelCard className="mb-4">
                <MonoLabel className="mb-3 block text-primary">
                  ACTION ITEMS
                </MonoLabel>
                <div className="space-y-2">
                  {captureResult.artifact.actionItems.map((item, i) => (
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

            {/* Coaching */}
            {captureResult.artifact.feedback && (
              <PanelCard className="mb-4">
                <MonoLabel className="mb-3 block">COACHING</MonoLabel>
                <p className="font-body text-base leading-relaxed text-muted">
                  {captureResult.artifact.feedback}
                </p>
              </PanelCard>
            )}

            {/* Active Protocol */}
            {strategyResult?.protocol && (
              <div className="mb-8 rounded-lg border border-border bg-panel/50 px-5 py-4">
                <div className="flex items-center gap-2 mb-2">
                  <MonoLabel className="text-primary">ACTIVE COACH</MonoLabel>
                  <span className="font-mono text-xs text-foreground uppercase">
                    {strategyResult.protocol.name}
                  </span>
                </div>
                <p className="font-body text-sm text-muted leading-relaxed">
                  This coach shaped how your thought was analyzed. Different
                  coaches produce different synthesis styles, coaching tones,
                  and scoring priorities.
                </p>
              </div>
            )}

            {/* CTA to Dashboard */}
            <SlantedButton
              href={`/dashboard/${workspaceId}`}
              size="lg"
            >
              GO TO DASHBOARD
            </SlantedButton>
          </FadeIn>
        )}
      </AnimatePresence>
    </div>
  );
}
