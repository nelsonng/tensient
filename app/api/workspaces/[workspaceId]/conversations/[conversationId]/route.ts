import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { conversations, messages } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { getWorkspaceMembership } from "@/lib/auth/workspace-access";

type Params = { params: Promise<{ workspaceId: string; conversationId: string }> };

// GET /api/workspaces/[id]/conversations/[cid] -- Get conversation + messages
export async function GET(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId, conversationId } = await params;
  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [conversation] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.workspaceId, workspaceId),
        eq(conversations.userId, session.user.id)
      )
    )
    .limit(1);

  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt));

  return NextResponse.json({ ...conversation, messages: msgs });
}

// PATCH /api/workspaces/[id]/conversations/[cid] -- Rename conversation
export async function PATCH(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId, conversationId } = await params;
  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { title } = await request.json();
  if (!title || typeof title !== "string") {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const [updated] = await db
    .update(conversations)
    .set({ title, updatedAt: new Date() })
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.workspaceId, workspaceId),
        eq(conversations.userId, session.user.id)
      )
    )
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

// DELETE /api/workspaces/[id]/conversations/[cid] -- Delete conversation + messages
export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId, conversationId } = await params;
  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Messages cascade-delete via FK constraint
  const [deleted] = await db
    .delete(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.workspaceId, workspaceId),
        eq(conversations.userId, session.user.id)
      )
    )
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
