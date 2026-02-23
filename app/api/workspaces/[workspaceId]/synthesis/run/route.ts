import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getWorkspaceMembership } from "@/lib/auth/workspace-access";
import { checkUsageAllowed, logUsage } from "@/lib/usage-guard";
import { processSynthesis } from "@/lib/services/process-synthesis";
import { trackEvent } from "@/lib/platform-events";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ workspaceId: string }> };

// POST /api/workspaces/[workspaceId]/synthesis/run
export async function POST(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.SYNTHESIS_ENABLED === "false") {
    return NextResponse.json(
      { error: "Synthesis is currently disabled." },
      { status: 403 }
    );
  }

  const { workspaceId } = await params;
  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const usageCheck = await checkUsageAllowed(session.user.id);
  if (!usageCheck.allowed) {
    trackEvent("usage_blocked", {
      userId: session.user.id,
      workspaceId,
      metadata: { operation: "synthesis", reason: usageCheck.reason },
    });
    return NextResponse.json({ error: usageCheck.reason }, { status: 429 });
  }

  try {
    const result = await processSynthesis({
      workspaceId,
      userId: session.user.id,
      trigger: "manual",
    });

    if (result.usage) {
      await logUsage({
        userId: session.user.id,
        workspaceId,
        operation: "synthesis",
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        estimatedCostCents: result.usage.estimatedCostCents,
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    logger.error("Failed to run synthesis", {
      workspaceId,
      userId: session.user.id,
      error: String(error),
    });
    const message =
      error instanceof Error ? error.message : "Failed to run synthesis";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
