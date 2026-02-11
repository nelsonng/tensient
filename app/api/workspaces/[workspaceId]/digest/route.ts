import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { generateWeeklyDigest } from "@/lib/services/generate-digest";
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

  try {
    // Generate digest for the current week
    const now = new Date();
    const dayOfWeek = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    weekStart.setHours(0, 0, 0, 0);

    const result = await generateWeeklyDigest({
      workspaceId,
      userId: session.user.id,
      weekStart,
    });

    if (!result) {
      return NextResponse.json(
        { error: "Could not generate digest" },
        { status: 422 }
      );
    }

    trackEvent("digest_generated", {
      userId: session.user.id,
      workspaceId,
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error("Digest generation failed", { error });
    trackEvent("api_error", {
      userId: session.user.id,
      workspaceId,
      metadata: { route: "/api/workspaces/*/digest", error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json(
      { error: "Digest generation failed" },
      { status: 500 }
    );
  }
}
