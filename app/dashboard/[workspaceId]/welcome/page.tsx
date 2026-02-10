"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { GlitchText } from "@/components/glitch-text";
import { SlantedButton } from "@/components/slanted-button";
import { PanelCard } from "@/components/panel-card";
import { MonoLabel } from "@/components/mono-label";
import { motion, AnimatePresence } from "framer-motion";
import { VoiceRecorder } from "@/components/voice-recorder";

// ── Types ──────────────────────────────────────────────────────────────

type Step =
  | "goals_input"
  | "goals_review"
  | "thoughts_input"
  | "thoughts_review"
  | "coaching_recap"
  | "goal_journey"
  | "team_vision"
  | "dashboard_ready";

interface CoachingQuestion {
  coach: string;
  question: string;
}

interface SmartScore {
  specific: number;
  measurable: number;
  achievable: number;
  relevant: number;
  timeBound: number;
}

interface PillarHealth {
  title: string;
  score: number;
  smart: SmartScore;
  suggestion: string;
}

interface HealthAnalysis {
  overallScore: number;
  pillars: PillarHealth[];
}

interface GoalResult {
  canon: { id: string; content: string; rawInput: string };
  pillars: string[];
  tone: string;
  coachingQuestions: CoachingQuestion[];
  improvementRationale: string;
  healthAnalysis: HealthAnalysis | null;
  iterationCount?: number;
}

interface ThoughtResult {
  artifact: {
    id: string;
    alignmentScore: number;
    sentimentScore: number;
    content: string;
    actionItems: Array<{ task: string; status: string }>;
    feedback: string;
    coachingQuestions: CoachingQuestion[];
    alignmentExplanation: string;
  };
  streakCount?: number;
  alignmentScore?: number;
  iterationCount?: number;
}

// ── Coach names for animated loading ──────────────────────────────────

const COACH_NAMES = [
  "Paul Graham",
  "Wes Kao",
  "Garry Tan",
  "Systems Thinker",
  "Jensen T5T",
  "Wartime CEO",
  "Goal Clarity",
  "Organizational Alignment",
];

const LOADING_STAGES = [
  { label: "READING YOUR INPUT", duration: 2000 },
  { label: "CONSULTING", duration: 16000, cycleCoaches: true },
  { label: "RUNNING SMART ANALYSIS", duration: 3000 },
  { label: "PREPARING COACHING QUESTIONS", duration: 2000 },
];

// ── Helpers ────────────────────────────────────────────────────────────

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

function getSmartLabel(key: string): string {
  const labels: Record<string, string> = {
    specific: "S",
    measurable: "M",
    achievable: "A",
    relevant: "R",
    timeBound: "T",
  };
  return labels[key] || key;
}

function getSmartColor(score: number): string {
  if (score >= 0.7) return "bg-primary/20 text-primary border-primary/30";
  if (score >= 0.4) return "bg-yellow-400/20 text-yellow-400 border-yellow-400/30";
  return "bg-red-400/20 text-red-400 border-red-400/30";
}

// ── Fade wrapper ───────────────────────────────────────────────────────

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

// ── Coach Processing Animation ────────────────────────────────────────

