import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { memberships, conversations, messages } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { ConversationViewClient } from "./conversation-view-client";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ workspaceId: string; conversationId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const { workspaceId, conversationId } = await params;

  // Verify membership
  const [membership] = await db
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, session.user.id),
        eq(memberships.workspaceId, workspaceId)
      )
    )
    .limit(1);

  if (!membership) redirect("/sign-in");

  // Fetch conversation
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

  if (!conversation) redirect(`/dashboard/${workspaceId}`);

  // Fetch messages
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt));

  return (
    <ConversationViewClient
      workspaceId={workspaceId}
      conversation={{
        id: conversation.id,
        title: conversation.title,
        createdAt: conversation.createdAt.toISOString(),
      }}
      initialMessages={msgs.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        audioUrl: m.audioUrl,
        attachments: m.attachments as Array<{ url: string; filename: string; contentType: string }> | null,
        metadata: m.metadata as Record<string, unknown> | null,
        createdAt: m.createdAt.toISOString(),
      }))}
    />
  );
}
