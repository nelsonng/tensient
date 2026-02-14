import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { conversations, messages } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getWorkspaceMembership } from "@/lib/auth/workspace-access";

type Params = {
  params: Promise<{
    workspaceId: string;
    conversationId: string;
    messageId: string;
  }>;
};

// DELETE /api/workspaces/[id]/conversations/[cid]/messages/[mid] -- Delete message
export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId, conversationId, messageId } = await params;
  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify conversation ownership
  const [conversation] = await db
    .select({ id: conversations.id })
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
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const [deleted] = await db
    .delete(messages)
    .where(
      and(
        eq(messages.id, messageId),
        eq(messages.conversationId, conversationId)
      )
    )
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