function CoachProcessing({ label }: { label?: string }) {
  const [stageIndex, setStageIndex] = useState(0);
  const [coachIndex, setCoachIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    startTimeRef.current = Date.now();
    setStageIndex(0);
    setCoachIndex(0);
    setProgress(0);
  }, []);

  // Progress bar animation
  useEffect(() => {
    const totalDuration = LOADING_STAGES.reduce((sum, s) => sum + s.duration, 0);
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      // Cap at 90% -- the last 10% completes when the API finishes
      const pct = Math.min(90, (elapsed / totalDuration) * 100);
      setProgress(pct);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Stage progression
  useEffect(() => {
    let elapsed = 0;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    for (let i = 0; i < LOADING_STAGES.length; i++) {
      const timeout = setTimeout(() => {
        setStageIndex(i);
      }, elapsed);
      timeouts.push(timeout);
      elapsed += LOADING_STAGES[i].duration;
    }

    return () => timeouts.forEach(clearTimeout);
  }, []);

  // Coach name cycling (every 2s during the "CONSULTING" stage)
  useEffect(() => {
    const stage = LOADING_STAGES[stageIndex];
    if (!stage?.cycleCoaches) return;

    const interval = setInterval(() => {
      setCoachIndex((prev) => (prev + 1) % COACH_NAMES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [stageIndex]);

  const currentStage = LOADING_STAGES[stageIndex] ?? LOADING_STAGES[0];

  return (
    <div className="flex flex-col items-center justify-center py-16">
      {/* Pulsing circle */}
      <div className="relative mb-8">
        <motion.div
          className="w-16 h-16 rounded-full border-2 border-primary/30"
          animate={{
            scale: [1, 1.2, 1],
            borderColor: [
              "rgba(var(--primary-rgb, 0 255 136) / 0.3)",
              "rgba(var(--primary-rgb, 0 255 136) / 0.6)",
              "rgba(var(--primary-rgb, 0 255 136) / 0.3)",
            ],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
        </div>
      </div>

      {/* Stage label */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${stageIndex}-${coachIndex}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
          className="text-center mb-6"
        >
          <p className="font-mono text-sm text-primary font-bold tracking-wider">
            {currentStage.cycleCoaches
              ? `CONSULTING ${COACH_NAMES[coachIndex]}...`
              : `${currentStage.label}...`}
          </p>
        </motion.div>
      </AnimatePresence>

      {/* Label override (e.g., "REFINING...") */}
      {label && (
        <p className="font-mono text-xs text-muted mb-4">{label}</p>
      )}

      {/* Progress bar */}
      <div className="w-64 h-1 bg-border rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-primary rounded-full"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
      </div>

      {/* Coach count */}
      <p className="font-mono text-xs text-muted/50 mt-3">
        {COACH_NAMES.length} coaching lenses active
      </p>
    </div>
  );
}

// ── Voice + Text Input Component ──────────────────────────────────────

function VoiceTextInput({
  workspaceId,
  value,
  onChange,
  inputMode,
  setInputMode,
  onVoiceUnsupported,
  onAudioUrl,
  placeholder,
  rows = 5,
  minLength = 10,
  submitLabel,
  loading,
  onSubmit,
}: {
  workspaceId: string;
  value: string;
  onChange: (v: string) => void;
  inputMode: "voice" | "text";
  setInputMode: (m: "voice" | "text") => void;
  onVoiceUnsupported: () => void;
  onAudioUrl?: (url: string) => void;
  placeholder: string;
  rows?: number;
  minLength?: number;
  submitLabel: string;
  loading: boolean;
  onSubmit: () => void;
}) {
  if (loading) {
    return <CoachProcessing />;
  }

  return (
    <>
      {inputMode === "voice" && (
        <>
          <VoiceRecorder
            workspaceId={workspaceId}
            onTranscription={(text, url) => {
              onChange(text);
              if (url && onAudioUrl) onAudioUrl(url);
              setInputMode("text");
            }}
            onError={(_errMsg, url) => {
              if (url && onAudioUrl) onAudioUrl(url);
              setInputMode("text");
            }}
            onUnsupported={onVoiceUnsupported}
          />
          <button
            onClick={() => setInputMode("text")}
            className="block mx-auto mt-4 font-mono text-xs text-muted underline underline-offset-4 cursor-pointer hover:text-foreground transition-colors"
          >
            or type instead
          </button>
        </>
      )}

      {inputMode === "text" && (
        <>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={rows}
            className="w-full rounded-lg border border-border bg-panel px-6 py-4 font-body text-base text-foreground leading-relaxed placeholder:text-muted/50 focus:border-primary focus:outline-none resize-none mb-4"
            placeholder={placeholder}
          />

          {!value && (
            <button
              onClick={() => setInputMode("voice")}
              className="font-mono text-xs text-muted underline underline-offset-4 cursor-pointer hover:text-foreground transition-colors mb-4 block"
            >
              or use voice instead
            </button>
          )}

          <SlantedButton
            onClick={onSubmit}
            disabled={value.trim().length < minLength}
          >
            {submitLabel}
          </SlantedButton>
        </>
      )}
    </>
  );
}

// ── SMART Badge Row ───────────────────────────────────────────────────

function SmartBadgeRow({ smart }: { smart: SmartScore }) {
  return (
    <div className="flex gap-1.5">
      {(Object.entries(smart) as [string, number][]).map(([key, val]) => (
        <span
          key={key}
          className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-mono font-bold border ${getSmartColor(val)}`}
          title={`${key}: ${Math.round(val * 100)}%`}
        >
          {getSmartLabel(key)}
        </span>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────

export default function WelcomePage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;

  const [step, setStep] = useState<Step>("goals_input");

  // Goal state
  const [goalInput, setGoalInput] = useState("");
  const [goalInputMode, setGoalInputMode] = useState<"voice" | "text">("voice");
  const [goalLoading, setGoalLoading] = useState(false);
  const [goalResult, setGoalResult] = useState<GoalResult | null>(null);
  const [goalFeedback, setGoalFeedback] = useState("");
  const [goalFeedbackMode, setGoalFeedbackMode] = useState<"voice" | "text">("voice");
  const [goalRefineLoading, setGoalRefineLoading] = useState(false);
  const [previousGoalScore, setPreviousGoalScore] = useState<number | null>(null);

  // Thought state
  const [thoughtInput, setThoughtInput] = useState("");
  const [thoughtInputMode, setThoughtInputMode] = useState<"voice" | "text">("voice");
  const [thoughtAudioUrl, setThoughtAudioUrl] = useState<string | null>(null);
  const [thoughtLoading, setThoughtLoading] = useState(false);
  const [thoughtResult, setThoughtResult] = useState<ThoughtResult | null>(null);
  const [thoughtFeedback, setThoughtFeedback] = useState("");
  const [thoughtFeedbackMode, setThoughtFeedbackMode] = useState<"voice" | "text">("voice");
  const [thoughtRefineLoading, setThoughtRefineLoading] = useState(false);

  const [error, setError] = useState("");

  // ── Steps list for progress indicator ──────────────────────────────

  const allSteps: Step[] = [
    "goals_input",
    "goals_review",
    "thoughts_input",
    "thoughts_review",
    "coaching_recap",
    "goal_journey",
    "team_vision",
    "dashboard_ready",
  ];
  const stepLabels: Record<Step, string> = {
    goals_input: "GOALS",
    goals_review: "COACHING",
    thoughts_input: "THOUGHTS",
    thoughts_review: "SYNTHESIS",
    coaching_recap: "INSIGHTS",
    goal_journey: "JOURNEY",
    team_vision: "VISION",
    dashboard_ready: "DASHBOARD",
  };

  // ── Handlers ───────────────────────────────────────────────────────

  async function handleGoalSubmit() {
    setError("");
    setGoalLoading(true);

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/strategy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawInput: goalInput }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Strategy setup failed");
      } else {
        setGoalResult(data);
        setStep("goals_review");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setGoalLoading(false);
    }
  }

  async function handleGoalRefine() {
    if (!goalResult?.canon?.id) return;
    setError("");
    setGoalRefineLoading(true);

    // Preserve previous score for comparison
    if (goalResult.healthAnalysis) {
      setPreviousGoalScore(goalResult.healthAnalysis.overallScore);
    }

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/strategy/refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canonId: goalResult.canon.id,
          feedback: goalFeedback,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Refinement failed");
      } else {
        setGoalResult(data);
        setGoalFeedback("");
        setGoalFeedbackMode("voice");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setGoalRefineLoading(false);
    }
  }

  async function handleThoughtSubmit() {
    setError("");
    setThoughtLoading(true);

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/captures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: thoughtInput,
          source: thoughtAudioUrl ? "voice" : "web",
          audioUrl: thoughtAudioUrl || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Capture failed");
      } else {
        setThoughtResult(data);
        setStep("thoughts_review");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setThoughtLoading(false);
    }
  }

  async function handleThoughtRefine() {
    if (!thoughtResult?.artifact?.id) return;
    setError("");
    setThoughtRefineLoading(true);

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/captures/refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artifactId: thoughtResult.artifact.id,
          feedback: thoughtFeedback,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Refinement failed");
      } else {
        setThoughtResult({
          artifact: data.artifact,
          iterationCount: data.iterationCount,
        });
        setThoughtFeedback("");
        setThoughtFeedbackMode("voice");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setThoughtRefineLoading(false);
    }
  }

  const handleVoiceUnsupported = useCallback(() => {
    setGoalInputMode("text");
    setGoalFeedbackMode("text");
    setThoughtInputMode("text");
    setThoughtFeedbackMode("text");
  }, []);

  // ── Digest generation: fire early, poll until ready ─────────────────
  const [digestReady, setDigestReady] = useState(false);
  const digestFiredRef = useRef(false);

  // Fire digest as soon as we leave thoughts_review
  function fireDigest() {
    if (digestFiredRef.current) return;
    digestFiredRef.current = true;
    fetch(`/api/workspaces/${workspaceId}/digest`, { method: "POST" })
      .then((res) => {
        if (res.ok) setDigestReady(true);
      })
      .catch(() => {
        // If the API call fails, still let them through
        setDigestReady(true);
      });
  }

  // Poll for digest readiness on the dashboard_ready step
  useEffect(() => {
    if (step !== "dashboard_ready" || digestReady) return;
    const interval = setInterval(async () => {
      try {
        // Check if digest exists by hitting the dashboard page's digest query
        // Simple approach: just check if enough time has passed since we fired
        // The digest API returns on completion, so if fireDigest resolved, we're good
        // If not resolved yet, keep waiting
      } catch {
        // ignore
      }
    }, 3000);
    // Fallback: after 90s, let them through anyway
    const timeout = setTimeout(() => setDigestReady(true), 90000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [step, digestReady]);

  // ── Render ─────────────────────────────────────────────────────────

  const currentStepIndex = allSteps.indexOf(step);

  return (
    <div className="mx-auto max-w-[700px] px-6 pt-16 pb-24">
      {/* Progress indicator */}
      <div className="flex items-center gap-1 mb-12">
        {allSteps.map((s, i) => {
          const isActive = i <= currentStepIndex;
          const isCurrent = i === currentStepIndex;
          return (
            <div key={s} className="flex items-center gap-1">
              {i > 0 && (
                <div className={`h-px w-6 ${isActive ? "bg-primary" : "bg-border"}`} />
              )}
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`h-2 w-2 rounded-full transition-colors ${
                    isCurrent ? "bg-primary ring-2 ring-primary/30" : isActive ? "bg-primary" : "bg-border"
                  }`}
                />
                <span className={`font-mono text-[9px] ${isActive ? "text-primary" : "text-muted/50"}`}>
                  {stepLabels[s]}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {/* ── STEP 1: Goals Input ──────────────────────────────── */}
        {step === "goals_input" && (
          <FadeIn stepKey="goals_input">
            <MonoLabel className="mb-4 block text-primary">
              WELCOME TO TENSIENT
            </MonoLabel>

            <h1 className="font-display text-3xl md:text-4xl font-bold uppercase tracking-tight mb-4">
              WHAT IS YOUR TEAM TRYING TO ACHIEVE?
            </h1>

            <p className="font-body text-base text-muted mb-8 max-w-[500px] leading-relaxed">
              Start with your goals -- even if they&apos;re rough. Say it in your own
              words. Our coaches will help you sharpen them.
            </p>

            <VoiceTextInput
              workspaceId={workspaceId}
              value={goalInput}
              onChange={setGoalInput}
              inputMode={goalInputMode}
              setInputMode={setGoalInputMode}
              onVoiceUnsupported={handleVoiceUnsupported}
              placeholder="We need to ship the mobile app by March. Our biggest risk is the payment integration. Also trying to reduce churn by 20% this quarter."
              submitLabel="SET GOALS"
              loading={goalLoading}
              onSubmit={handleGoalSubmit}
            />

            {error && (
              <p className="font-mono text-xs text-red-400 mt-4">{error}</p>
            )}
          </FadeIn>
        )}

        {/* ── STEP 2: Goals Review + Active Coaching (iteration loop) */}
        {step === "goals_review" && goalResult && (
          <FadeIn stepKey={`goals_review_${goalResult.iterationCount ?? 1}`}>
            {goalRefineLoading ? (
              <CoachProcessing label="REFINING YOUR GOALS..." />
            ) : (
              <>
                <MonoLabel className="mb-4 block text-primary">
                  {goalResult.iterationCount && goalResult.iterationCount > 1
                    ? `ROUND ${goalResult.iterationCount}`
                    : "GOAL COACHING"}
                </MonoLabel>

                {/* Goal Clarity score -- hero metric at top */}
                {goalResult.healthAnalysis && (
                  <div className="flex items-center gap-4 mb-6">
                    <MonoLabel className="text-muted">GOAL CLARITY</MonoLabel>
                    <div className="flex-1 h-3 bg-border rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-primary rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${goalResult.healthAnalysis.overallScore * 100}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      />
                    </div>
                    <span className="font-mono text-lg text-primary font-bold">
                      {previousGoalScore !== null ? (
                        <>
                          <span className="text-muted/50 line-through mr-1.5 text-sm">
                            {Math.round(previousGoalScore * 100)}%
                          </span>
                          {Math.round(goalResult.healthAnalysis.overallScore * 100)}%
                        </>
                      ) : (
                        `${Math.round(goalResult.healthAnalysis.overallScore * 100)}%`
                      )}
                    </span>
                  </div>
                )}

                {/* YOUR IMPROVED GOALS -- the hero deliverable */}
                <h1 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight mb-4">
                  YOUR IMPROVED GOALS
                </h1>

                <div className="mb-4 rounded-lg border-2 border-primary/30 bg-primary/5 px-6 py-5">
                  <div className="space-y-4">
                    {goalResult.pillars.map((pillar, i) => {
                      const pillarHealth = goalResult.healthAnalysis?.pillars[i];
                      return (
                        <div key={i} className="flex items-start gap-3">
                          <span className="font-mono text-sm text-primary font-bold mt-0.5 shrink-0 w-6 text-right">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <div className="flex-1">
                            <p className="font-body text-base text-foreground leading-relaxed font-medium">
                              {pillar}
                            </p>
                            {pillarHealth && (
                              <div className="flex items-center gap-3 mt-1.5">
                                <SmartBadgeRow smart={pillarHealth.smart} />
                                <span className="font-mono text-xs text-muted">
                                  {Math.round(pillarHealth.score * 100)}%
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* What changed and why -- secondary context below the goals */}
                {goalResult.improvementRationale && (
                  <div className="mb-6 px-1">
                    <MonoLabel className="mb-1 block text-muted">WHAT CHANGED</MonoLabel>
                    <p className="font-body text-sm text-muted leading-relaxed">
                      {goalResult.improvementRationale}
                    </p>
                  </div>
                )}

                {/* Coaching Questions (the iteration driver) */}
                {goalResult.coachingQuestions.length > 0 && (
                  <PanelCard className="mb-6">
                    <MonoLabel className="mb-3 block text-primary">
                      COACHING QUESTIONS
                    </MonoLabel>
                    <div className="space-y-3">
                      {goalResult.coachingQuestions.map((cq, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <span className="font-mono text-xs text-primary font-bold shrink-0 mt-0.5">
                            [{cq.coach}]
                          </span>
                          <p className="font-body text-sm text-foreground leading-relaxed">
                            {cq.question}
                          </p>
                        </div>
                      ))}
                    </div>
                  </PanelCard>
                )}

                {/* Iteration: Answer questions or continue */}
                <div className="border-t border-border pt-6">
                  <MonoLabel className="mb-3 block text-muted">
                    ANSWER THE QUESTIONS ABOVE TO SHARPEN YOUR GOALS
                  </MonoLabel>

                  <VoiceTextInput
                    workspaceId={workspaceId}
                    value={goalFeedback}
                    onChange={setGoalFeedback}
                    inputMode={goalFeedbackMode}
                    setInputMode={setGoalFeedbackMode}
                    onVoiceUnsupported={handleVoiceUnsupported}
                    placeholder="Answer the coaching questions here -- speak or type your response..."
                    rows={3}
                    minLength={5}
                    submitLabel="REFINE GOALS"
                    loading={false}
                    onSubmit={handleGoalRefine}
                  />

                  <div className="mt-4">
                    <SlantedButton
                      onClick={() => setStep("thoughts_input")}
                      size="lg"
                    >
                      GOALS LOOK GOOD &mdash; CONTINUE
                    </SlantedButton>
                  </div>
                </div>

                {error && (
                  <p className="font-mono text-xs text-red-400 mt-4">{error}</p>
                )}
              </>
            )}
          </FadeIn>
        )}

        {/* ── STEP 3: Thoughts Input ───────────────────────────── */}
        {step === "thoughts_input" && (
          <FadeIn stepKey="thoughts_input">
            <MonoLabel className="mb-4 block text-primary">
              NOW SHARE YOUR THOUGHTS
            </MonoLabel>

            <h1 className="font-display text-3xl md:text-4xl font-bold uppercase tracking-tight mb-4">
              WHAT&apos;S ON YOUR MIND?
            </h1>

            <p className="font-body text-base text-muted mb-8 max-w-[500px] leading-relaxed">
              Blockers, wins, frustrations -- just let it out. Talk out loud or type.
              We&apos;ll synthesize it against your goals with coaching from all {COACH_NAMES.length} lenses.
            </p>

            <VoiceTextInput
              workspaceId={workspaceId}
              value={thoughtInput}
              onChange={setThoughtInput}
              inputMode={thoughtInputMode}
              setInputMode={setThoughtInputMode}
              onVoiceUnsupported={handleVoiceUnsupported}
              onAudioUrl={setThoughtAudioUrl}
              placeholder="I'm stuck waiting on the design team for the homepage assets. Spent the morning fixing auth bugs instead. The new hire is ramping slower than expected."
              minLength={5}
              submitLabel="SUBMIT"
              loading={thoughtLoading}
              onSubmit={handleThoughtSubmit}
            />

            {error && (
              <p className="font-mono text-xs text-red-400 mt-4">{error}</p>
            )}
          </FadeIn>
        )}

        {/* ── STEP 4: Synthesis Review + Active Coaching (iteration loop) */}
        {step === "thoughts_review" && thoughtResult && (
          <FadeIn stepKey={`thoughts_review_${thoughtResult.iterationCount ?? 1}`}>
            {thoughtRefineLoading ? (
              <CoachProcessing label="REFINING YOUR SYNTHESIS..." />
            ) : (
              <>
                <MonoLabel className="mb-4 block text-primary">
                  SYNTHESIS{thoughtResult.iterationCount && thoughtResult.iterationCount > 1
                    ? ` (ROUND ${thoughtResult.iterationCount})`
                    : ""}
                </MonoLabel>

                <h1 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight mb-6">
                  YOUR COACHES WEIGHED IN
                </h1>

                {/* Scores Row */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <PanelCard>
                    <MonoLabel className="mb-2 block">ALIGNMENT</MonoLabel>
                    <span
                      className={`font-mono text-2xl font-bold ${getAlignmentColor(
                        thoughtResult.artifact.alignmentScore
                      )}`}
                    >
                      {Math.round(thoughtResult.artifact.alignmentScore * 100)}%
                    </span>
                    <p className="font-mono text-xs text-muted mt-1">
                      VS YOUR GOALS
                    </p>
                  </PanelCard>
                  <PanelCard>
                    <MonoLabel className="mb-2 block">SENTIMENT</MonoLabel>
                    <span
                      className={`font-mono text-2xl font-bold ${getSentimentColor(
                        thoughtResult.artifact.sentimentScore
                      )}`}
                    >
                      {getSentimentLabel(thoughtResult.artifact.sentimentScore)}
                    </span>
                    <p className="font-mono text-xs text-muted mt-1">
                      {thoughtResult.artifact.sentimentScore.toFixed(2)}
                    </p>
                  </PanelCard>
                </div>

                {/* Alignment Explanation */}
                {thoughtResult.artifact.alignmentExplanation && (
                  <div className="mb-4 rounded-lg border border-border bg-panel/50 px-5 py-3">
                    <MonoLabel className="mb-1.5 block text-muted">WHY THIS SCORE</MonoLabel>
                    <p className="font-body text-sm text-foreground leading-relaxed">
                      {thoughtResult.artifact.alignmentExplanation}
                    </p>
                  </div>
                )}

                {/* Synthesized Update */}
                <PanelCard className="mb-4">
                  <MonoLabel className="mb-3 block text-primary">
                    SYNTHESIZED UPDATE
                  </MonoLabel>
                  <p className="font-body text-base leading-relaxed text-foreground">
                    {thoughtResult.artifact.content}
                  </p>
                </PanelCard>

                {/* Brief coaching note */}
                {thoughtResult.artifact.feedback && (
                  <div className="mb-4 px-1">
                    <p className="font-body text-sm text-muted leading-relaxed italic">
                      {thoughtResult.artifact.feedback}
                    </p>
                  </div>
                )}

                {/* Coaching Questions (the iteration driver) */}
                {thoughtResult.artifact.coachingQuestions &&
                  thoughtResult.artifact.coachingQuestions.length > 0 && (
                  <PanelCard className="mb-6">
                    <MonoLabel className="mb-3 block text-primary">
                      COACHING QUESTIONS
                    </MonoLabel>
                    <div className="space-y-3">
                      {thoughtResult.artifact.coachingQuestions.map((cq, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <span className="font-mono text-xs text-primary font-bold shrink-0 mt-0.5">
                            [{cq.coach}]
                          </span>
                          <p className="font-body text-sm text-foreground leading-relaxed">
                            {cq.question}
                          </p>
                        </div>
                      ))}
                    </div>
                  </PanelCard>
                )}

                {/* Iteration: Answer questions or continue */}
                <div className="border-t border-border pt-6">
                  <MonoLabel className="mb-3 block text-muted">
                    ANSWER THE QUESTIONS ABOVE TO IMPROVE YOUR SYNTHESIS
                  </MonoLabel>

                  <VoiceTextInput
                    workspaceId={workspaceId}
                    value={thoughtFeedback}
                    onChange={setThoughtFeedback}
                    inputMode={thoughtFeedbackMode}
                    setInputMode={setThoughtFeedbackMode}
                    onVoiceUnsupported={handleVoiceUnsupported}
                    placeholder="Answer the coaching questions here -- speak or type your response..."
                    rows={3}
                    minLength={5}
                    submitLabel="REFINE SYNTHESIS"
                    loading={false}
                    onSubmit={handleThoughtRefine}
                  />

                  <div className="mt-4">
                    <SlantedButton
                      onClick={() => {
                        fireDigest();
                        setStep("coaching_recap");
                      }}
                      size="lg"
                    >
                      NEXT
                    </SlantedButton>
                  </div>
                </div>

                {error && (
                  <p className="font-mono text-xs text-red-400 mt-4">{error}</p>
                )}
              </>
            )}
          </FadeIn>
        )}

        {/* ── STEP 5: Coaching Recap (delight) ─────────────────── */}
        {step === "coaching_recap" && thoughtResult && (
          <FadeIn stepKey="coaching_recap">
            <MonoLabel className="mb-4 block text-primary">
              INSIGHTS
            </MonoLabel>

            <GlitchText
              text="WHAT YOUR COACHES SAW"
              as="h1"
              className="text-2xl md:text-3xl mb-4"
            />

            <p className="font-body text-base text-muted mb-6 max-w-[500px] leading-relaxed">
              Your {COACH_NAMES.length} coaching lenses worked together to surface these insights
              from your thoughts.
            </p>

            {/* Alignment explanation */}
            {thoughtResult.artifact.alignmentExplanation && (
              <PanelCard className="mb-4">
                <MonoLabel className="mb-2 block text-primary">ALIGNMENT</MonoLabel>
                <div className="flex items-center gap-3 mb-2">
                  <span
                    className={`font-mono text-lg font-bold ${getAlignmentColor(
                      thoughtResult.artifact.alignmentScore
                    )}`}
                  >
                    {Math.round(thoughtResult.artifact.alignmentScore * 100)}%
                  </span>
                  <span className="font-mono text-xs text-muted">
                    against your {goalResult?.pillars.length ?? 0} goals
                  </span>
                </div>
                <p className="font-body text-sm text-muted leading-relaxed">
                  {thoughtResult.artifact.alignmentExplanation}
                </p>
              </PanelCard>
            )}

            {/* Coaching questions */}
            {thoughtResult.artifact.coachingQuestions.length > 0 && (
              <div className="space-y-3 mb-8">
                {thoughtResult.artifact.coachingQuestions.slice(0, 4).map((cq, i) => (
                  <PanelCard key={i}>
                    <p className="font-mono text-xs text-primary mb-1">{cq.coach}</p>
                    <p className="font-body text-sm text-foreground leading-relaxed">
                      {cq.question}
                    </p>
                  </PanelCard>
                ))}
              </div>
            )}

            <div className="rounded-lg border border-primary/20 bg-primary/5 px-5 py-3 mb-6">
              <p className="font-mono text-xs text-primary">
                Your Top 5 priorities are being synthesized in the background...
              </p>
            </div>

            <SlantedButton
              onClick={() => setStep("goal_journey")}
              size="lg"
            >
              NEXT
            </SlantedButton>
          </FadeIn>
        )}

        {/* ── STEP 6: Goal Clarity Journey (delight) ──────────── */}
        {step === "goal_journey" && goalResult && (
          <FadeIn stepKey="goal_journey">
            <MonoLabel className="mb-4 block text-primary">
              YOUR JOURNEY
            </MonoLabel>

            <GlitchText
              text="YOUR GOAL CLARITY JOURNEY"
              as="h1"
              className="text-2xl md:text-3xl mb-4"
            />

            <p className="font-body text-base text-muted mb-6 max-w-[500px] leading-relaxed">
              You started with raw goals. Your coaches helped refine them.
              Here&apos;s how far you came.
            </p>

            {/* SMART score */}
            {goalResult.healthAnalysis && (
              <PanelCard className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <MonoLabel className="text-primary">GOAL CLARITY SCORE</MonoLabel>
                  <span className="font-mono text-2xl font-bold text-primary">
                    {Math.round(goalResult.healthAnalysis.overallScore * 100)}%
                  </span>
                </div>
                <div className="h-2 bg-border rounded-full overflow-hidden mb-3">
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{
                      width: `${goalResult.healthAnalysis.overallScore * 100}%`,
                    }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                </div>
                <p className="font-body text-xs text-muted">
                  Based on SMART analysis across {goalResult.pillars.length} pillars
                </p>
              </PanelCard>
            )}

            {/* Refined goals */}
            <PanelCard className="mb-8">
              <MonoLabel className="mb-3 block text-primary">YOUR REFINED GOALS</MonoLabel>
              <div className="space-y-2">
                {goalResult.pillars.map((pillar, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="font-mono text-sm text-primary font-bold mt-0.5 shrink-0 w-5 text-right">
                      {i + 1}
                    </span>
                    <p className="font-body text-sm text-foreground leading-relaxed">
                      {pillar}
                    </p>
                  </div>
                ))}
              </div>
            </PanelCard>

            <SlantedButton
              onClick={() => setStep("team_vision")}
              size="lg"
            >
              NEXT
            </SlantedButton>
          </FadeIn>
        )}

        {/* ── STEP 7: Team Vision ─────────────────────────────── */}
        {step === "team_vision" && (
          <FadeIn stepKey="team_vision">
            <MonoLabel className="mb-4 block text-primary">
              THE BIGGER PICTURE
            </MonoLabel>

            <GlitchText
              text="NOW IMAGINE YOUR WHOLE TEAM"
              as="h1"
              className="text-2xl md:text-3xl mb-4"
            />

            <p className="font-body text-base text-muted mb-8 max-w-[500px] leading-relaxed">
              You just went through this as one person. When your whole team
              uses Tensient daily, the dashboard becomes a living command center
              -- Top 5 priorities, coaching, and alignment, all synthesized
              automatically.
            </p>

            <PanelCard className="mb-4">
              <MonoLabel className="mb-3 block text-primary">
                WHAT YOU JUST CREATED
              </MonoLabel>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <span className="font-mono text-2xl font-bold text-foreground">
                    {goalResult?.pillars.length ?? 0}
                  </span>
                  <p className="font-mono text-xs text-muted mt-1">GOALS</p>
                </div>
                <div>
                  <span className="font-mono text-2xl font-bold text-foreground">1</span>
                  <p className="font-mono text-xs text-muted mt-1">SYNTHESIS</p>
                </div>
              </div>
            </PanelCard>

            <PanelCard className="mb-8">
              <MonoLabel className="mb-3 block">
                WITH YOUR FULL TEAM
              </MonoLabel>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-primary">01</span>
                  <p className="font-body text-sm text-foreground">
                    Every team member shares their thoughts daily -- by voice or text
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-primary">02</span>
                  <p className="font-body text-sm text-foreground">
                    {COACH_NAMES.length} coaches synthesize across the team, surfacing patterns you can&apos;t see in Slack
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-primary">03</span>
                  <p className="font-body text-sm text-foreground">
                    Your Top 5 priorities are recomputed constantly -- a living executive briefing
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-primary">04</span>
                  <p className="font-body text-sm text-foreground">
                    Alignment drift is measured in real time -- not once a quarter
                  </p>
                </div>
              </div>
            </PanelCard>

            <SlantedButton
              onClick={() => setStep("dashboard_ready")}
              size="lg"
            >
              NEXT
            </SlantedButton>
          </FadeIn>
        )}

        {/* ── STEP 8: Dashboard Ready (gated) ─────────────────── */}
        {step === "dashboard_ready" && (
          <FadeIn stepKey="dashboard_ready">
            <MonoLabel className="mb-4 block text-primary">
              YOUR DASHBOARD
            </MonoLabel>

            {digestReady ? (
              <>
                <GlitchText
                  text="YOUR TOP 5 IS READY"
                  as="h1"
                  className="text-2xl md:text-3xl mb-4"
                />

                <p className="font-body text-base text-muted mb-8 max-w-[500px] leading-relaxed">
                  Your goals, thoughts, and coaching have been synthesized into
                  your first Top 5 priorities. See them on your dashboard.
                </p>

                <SlantedButton
                  href={`/dashboard/${workspaceId}`}
                  size="lg"
                >
                  GO TO DASHBOARD
                </SlantedButton>
              </>
            ) : (
              <>
                <GlitchText
                  text="PUTTING THE FINISHING TOUCHES"
                  as="h1"
                  className="text-2xl md:text-3xl mb-4"
                />

                <p className="font-body text-base text-muted mb-8 max-w-[500px] leading-relaxed">
                  Your Top 5 priorities are being synthesized from everything
                  you shared. Almost there...
                </p>

                {/* Subtle pulsing indicator */}
                <div className="flex items-center gap-3 mb-8">
                  <motion.div
                    className="h-3 w-3 rounded-full bg-primary"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  <span className="font-mono text-xs text-muted">
                    Synthesizing your Top 5...
                  </span>
                </div>
              </>
            )}
          </FadeIn>
        )}
      </AnimatePresence>
    </div>
  );
}
