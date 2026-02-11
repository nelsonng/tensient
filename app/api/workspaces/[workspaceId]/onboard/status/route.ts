import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  canons,
  captures,
  artifacts,
  digests,
  workspaces,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getWorkspaceMembership } from "@/lib/auth/workspace-access";
import { logger } from "@/lib/logger";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await params;

  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Check what data exists
    const [canon] = await db
      .select({ id: canons.id })
      .from(canons)
      .where(eq(canons.workspaceId, workspaceId))
      .limit(1);

    const [artifact] = await db
      .select({ id: artifacts.id })
      .from(artifacts)
      .innerJoin(captures, eq(artifacts.captureId, captures.id))
      .where(eq(captures.workspaceId, workspaceId))
      .limit(1);

    const [digest] = await db
      .select({ id: digests.id })
      .from(digests)
      .where(eq(digests.workspaceId, workspaceId))
      .limit(1);

    // Get ghost team from workspace
    const [workspace] = await db
      .select({ ghostTeam: workspaces.ghostTeam })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    return NextResponse.json({
      hasCanon: !!canon,
      hasArtifact: !!artifact,
      hasDigest: !!digest,
      ghostTeam: (workspace?.ghostTeam as Array<{ name: string; role: string }>) ?? [],
    });
  } catch (error: unknown) {
    logger.error("Failed to check onboard status", {
      workspaceId,
      userId: session.user.id,
      error: error instanceof Error ? error.message : "Unknown",
    });
    return NextResponse.json(
      { error: "Failed to check onboard status" },
      { status: 500 }
    );
  }
}
