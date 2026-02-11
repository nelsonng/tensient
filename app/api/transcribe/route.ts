import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { put } from "@vercel/blob";
import { getGroq } from "@/lib/groq";
import { checkUsageAllowed, logUsage } from "@/lib/usage-guard";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  // ── Env validation (fail fast with clear logs) ────────────────────

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    logger.error("BLOB_READ_WRITE_TOKEN is not configured -- voice recording will fail");
    return NextResponse.json(
      { error: "Voice recording is temporarily unavailable.", text: null, audioUrl: null },
      { status: 503 }
    );
  }

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
    return NextResponse.json(
      { error: usageCheck.reason },
      { status: 429 }
    );
  }

  const formData = await request.formData();
  const audioFile = formData.get("audio") as File | null;
  const workspaceId = formData.get("workspaceId") as string | null;

  if (!audioFile) {
    return NextResponse.json(
      { error: "No audio file provided" },
      { status: 400 }
    );
  }

  if (!workspaceId) {
    return NextResponse.json(
      { error: "No workspaceId provided" },
      { status: 400 }
    );
  }

  // ── Read audio into buffer once (prevents stream-consumption issues) ──

  const contentType = audioFile.type || "audio/webm;codecs=opus";
  const audioBuffer = Buffer.from(await audioFile.arrayBuffer());

  // ── Step 1: Upload to Vercel Blob (safety net -- always persists) ──

  let audioUrl: string | null = null;

  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const pathname = `audio/${workspaceId}/${timestamp}.webm`;

    const blob = await put(pathname, audioBuffer, {
      access: "public", // TODO: migrate to token-protected access when Vercel Blob supports it
      contentType,
    });

    audioUrl = blob.url;
  } catch (uploadError) {
    logger.error("Audio upload failed", { error: String(uploadError) });
    return NextResponse.json(
      { error: "Audio upload failed. Please try again.", text: null, audioUrl: null },
      { status: 500 }
    );
  }

  // ── Step 2: Transcribe with Groq Whisper ───────────────────────────

  let text: string | null = null;

  try {
    // Create a fresh File from the buffer for Groq (safe re-read)
    const groqFile = new File([audioBuffer], audioFile.name || "audio.webm", {
      type: contentType,
    });

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
    logger.error("Transcription failed (audio is safe)", { error: String(transcribeError) });
    // Don't fail the request -- audio is already saved
  }

  // ── Log usage ──────────────────────────────────────────────────────

  try {
    await logUsage({
      userId: session.user.id,
      workspaceId,
      operation: "transcribe",
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostCents: 1, // ~$0.04/hr, estimate 1 cent per transcription
    });
  } catch {
    // Non-critical, don't fail the request
  }

  // ── Response ───────────────────────────────────────────────────────

  if (text) {
    return NextResponse.json({ text, audioUrl });
  } else {
    // Audio saved but transcription failed -- return 200 with null text
    return NextResponse.json({
      text: null,
      audioUrl,
      error: "Transcription failed. Your audio has been saved.",
    });
  }
}
