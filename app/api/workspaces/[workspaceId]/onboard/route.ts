import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { runStrategy } from "@/lib/services/genesis-setup";
import { processCapture } from "@/lib/services/process-capture";
import { generateWeeklyDigest } from "@/lib/services/generate-digest";
import { checkUsageAllowed, logUsage } from "@/lib/usage-guard";
import { getWorkspaceMembership } from "@/lib/auth/workspace-access";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await params;

  // Verify workspace membership
  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Usage guard
  const usageCheck = await checkUsageAllowed(session.user.id);
  if (!usageCheck.allowed) {
    return NextResponse.json({ error: usageCheck.reason }, { status: 429 });
  }

  const { rawInput, source, audioUrl } = await request.json();

  if (!rawInput || rawInput.trim().length < 10) {
    return NextResponse.json(
      { error: "Input must be at least 10 characters" },
      { status: 400 }
    );
  }

  try {
    // ── Phase 1: Strategy extraction (creates canon — required before capture) ──
    const { result: strategyResult, usage: strategyUsage } = await runStrategy(
      workspaceId,
      rawInput
    );

    // Store ghost team on workspace if names were extracted
    if (strategyResult.teamMembers && strategyResult.teamMembers.length > 0) {
      await db
        .update(workspaces)
        .set({ ghostTeam: strategyResult.teamMembers, updatedAt: new Date() })
        .where(eq(workspaces.id, workspaceId));
    }

    // Log strategy usage
    await logUsage({
      userId: session.user.id,
      workspaceId,
      operation: "strategy",
      inputTokens: strategyUsage.inputTokens,
      outputTokens: strategyUsage.outputTokens,
      estimatedCostCents: strategyUsage.estimatedCostCents,
    });

    // ── Phase 2: Capture processing (uses the canon just created) ──
    const { usage: captureUsage } = await processCapture(
      session.user.id,
      workspaceId,
      rawInput,
      source === "voice" ? "voice" : "web",
      audioUrl || undefined
    );

    await logUsage({
      userId: session.user.id,
      workspaceId,
      operation: "capture",
      inputTokens: captureUsage.inputTokens,
      outputTokens: captureUsage.outputTokens,
      estimatedCostCents: captureUsage.estimatedCostCents,
    });

    // ── Phase 3: Digest generation ──
    const now = new Date();
    const dayOfWeek = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    weekStart.setHours(0, 0, 0, 0);

    await generateWeeklyDigest({
      workspaceId,
      userId: session.user.id,
      weekStart,
    });

    return NextResponse.json({ status: "complete" });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Onboard processing failed";
    logger.error("Onboard processing failed", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
