"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { GlitchText } from "@/components/glitch-text";
import { SlantedButton } from "@/components/slanted-button";
import { MonoLabel } from "@/components/mono-label";
import { motion, AnimatePresence } from "framer-motion";
import { VoiceRecorder } from "@/components/voice-recorder";

// ── Types ──────────────────────────────────────────────────────────────

type Step = "goals_input" | "thoughts_input" | "team_vision";

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
  const [voiceError, setVoiceError] = useState<string | null>(null);

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
              setVoiceError(null);
              onChange(text);
              if (url && onAudioUrl) onAudioUrl(url);
              setInputMode("text");
            }}
            onError={(errMsg, url) => {
              if (url && onAudioUrl) onAudioUrl(url);
              setVoiceError(errMsg);
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
          {voiceError && (
            <p className="font-mono text-xs text-destructive mb-4">
              {voiceError} -- you can type manually or try again.
            </p>
          )}

          <textarea
            value={value}
            onChange={(e) => {
              if (voiceError) setVoiceError(null);
              onChange(e.target.value);
            }}
            rows={rows}
            className="w-full rounded-lg border border-border bg-panel px-6 py-4 font-body text-base text-foreground leading-relaxed placeholder:text-muted/50 focus:border-primary focus:outline-none resize-none mb-4"
            placeholder={placeholder}
          />

          {!value && !voiceError && (
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

// ── Main Component ────────────────────────────────────────────────────

export default function WelcomePage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.workspaceId as string;

  const [step, setStep] = useState<Step>("goals_input");

  // Goal state
  const [goalInput, setGoalInput] = useState("");
  const [goalInputMode, setGoalInputMode] = useState<"voice" | "text">("voice");
  const [goalLoading, setGoalLoading] = useState(false);

  // Thought state
  const [thoughtInput, setThoughtInput] = useState("");
  const [thoughtInputMode, setThoughtInputMode] = useState<"voice" | "text">("voice");
  const [thoughtAudioUrl, setThoughtAudioUrl] = useState<string | null>(null);
  const [thoughtLoading, setThoughtLoading] = useState(false);

  const [error, setError] = useState("");

  // ── Steps list for progress indicator ──────────────────────────────

  const allSteps: Step[] = ["goals_input", "thoughts_input", "team_vision"];
  const stepLabels: Record<Step, string> = {
    goals_input: "GOALS",
    thoughts_input: "THOUGHTS",
    team_vision: "GO",
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
        // Strategy succeeded -- canon now exists, safe to proceed
        setStep("thoughts_input");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setGoalLoading(false);
    }
  }

  function handleThoughtSubmit() {
    setError("");
    setThoughtLoading(true);

    // Fire captures API in the background (don't await)
    fetch(`/api/workspaces/${workspaceId}/captures`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: thoughtInput,
        source: thoughtAudioUrl ? "voice" : "web",
        audioUrl: thoughtAudioUrl || undefined,
      }),
    })
      .then((res) => {
        if (res.ok) {
          // Fire digest API after captures succeed (don't await)
          fetch(`/api/workspaces/${workspaceId}/digest`, { method: "POST" }).catch(
            () => {}
          );
        }
      })
      .catch(() => {});

    // Immediately advance -- don't wait for either API
    setThoughtLoading(false);
    setStep("team_vision");
  }

  const handleVoiceUnsupported = useCallback(() => {
    setGoalInputMode("text");
    setThoughtInputMode("text");
  }, []);

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

        {/* ── STEP 2: Thoughts Input ───────────────────────────── */}
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
              We&apos;ll synthesize it against your goals.
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

        {/* ── STEP 3: Team Vision → GO TO DASHBOARD ────────────── */}
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

            <div className="rounded-lg border border-primary/20 bg-primary/5 px-5 py-3 mb-8">
              <p className="font-mono text-xs text-primary">
                Your goals and Top 5 priorities are being synthesized in the background...
              </p>
            </div>

            <SlantedButton
              onClick={() => router.push(`/dashboard/${workspaceId}`)}
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
