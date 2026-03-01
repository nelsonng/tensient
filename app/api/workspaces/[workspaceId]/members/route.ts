import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { memberships, users } from "@/lib/db/schema";
import { getWorkspaceMembership } from "@/lib/auth/workspace-access";
import { logger } from "@/lib/logger";
import { withErrorTracking } from "@/lib/api-handler";

async function getHandler(
  _request: Request,
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
    const members = await db
      .select({
        membershipId: memberships.id,
        userId: memberships.userId,
        role: memberships.role,
        tractionScore: memberships.tractionScore,
        joinedAt: memberships.createdAt,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(eq(memberships.workspaceId, workspaceId));

    return NextResponse.json(members);
  } catch (error: unknown) {
    logger.error("Failed to load members", {
      workspaceId,
      userId: session.user.id,
      error: error instanceof Error ? error.message : "Unknown",
    });
    return NextResponse.json(
      { error: "Failed to load members" },
      { status: 500 }
    );
  }
}

export const GET = withErrorTracking("List workspace members", getHandler);
