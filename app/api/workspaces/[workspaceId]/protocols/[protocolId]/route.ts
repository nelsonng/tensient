import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { protocols } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getWorkspaceMembership } from "@/lib/auth/workspace-access";

type Params = { params: Promise<{ workspaceId: string; protocolId: string }> };

// GET /api/workspaces/[id]/protocols/[pid] -- Get coach details
export async function GET(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId, protocolId } = await params;
  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [coach] = await db
    .select()
    .from(protocols)
    .where(eq(protocols.id, protocolId))
    .limit(1);

  if (!coach) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(coach);
}

// PATCH /api/workspaces/[id]/protocols/[pid] -- Update coach (only if user owns it)
export async function PATCH(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId, protocolId } = await params;
  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.systemPrompt !== undefined) updates.systemPrompt = body.systemPrompt;
  if (body.category !== undefined) updates.category = body.category;

  // Only allow editing user-owned coaches
  const [updated] = await db
    .update(protocols)
    .set(updates)
    .where(
      and(
        eq(protocols.id, protocolId),
        eq(protocols.createdBy, session.user.id)
      )
    )
    .returning();

  if (!updated) {
    return NextResponse.json(
      { error: "Not found or cannot edit system coaches" },
      { status: 404 }
    );
  }

  return NextResponse.json(updated);
}

// DELETE /api/workspaces/[id]/protocols/[pid] -- Delete coach (only if user owns it)
export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId, protocolId } = await params;
  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [deleted] = await db
    .delete(protocols)
    .where(
      and(
        eq(protocols.id, protocolId),
        eq(protocols.createdBy, session.user.id)
      )
    )
    .returning();

  if (!deleted) {
    return NextResponse.json(
      { error: "Not found or cannot delete system coaches" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
