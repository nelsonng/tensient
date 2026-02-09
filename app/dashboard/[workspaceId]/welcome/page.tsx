"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { GlitchText } from "@/components/glitch-text";
import { SlantedButton } from "@/components/slanted-button";
import { PanelCard } from "@/components/panel-card";
import { MonoLabel } from "@/components/mono-label";
import { StatusPill } from "@/components/status-pill";
import { motion, AnimatePresence } from "framer-motion";

// ── Types ──────────────────────────────────────────────────────────

type Step = "role" | "genesis" | "capture" | "result";

interface GenesisResult {
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
    driftScore: number;
    sentimentScore: number;
    content: string;
    actionItems: ActionItem[];
    feedback: string;
  };
  streakCount: number;
  tractionScore: number;
}

// ── Helpers ────────────────────────────────────────────────────────

function getDriftColor(score: number): string {
  if (score <= 0.2) return "text-primary";
  if (score <= 0.5) return "text-yellow-400";
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

  // Genesis state
  const [genesisInput, setGenesisInput] = useState("");
  const [genesisLoading, setGenesisLoading] = useState(false);
  const [genesisResult, setGenesisResult] = useState<GenesisResult | null>(null);

  // Capture state
  const [captureInput, setCaptureInput] = useState("");
  const [captureLoading, setCaptureLoading] = useState(false);
  const [captureResult, setCaptureResult] = useState<CaptureResult | null>(null);

  const [error, setError] = useState("");

  // ── Handlers ───────────────────────────────────────────────────

  function handleRoleSelect(r: "manager" | "ic") {
    setRole(r);
    if (r === "manager") {
      setStep("genesis");
    } else {
      // ICs skip Genesis and go straight to Capture
      setStep("capture");
    }
  }

  async function handleGenesis() {
    setError("");
    setGenesisLoading(true);

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/genesis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawInput: genesisInput }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Genesis failed");
      } else {
        setGenesisResult(data);
        // Auto-advance to Capture after a brief moment
        setTimeout(() => setStep("capture"), 100);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setGenesisLoading(false);
    }
  }

  async function handleCapture() {
    setError("");
    setCaptureLoading(true);

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/captures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: captureInput }),
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

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-[700px] px-6 pt-16 pb-24">
      {/* Progress indicator */}
      <div className="flex items-center gap-2 mb-12">
        {["role", "genesis", "capture", "result"].map((s, i) => {
          // Skip "genesis" indicator for ICs
          if (s === "genesis" && role === "ic") return null;
          const stepList = role === "ic"
            ? ["role", "capture", "result"]
            : ["role", "genesis", "capture", "result"];
          const currentIndex = stepList.indexOf(step);
          const thisIndex = stepList.indexOf(s);
          const isActive = thisIndex <= currentIndex;
          return (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && !(s === "genesis" && role === "ic") && (
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
                  I SET STRATEGY
                </MonoLabel>
                <h3 className="font-display text-lg font-bold uppercase tracking-tight mb-2">
                  MANAGER
                </h3>
                <p className="font-body text-base text-muted leading-relaxed">
                  Define what matters. AI turns your direction into a strategic
                  reference your whole team aligns to.
                </p>
              </button>

              <button
                onClick={() => handleRoleSelect("ic")}
                className="group cursor-pointer text-left rounded-lg border border-border bg-panel p-6 transition-colors hover:border-primary"
              >
                <MonoLabel className="mb-3 block text-primary group-hover:text-primary">
                  I DO THE WORK
                </MonoLabel>
                <h3 className="font-display text-lg font-bold uppercase tracking-tight mb-2">
                  INDIVIDUAL CONTRIBUTOR
                </h3>
                <p className="font-body text-base text-muted leading-relaxed">
                  Dump what&apos;s on your mind. AI extracts action items, scores
                  your alignment, and gives you coaching.
                </p>
              </button>
            </div>
          </FadeIn>
        )}

        {/* ── Step 2a: Genesis (Managers only) ─────────────────── */}
        {step === "genesis" && (
          <FadeIn stepKey="genesis">
            <MonoLabel className="mb-4 block text-primary">
              STEP 1 / SET YOUR STRATEGY
            </MonoLabel>

            <h1 className="font-display text-3xl md:text-4xl font-bold uppercase tracking-tight mb-4">
              WHAT MATTERS MOST RIGHT NOW?
            </h1>

            <p className="font-body text-base text-muted mb-8 max-w-[500px]">
              In a few sentences, tell us what your team should be focused on.
              Don&apos;t overthink it -- just say what matters.
            </p>

            <textarea
              value={genesisInput}
              onChange={(e) => setGenesisInput(e.target.value)}
              rows={6}
              className="w-full rounded-lg border border-border bg-panel px-6 py-4 font-body text-base text-foreground leading-relaxed placeholder:text-muted/50 focus:border-primary focus:outline-none resize-none mb-4"
              placeholder="We need to ship the mobile app by March. Our biggest risk is the payment integration. Quality matters more than speed right now."
            />

            {error && (
              <p className="font-mono text-xs text-red-400 mb-4">{error}</p>
            )}

            <div className="flex items-center gap-4">
              <SlantedButton
                onClick={handleGenesis}
                disabled={genesisLoading || genesisInput.trim().length < 10}
              >
                {genesisLoading ? "PROCESSING..." : "SET STRATEGY"}
              </SlantedButton>

              {genesisLoading && (
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  <span className="font-mono text-xs text-muted">
                    EXTRACTING STRATEGIC PILLARS...
                  </span>
                </div>
              )}
            </div>

            {/* Show Genesis results inline before advancing */}
            {genesisResult && (
              <div className="mt-8 space-y-4">
                <PanelCard>
                  <MonoLabel className="mb-3 block text-primary">
                    YOUR STRATEGIC PILLARS
                  </MonoLabel>
                  <div className="space-y-2">
                    {genesisResult.pillars.map((pillar, i) => (
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
                    TONE: <span className="text-primary uppercase">{genesisResult.tone}</span>
                  </span>
                  {genesisResult.protocol && (
                    <span className="font-mono text-xs text-muted">
                      PROTOCOL: <span className="text-foreground uppercase">{genesisResult.protocol.name}</span>
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
              {role === "manager" ? "STEP 2 / TRY IT AS YOUR TEAM WOULD" : "STEP 1 / UNLOAD"}
            </MonoLabel>

            <h1 className="font-display text-3xl md:text-4xl font-bold uppercase tracking-tight mb-4">
              {role === "manager"
                ? "NOW TYPE AN UPDATE"
                : "WHAT'S ON YOUR MIND?"}
            </h1>

            <p className="font-body text-base text-muted mb-8 max-w-[500px]">
              {role === "manager"
                ? "Pretend you're a team member. Type what's on your mind today -- blockers, progress, frustrations. The system will compare it to the strategy you just set."
                : "Type what you've been working on, what's blocking you, or what's frustrating you. Don't worry about formatting -- just dump it."}
            </p>

            {role === "ic" && !genesisResult && (
              <div className="mb-6 rounded-lg border border-border bg-panel/50 px-4 py-3">
                <p className="font-mono text-xs text-muted">
                  TIP: Ask your manager to run Genesis to set the team strategy.
                  You can still capture updates now -- drift scoring will activate once a strategy is set.
                </p>
              </div>
            )}

            <textarea
              value={captureInput}
              onChange={(e) => setCaptureInput(e.target.value)}
              rows={6}
              className="w-full rounded-lg border border-border bg-panel px-6 py-4 font-body text-base text-foreground leading-relaxed placeholder:text-muted/50 focus:border-primary focus:outline-none resize-none mb-4"
              placeholder="I'm stuck waiting on the design team for the homepage assets. Spent the morning fixing auth bugs instead. Not sure if that's the best use of my time."
            />

            {error && (
              <p className="font-mono text-xs text-red-400 mb-4">{error}</p>
            )}

            <div className="flex items-center gap-4">
              <SlantedButton
                onClick={handleCapture}
                disabled={captureLoading || captureInput.trim().length < 5}
              >
                {captureLoading ? "ANALYZING..." : "SUBMIT UPDATE"}
              </SlantedButton>

              {captureLoading && (
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  <span className="font-mono text-xs text-muted">
                    ANALYZING DRIFT AND SENTIMENT...
                  </span>
                </div>
              )}
            </div>
          </FadeIn>
        )}

        {/* ── Step 4: Result (The Aha Moment) ─────────────────── */}
        {step === "result" && captureResult && (
          <FadeIn stepKey="result">
            <MonoLabel className="mb-4 block text-primary">
              YOUR FIRST ARTIFACT
            </MonoLabel>

            <GlitchText
              text="THIS IS TENSIENT"
              as="h1"
              className="text-3xl md:text-4xl mb-4"
            />

            <p className="font-body text-base text-muted mb-8 max-w-[500px]">
              {role === "manager"
                ? "This is what your team members will see after every update. Drift scored, actions extracted, coaching delivered -- automatically."
                : "Every time you dump what's on your mind, Tensient turns it into this. No more agonizing over weekly summaries."}
            </p>

            {/* Scores Row */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <PanelCard>
                <MonoLabel className="mb-2 block">DRIFT</MonoLabel>
                <span
                  className={`font-mono text-2xl font-bold ${getDriftColor(
                    captureResult.artifact.driftScore
                  )}`}
                >
                  {captureResult.artifact.driftScore.toFixed(2)}
                </span>
                <p className="font-mono text-xs text-muted mt-1">
                  {captureResult.artifact.driftScore <= 0.2
                    ? "ON TRACK"
                    : captureResult.artifact.driftScore <= 0.5
                    ? "SLIGHT DRIFT"
                    : "OFF COURSE"}
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
              <PanelCard>
                <MonoLabel className="mb-2 block">TRACTION</MonoLabel>
                <span className="font-mono text-2xl font-bold text-primary">
                  {Math.round(captureResult.tractionScore * 100)}%
                </span>
                <p className="font-mono text-xs text-muted mt-1">
                  STREAK: {captureResult.streakCount}
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
              <PanelCard className="mb-8">
                <MonoLabel className="mb-3 block">COACHING</MonoLabel>
                <p className="font-body text-base leading-relaxed text-muted">
                  {captureResult.artifact.feedback}
                </p>
              </PanelCard>
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
