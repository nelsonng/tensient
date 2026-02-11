import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { memberships } from "@/lib/db/schema";
import { getWorkspaceMembership } from "@/lib/auth/workspace-access";
import { logger } from "@/lib/logger";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; memberId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId, memberId } = await params;

  // Verify caller is an owner
  const callerMembership = await getWorkspaceMembership(
    session.user.id,
    workspaceId
  );
  if (!callerMembership || callerMembership.role !== "owner") {
    return NextResponse.json(
      { error: "Only workspace owners can change member roles" },
      { status: 403 }
    );
  }

  try {
    const { role } = await request.json();

    if (!role || !["owner", "member", "observer"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid role. Must be owner, member, or observer" },
        { status: 400 }
      );
    }

    // Look up the target membership
    const [target] = await db
      .select({
        id: memberships.id,
        userId: memberships.userId,
        role: memberships.role,
      })
      .from(memberships)
      .where(
        and(
          eq(memberships.id, memberId),
          eq(memberships.workspaceId, workspaceId)
        )
      )
      .limit(1);

    if (!target) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Prevent demoting yourself if you're the last owner
    if (target.userId === session.user.id && target.role === "owner" && role !== "owner") {
      const owners = await db
        .select({ id: memberships.id })
        .from(memberships)
        .where(
          and(
            eq(memberships.workspaceId, workspaceId),
            eq(memberships.role, "owner")
          )
        );

      if (owners.length <= 1) {
        return NextResponse.json(
          { error: "Cannot demote the last workspace owner" },
          { status: 400 }
        );
      }
    }

    const [updated] = await db
      .update(memberships)
      .set({ role, updatedAt: new Date() })
      .where(eq(memberships.id, memberId))
      .returning({
        id: memberships.id,
        userId: memberships.userId,
        role: memberships.role,
      });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    logger.error("Failed to update member role", {
      workspaceId,
      memberId,
      userId: session.user.id,
      error: error instanceof Error ? error.message : "Unknown",
    });
    return NextResponse.json(
      { error: "Failed to update member role" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string; memberId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId, memberId } = await params;

  // Verify caller is an owner
  const callerMembership = await getWorkspaceMembership(
    session.user.id,
    workspaceId
  );
  if (!callerMembership || callerMembership.role !== "owner") {
    return NextResponse.json(
      { error: "Only workspace owners can remove members" },
      { status: 403 }
    );
  }

  try {
    // Look up the target membership
    const [target] = await db
      .select({
        id: memberships.id,
        userId: memberships.userId,
      })
      .from(memberships)
      .where(
        and(
          eq(memberships.id, memberId),
          eq(memberships.workspaceId, workspaceId)
        )
      )
      .limit(1);

    if (!target) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Cannot remove yourself
    if (target.userId === session.user.id) {
      return NextResponse.json(
        { error: "Cannot remove yourself from the workspace" },
        { status: 400 }
      );
    }

    await db
      .delete(memberships)
      .where(eq(memberships.id, memberId));

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error("Failed to remove member", {
      workspaceId,
      memberId,
      userId: session.user.id,
      error: error instanceof Error ? error.message : "Unknown",
    });
    return NextResponse.json(
      { error: "Failed to remove member" },
      { status: 500 }
    );
  }
}
