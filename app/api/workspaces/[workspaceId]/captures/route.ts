import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { processCapture } from "@/lib/services/process-capture";
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

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Capture processing failed";
    console.error("Capture error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
