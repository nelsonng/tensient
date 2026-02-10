import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { refineSynthesis } from "@/lib/services/process-capture";
import { checkUsageAllowed, logUsage } from "@/lib/usage-guard";
import { getWorkspaceMembership } from "@/lib/auth/workspace-access";
import { logger } from "@/lib/logger";

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

  const { artifactId, feedback } = await request.json();

  if (!artifactId) {
    return NextResponse.json(
      { error: "artifactId is required" },
      { status: 400 }
    );
  }

  if (!feedback || feedback.trim().length < 5) {
    return NextResponse.json(
      { error: "Feedback must be at least 5 characters" },
      { status: 400 }
    );
  }

  try {
    const { result, usage } = await refineSynthesis(
      session.user.id,
      workspaceId,
      artifactId,
      feedback.trim()
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

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Synthesis refinement failed";
    logger.error("Synthesis refinement failed", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
