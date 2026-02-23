import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getGroq } from "@/lib/groq";
import { checkUsageAllowed, logUsage } from "@/lib/usage-guard";
import { logger } from "@/lib/logger";
import { trackEvent } from "@/lib/platform-events";

// Allow up to 60s for long audio transcriptions
export const maxDuration = 60;

export async function POST(request: Request) {
  // ── Env validation (fail fast with clear logs) ────────────────────

  if (!process.env.GROQ_API_KEY) {
    logger.error("GROQ_API_KEY is not configured -- transcription will fail");
    return NextResponse.json(
      { error: "Transcription is temporarily unavailable.", text: null, audioUrl: null },
      { status: 503 }
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Usage guard
  const usageCheck = await checkUsageAllowed(session.user.id);
  if (!usageCheck.allowed) {
    trackEvent("usage_blocked", {
      userId: session.user.id,
      metadata: { operation: "transcribe", reason: usageCheck.reason },
    });
    return NextResponse.json(
      { error: usageCheck.reason },
      { status: 429 }
    );
  }

  // ── Parse JSON body (audioUrl already uploaded via client-side Blob) ──

  let audioUrl: string;
  let workspaceId: string;

  try {
    const body = await request.json();
    audioUrl = body.audioUrl;
    workspaceId = body.workspaceId;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  if (!audioUrl || typeof audioUrl !== "string") {
    return NextResponse.json(
      { error: "No audioUrl provided" },
      { status: 400 }
    );
  }

  if (!workspaceId || typeof workspaceId !== "string") {
    return NextResponse.json(
      { error: "No workspaceId provided" },
      { status: 400 }
    );
  }

  trackEvent("transcription_started", {
    userId: session.user.id,
    workspaceId,
    metadata: { audioUrl },
  });

  // ── Fetch audio from Blob URL ─────────────────────────────────────

  let audioBuffer: ArrayBuffer;
  let contentType: string;

  try {
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      logger.error("Failed to fetch audio from Blob URL", {
        url: audioUrl,
        status: audioResponse.status,
      });
      return NextResponse.json(
        { error: "Failed to retrieve audio file.", text: null, audioUrl },
        { status: 500 }
      );
    }
    audioBuffer = await audioResponse.arrayBuffer();
    contentType = audioResponse.headers.get("content-type") || "audio/webm;codecs=opus";
  } catch (fetchError) {
    logger.error("Audio fetch failed", { error: String(fetchError), url: audioUrl });
    return NextResponse.json(
      { error: "Failed to retrieve audio file.", text: null, audioUrl },
      { status: 500 }
    );
  }

  // ── Transcribe with Groq Whisper ──────────────────────────────────

  let text: string | null = null;

  try {
    const groqFile = new File(
      [audioBuffer],
      "audio.webm",
      { type: contentType }
    );

    const transcription = await getGroq().audio.transcriptions.create({
      file: groqFile,
      model: "whisper-large-v3-turbo",
      language: "en",
      response_format: "text",
    });

    // Groq returns the text directly when response_format is "text"
    text = typeof transcription === "string"
      ? transcription
      : (transcription as { text?: string }).text || null;

    if (text) {
      text = text.trim();
    }
  } catch (transcribeError) {
    logger.error("Transcription failed (audio is safe in Blob)", {
      error: String(transcribeError),
      audioUrl,
    });
    trackEvent("transcription_failed", {
      userId: session.user.id,
      workspaceId,
      metadata: { error: String(transcribeError), audioUrl },
    });
    // Don't fail the request -- audio is already saved in Blob
  }

  // ── Log usage ─────────────────────────────────────────────────────

  try {
    await logUsage({
      userId: session.user.id,
      workspaceId,
      operation: "transcribe",
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostCents: 1,
    });
  } catch {
    // Non-critical, don't fail the request
  }

  // ── Response ──────────────────────────────────────────────────────

  if (text) {
    trackEvent("transcription_completed", {
      userId: session.user.id,
      workspaceId,
      metadata: { audioUrl, textLength: text.length },
    });
    return NextResponse.json({ text, audioUrl });
  } else {
    return NextResponse.json({
      text: null,
      audioUrl,
      error: "Transcription failed. Your audio has been saved.",
    });
  }
}
