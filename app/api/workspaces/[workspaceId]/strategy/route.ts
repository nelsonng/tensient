import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { runStrategy } from "@/lib/services/genesis-setup";
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
  const { rawInput } = await request.json();

  if (!rawInput || rawInput.trim().length < 10) {
    return NextResponse.json(
      { error: "Strategy input must be at least 10 characters" },
      { status: 400 }
    );
  }

  try {
    const { result, usage } = await runStrategy(workspaceId, rawInput);

    // Log usage
    await logUsage({
      userId: session.user.id,
      workspaceId,
      operation: "strategy",
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      estimatedCostCents: usage.estimatedCostCents,
    });

    trackEvent("strategy_created", {
      userId: session.user.id,
      workspaceId,
      metadata: { inputLength: rawInput.length },
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Strategy setup failed";
    logger.error("Strategy setup failed", { error: message });
    trackEvent("api_error", {
      userId: session.user.id,
      workspaceId,
      metadata: { route: "/api/workspaces/*/strategy", error: message },
    });
    return NextResponse.json(
      { error: "Strategy setup failed" },
      { status: 500 }
    );
  }
}
