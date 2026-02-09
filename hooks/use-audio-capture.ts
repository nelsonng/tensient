"use client";

import { useState, useRef, useCallback, useEffect } from "react";

// ── Types ──────────────────────────────────────────────────────────────

export interface RecordingResult {
  blob: Blob;
  durationMs: number;
  fileSize: number;
}

export interface UseAudioCapture {
  // State
  frequencies: number[];
  isRecording: boolean;
  isPaused: boolean;
  durationMs: number;
  error: string | null;

  // Actions
  startCapture: () => Promise<void>;
  pauseCapture: () => void;
  resumeCapture: () => void;
  stopCapture: () => Promise<RecordingResult | null>;
}

// ── Constants ──────────────────────────────────────────────────────────

const BAND_COUNT = 48;
const FFT_SIZE = 4096;
const DURATION_INTERVAL_MS = 100;

// ── Hook ───────────────────────────────────────────────────────────────

export function useAudioCapture(): UseAudioCapture {
  const [frequencies, setFrequencies] = useState<number[]>(
    () => new Array(BAND_COUNT).fill(0)
  );
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Refs for audio pipeline
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Duration tracking refs
  const accumulatedRef = useRef(0);
  const segmentStartRef = useRef(0);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );

  // ── Cleanup ────────────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (durationIntervalRef.current !== null) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    recorderRef.current = null;
    chunksRef.current = [];
    accumulatedRef.current = 0;
    segmentStartRef.current = 0;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // ── FFT animation loop ─────────────────────────────────────────────

  const startFFTLoop = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const binsPerBand = Math.floor(dataArray.length / BAND_COUNT);

    function tick() {
      if (!analyserRef.current) return;
      analyserRef.current.getByteFrequencyData(dataArray);

      const bands = new Array(BAND_COUNT);
      for (let i = 0; i < BAND_COUNT; i++) {
        let sum = 0;
        for (let j = 0; j < binsPerBand; j++) {
          sum += dataArray[i * binsPerBand + j];
        }
        const raw = sum / binsPerBand / 255;
        // Exponential curve for visual impact (from reference doc)
        bands[i] = Math.pow(raw, 0.6);
      }

      setFrequencies(bands);
      animFrameRef.current = requestAnimationFrame(tick);
    }

    animFrameRef.current = requestAnimationFrame(tick);
  }, []);

  // ── Duration tracking ──────────────────────────────────────────────

  const startDurationTracking = useCallback(() => {
    segmentStartRef.current = Date.now();
    durationIntervalRef.current = setInterval(() => {
      setDurationMs(
        accumulatedRef.current + (Date.now() - segmentStartRef.current)
      );
    }, DURATION_INTERVAL_MS);
  }, []);

  const stopDurationTracking = useCallback(() => {
    if (durationIntervalRef.current !== null) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  // ── Start ──────────────────────────────────────────────────────────

  const startCapture = useCallback(async () => {
    setError(null);
    cleanup();
    setDurationMs(0);
    setFrequencies(new Array(BAND_COUNT).fill(0));

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      // Set up AudioContext + AnalyserNode for FFT
      const audioContext = new AudioContext({ sampleRate: 44100 });
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;

      // Set up MediaRecorder for file capture
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000,
      });

      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorderRef.current = recorder;
      recorder.start(1000); // Collect chunks every second

      setIsRecording(true);
      setIsPaused(false);

      // Start FFT visualization + duration timer
      startFFTLoop();
      startDurationTracking();
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setError("Microphone access denied. Please allow microphone access and try again.");
      } else if (err instanceof DOMException && err.name === "NotFoundError") {
        setError("No microphone found. Please connect a microphone and try again.");
      } else {
        setError("Could not start recording. Please try again.");
      }
      cleanup();
    }
  }, [cleanup, startFFTLoop, startDurationTracking]);

  // ── Pause ──────────────────────────────────────────────────────────

  const pauseCapture = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") return;

    recorder.pause();
    accumulatedRef.current += Date.now() - segmentStartRef.current;
    stopDurationTracking();

    // Stop FFT animation (freeze bars)
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    setIsPaused(true);
  }, [stopDurationTracking]);

  // ── Resume ─────────────────────────────────────────────────────────

  const resumeCapture = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "paused") return;

    recorder.resume();
    setIsPaused(false);

    startFFTLoop();
    startDurationTracking();
  }, [startFFTLoop, startDurationTracking]);

  // ── Stop ───────────────────────────────────────────────────────────

  const stopCapture = useCallback((): Promise<RecordingResult | null> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        cleanup();
        setIsRecording(false);
        setIsPaused(false);
        resolve(null);
        return;
      }

      // Accumulate final segment duration
      if (!isPaused) {
        accumulatedRef.current += Date.now() - segmentStartRef.current;
      }
      const finalDuration = accumulatedRef.current;

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm;codecs=opus";
        const blob = new Blob(chunksRef.current, { type: mimeType });

        // Stop FFT and duration tracking
        if (animFrameRef.current !== null) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = null;
        }
        stopDurationTracking();

        // Zero out frequencies
        setFrequencies(new Array(BAND_COUNT).fill(0));
        setIsRecording(false);
        setIsPaused(false);
        setDurationMs(finalDuration);

        // Release mic and audio context
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        if (sourceRef.current) {
          sourceRef.current.disconnect();
          sourceRef.current = null;
        }
        if (analyserRef.current) {
          analyserRef.current.disconnect();
          analyserRef.current = null;
        }
        if (
          audioContextRef.current &&
          audioContextRef.current.state !== "closed"
        ) {
          audioContextRef.current.close().catch(() => {});
          audioContextRef.current = null;
        }

        resolve({
          blob,
          durationMs: finalDuration,
          fileSize: blob.size,
        });
      };

      recorder.stop();
    });
  }, [isPaused, stopDurationTracking, cleanup]);

  return {
    frequencies,
    isRecording,
    isPaused,
    durationMs,
    error,
    startCapture,
    pauseCapture,
    resumeCapture,
    stopCapture,
  };
}
