import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { processCapture } from "@/lib/services/process-capture";
import { checkUsageAllowed, logUsage } from "@/lib/usage-guard";
import { getWorkspaceMembership } from "@/lib/auth/workspace-access";
import { logger } from "@/lib/logger";
import { trackEvent } from "@/lib/platform-events";

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
    return NextResponse.json(
      { error: usageCheck.reason },
      { status: 429 }
    );
  }
  const { content, source, audioUrl } = await request.json();

  if (!content || content.trim().length < 5) {
    return NextResponse.json(
      { error: "Capture content must be at least 5 characters" },
      { status: 400 }
    );
  }

  try {
    const { result, usage } = await processCapture(
      session.user.id,
      workspaceId,
      content,
      source === "voice" ? "voice" : "web",
      audioUrl || undefined
    );

    // Log usage
    await logUsage({
      userId: session.user.id,
      workspaceId,
      operation: "capture",
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      estimatedCostCents: usage.estimatedCostCents,
    });

    trackEvent("capture_submitted", {
      userId: session.user.id,
      workspaceId,
      metadata: { source: source || "web", contentLength: content.length },
    });

    trackEvent("synthesis_generated", {
      userId: session.user.id,
      workspaceId,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Capture processing failed";
    logger.error("Capture processing failed", { error: message });
    trackEvent("api_error", {
      userId: session.user.id,
      workspaceId,
      metadata: { route: "/api/workspaces/*/captures", error: message },
    });
    return NextResponse.json(
      { error: "Capture processing failed" },
      { status: 500 }
    );
  }
}
