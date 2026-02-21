"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { upload } from "@vercel/blob/client";
import { useAudioCapture, RecordingResult } from "@/hooks/use-audio-capture";

// ── Types ──────────────────────────────────────────────────────────────

interface VoiceRecorderProps {
  workspaceId: string;
  onTranscription: (text: string, audioUrl: string) => void;
  onError?: (error: string, audioUrl?: string) => void;
  onUnsupported?: () => void;
  className?: string;
  autoStart?: boolean;
}

type RecorderState =
  | "idle"
  | "recording"
  | "paused"
  | "uploading"
  | "audio_saved"
  | "transcribing"
  | "denied"
  | "unsupported";

// ── Constants ──────────────────────────────────────────────────────────

const BAR_COUNT = 48;
const MIN_BAR_HEIGHT = 4;
const MAX_BAR_HEIGHT = 120;

// ── Duration formatter ─────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

// ── Component ──────────────────────────────────────────────────────────

export function VoiceRecorder({
  workspaceId,
  onTranscription,
  onError,
  onUnsupported,
  className = "",
  autoStart = false,
}: VoiceRecorderProps) {
  const {
    frequencies,
    isRecording,
    isPaused,
    durationMs,
    error: captureError,
    startCapture,
    pauseCapture,
    resumeCapture,
    stopCapture,
  } = useAudioCapture();

  const [state, setState] = useState<RecorderState>("idle");
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [savedAudioUrl, setSavedAudioUrl] = useState<string | null>(null);

  // Idle breathing animation phase
  const phaseRef = useRef(0);
  const [idleBars, setIdleBars] = useState<number[]>(
    () => new Array(BAR_COUNT).fill(0)
  );
  const idleAnimRef = useRef<number | null>(null);
  const autoStartTriggeredRef = useRef(false);

  // ── Detect support + permission state on mount ─────────────────────

  useEffect(() => {
    // Check if getUserMedia is available at all
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setState("unsupported");
      onUnsupported?.();
      return;
    }

    // Check if permission was previously denied (Chrome/Firefox)
    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "microphone" as PermissionName })
        .then((result) => {
          if (result.state === "denied") {
            setState("denied");
          }
        })
        .catch(() => {
          // permissions.query not supported for microphone (Safari) -- ignore
        });
    }
  }, [onUnsupported]);

  // ── Idle breathing animation ───────────────────────────────────────

  useEffect(() => {
    if (
      isRecording ||
      state === "uploading" ||
      state === "audio_saved" ||
      state === "transcribing" ||
      state === "unsupported" ||
      state === "denied"
    ) {
      if (idleAnimRef.current !== null) {
        cancelAnimationFrame(idleAnimRef.current);
        idleAnimRef.current = null;
      }
      return;
    }

    function breathe() {
      phaseRef.current += 0.02;
      const bars = new Array(BAR_COUNT);
      for (let i = 0; i < BAR_COUNT; i++) {
        const phaseOffset = (i / BAR_COUNT) * Math.PI * 2;
        const breath = Math.sin(phaseRef.current + phaseOffset);
        bars[i] = (breath * 0.5 + 0.5) * 0.15;
      }
      setIdleBars(bars);
      idleAnimRef.current = requestAnimationFrame(breathe);
    }

    idleAnimRef.current = requestAnimationFrame(breathe);
    return () => {
      if (idleAnimRef.current !== null) {
        cancelAnimationFrame(idleAnimRef.current);
      }
    };
  }, [isRecording, state]);

  // ── Pick which bar levels to show ──────────────────────────────────

  const activeBars = isRecording ? frequencies : idleBars;

  // ── Handlers ───────────────────────────────────────────────────────

  // One-tap start: requests permission + starts recording in one action
  const handleTapToRecord = useCallback(async () => {
    setProcessingError(null);
    try {
      await startCapture();
      setState("recording");
    } catch {
      // startCapture sets its own error via the hook, but we also catch
      // permission denial here to update our state
      if (captureError?.includes("denied")) {
        setState("denied");
      }
    }
  }, [startCapture, captureError]);

  // Watch for permission denial from the hook
  useEffect(() => {
    if (captureError?.includes("denied")) {
      setState("denied");
    }
  }, [captureError]);

  useEffect(() => {
    if (!autoStart || state !== "idle" || autoStartTriggeredRef.current) return;
    autoStartTriggeredRef.current = true;
    void handleTapToRecord();
  }, [autoStart, state, handleTapToRecord]);

  const handlePause = useCallback(() => {
    pauseCapture();
    setState("paused");
  }, [pauseCapture]);

  const handleResume = useCallback(() => {
    resumeCapture();
    setState("recording");
  }, [resumeCapture]);

  const handleStop = useCallback(async () => {
    setProcessingError(null);
    const result: RecordingResult | null = await stopCapture();
    if (!result) {
      setState("idle");
      return;
    }

    // ── Step 1: Upload directly to Vercel Blob (no size limit) ──────

    setState("uploading");

    let audioUrl: string;

    try {
      const filename = `audio/${workspaceId}/capture-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`;

      const blobResult = await upload(filename, result.blob, {
        access: "public",
        handleUploadUrl: "/api/transcribe/upload",
      });

      audioUrl = blobResult.url;
    } catch (uploadErr) {
      const errMsg = uploadErr instanceof Error ? uploadErr.message : "Upload failed";
      setProcessingError(`Upload failed. ${errMsg}`);
      onError?.("Upload failed");
      setState("idle");
      return;
    }

    // ── Step 1.5: Show "Audio saved" confirmation briefly ──────────

    setSavedAudioUrl(audioUrl);
    setState("audio_saved");
    await new Promise((resolve) => setTimeout(resolve, 1200));

    // ── Step 2: Transcribe via API (sends only the URL, not the file) ──

    await transcribeAudio(audioUrl);
  }, [stopCapture, workspaceId, onTranscription, onError]);

  const transcribeAudio = useCallback(async (audioUrl: string) => {
    setState("transcribing");
    setProcessingError(null);

    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioUrl, workspaceId }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errMsg = data.error || `Server error (${res.status}). Please try again.`;
        setProcessingError(errMsg);
        onError?.(errMsg, audioUrl);
        setState("idle");
        return;
      }

      if (data.text) {
        onTranscription(data.text, audioUrl);
        setSavedAudioUrl(null);
        setState("idle");
      } else {
        const errMsg = data.error || "Transcription failed";
        setProcessingError(
          `Audio is safe. ${errMsg}`
        );
        onError?.(errMsg, audioUrl);
        setState("idle");
      }
    } catch {
      // Audio is already saved in Blob -- transcription just failed
      setProcessingError("Audio is safe. Transcription failed.");
      onError?.("Transcription failed", audioUrl);
      setState("idle");
    }
  }, [workspaceId, onTranscription, onError]);

  // ── Render: unsupported state ──────────────────────────────────────

  if (state === "unsupported") {
    return null; // Parent handles fallback via onUnsupported
  }

  // ── Render: denied state ───────────────────────────────────────────

  if (state === "denied") {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-panel px-6 py-10 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-destructive/30 bg-destructive/10">
            <MicOffIcon />
          </div>
          <p className="font-display text-lg font-bold uppercase tracking-tight mb-2">
            Microphone blocked
          </p>
          <p className="font-body text-sm text-muted max-w-[360px] mb-4 leading-relaxed">
            To use voice input, allow microphone access in your browser
            settings. Look for the lock or camera icon in your address bar.
          </p>
          <button
            onClick={() => {
              setState("idle");
              handleTapToRecord();
            }}
            className="font-mono text-xs text-primary underline underline-offset-4 cursor-pointer hover:text-primary/80"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // ── Render: main component ─────────────────────────────────────────

  const isProcessing = state === "uploading" || state === "audio_saved" || state === "transcribing";

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Waveform + mic button area */}
      <div className="relative flex items-end justify-center gap-[3px] rounded-xl border border-border bg-panel px-4 py-4 h-40 overflow-hidden">
        {/* Waveform bars */}
        {activeBars.map((level, i) => {
          const boosted = isRecording ? 0.08 + level * 0.92 : level;
          const height =
            MIN_BAR_HEIGHT + boosted * (MAX_BAR_HEIGHT - MIN_BAR_HEIGHT);

          return (
            <motion.div
              key={i}
              animate={{ height }}
              transition={{
                type: "spring",
                damping: 18,
                stiffness: 350,
                mass: 0.25,
              }}
              className="rounded-full"
              style={{
                width: `calc((100% - ${(BAR_COUNT - 1) * 3}px) / ${BAR_COUNT})`,
                minWidth: 2,
                maxWidth: 6,
                backgroundColor: isRecording
                  ? `rgba(204, 255, 0, ${0.4 + level * 0.6})`
                  : "rgba(204, 255, 0, 0.15)",
              }}
            />
          );
        })}

        {/* Big mic button overlay (idle state) */}
        <AnimatePresence>
          {state === "idle" && !isProcessing && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              onClick={handleTapToRecord}
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 cursor-pointer bg-panel/80 backdrop-blur-sm rounded-xl hover:bg-panel/70 transition-colors"
            >
              <motion.div
                className="flex h-20 w-20 items-center justify-center rounded-full bg-primary"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <MicIcon size={32} />
              </motion.div>
              <span className="font-display text-sm font-bold uppercase tracking-widest text-muted">
                Tap to start talking
              </span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Processing overlay */}
        <AnimatePresence>
          {isProcessing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-panel/90 backdrop-blur-sm rounded-xl"
            >
              {state === "uploading" && (
                <>
                  <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
                  <span className="font-mono text-xs text-muted uppercase tracking-wider">
                    Saving audio...
                  </span>
                </>
              )}
              {state === "audio_saved" && (
                <>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-success">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  <span className="font-mono text-xs text-success uppercase tracking-wider">
                    Audio saved
                  </span>
                </>
              )}
              {state === "transcribing" && (
                <>
                  <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
                  <span className="font-mono text-xs text-muted uppercase tracking-wider">
                    Transcribing...
                  </span>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Duration + status (only during recording) */}
      {(state === "recording" || state === "paused") && (
        <div className="flex items-center justify-between">
          <span className="font-mono text-sm text-foreground tabular-nums">
            {formatDuration(durationMs)}
          </span>
          <span className="font-mono text-xs uppercase tracking-wider">
            {state === "recording" && (
              <span className="text-primary flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                Recording
              </span>
            )}
            {state === "paused" && (
              <span className="text-muted">Paused</span>
            )}
          </span>
        </div>
      )}

      {/* Controls (only during recording/paused) */}
      {(state === "recording" || state === "paused") && (
        <div className="flex items-center justify-center gap-3">
          {state === "recording" && (
            <button
              onClick={handlePause}
              className="flex items-center gap-2 h-12 px-6 rounded-lg border-2 border-border text-muted font-display font-bold text-sm uppercase tracking-wider cursor-pointer hover:border-primary hover:text-primary transition-all"
            >
              <PauseIcon />
              Pause
            </button>
          )}
          {state === "paused" && (
            <button
              onClick={handleResume}
              className="flex items-center gap-2 h-12 px-6 rounded-lg border-2 border-primary text-primary font-display font-bold text-sm uppercase tracking-wider cursor-pointer hover:bg-primary/10 transition-all"
            >
              <MicIcon size={16} />
              Resume
            </button>
          )}
          <button
            onClick={handleStop}
            className="flex items-center gap-2 h-12 px-8 rounded-lg bg-primary text-primary-foreground font-display font-bold text-sm uppercase tracking-wider cursor-pointer hover:brightness-110 transition-all"
          >
            <StopIcon />
            Done
          </button>
        </div>
      )}

      {/* Assurance text (idle state) */}
      {state === "idle" && !processingError && (
        <p className="font-body text-xs text-muted text-center leading-relaxed">
          Super accurate transcription. Ramble as long as you want.
        </p>
      )}

      {/* Error display */}
      {(captureError || processingError) && (
        <div className="text-center space-y-2">
          <p className="font-mono text-xs text-destructive">
            {captureError || processingError}
          </p>
          {savedAudioUrl && processingError && (
            <button
              onClick={() => transcribeAudio(savedAudioUrl)}
              className="font-mono text-xs text-primary underline underline-offset-4 cursor-pointer hover:text-primary/80"
            >
              Retry transcription
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────

function MicIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-destructive"
    >
      <line x1="2" x2="22" y1="2" y2="22" />
      <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
      <path d="M5 10v2a7 7 0 0 0 12 5" />
      <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  );
}
