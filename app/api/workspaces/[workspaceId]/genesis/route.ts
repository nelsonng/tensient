import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { runGenesis } from "@/lib/services/genesis-setup";
import { checkUsageAllowed, logUsage } from "@/lib/usage-guard";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
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

  const { workspaceId } = await params;
  const { rawInput } = await request.json();

  if (!rawInput || rawInput.trim().length < 10) {
    return NextResponse.json(
      { error: "Strategy input must be at least 10 characters" },
      { status: 400 }
    );
  }

  try {
    const { result, usage } = await runGenesis(workspaceId, rawInput);

    // Log usage
    await logUsage({
      userId: session.user.id,
      workspaceId,
      operation: "genesis",
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      estimatedCostCents: usage.estimatedCostCents,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Genesis failed";
    console.error("Genesis error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
