import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { actions } from "@/lib/db/schema";
import { getWorkspaceMembership } from "@/lib/auth/workspace-access";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; actionId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId, actionId } = await params;

  // Verify workspace membership
  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();

    // Build update object from allowed fields
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.status !== undefined) updates.status = body.status;
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.goalId !== undefined) updates.goalId = body.goalId || null;
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;

    const [updated] = await db
      .update(actions)
      .set(updates)
      .where(
        and(
          eq(actions.id, actionId),
          eq(actions.workspaceId, workspaceId)
        )
      )
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Action not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Failed to update action" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string; actionId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId, actionId } = await params;

  // Verify workspace membership
  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const [deleted] = await db
      .delete(actions)
      .where(
        and(
          eq(actions.id, actionId),
          eq(actions.workspaceId, workspaceId)
        )
      )
      .returning({ id: actions.id });

    if (!deleted) {
      return NextResponse.json({ error: "Action not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete action" },
      { status: 500 }
    );
  }
}
