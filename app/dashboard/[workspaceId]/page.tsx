import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { memberships, conversations, messages } from "@/lib/db/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { ConversationListClient } from "./conversation-list-client";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const { workspaceId } = await params;

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

  // Check if user has any conversations
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(conversations)
    .where(
      and(
        eq(conversations.workspaceId, workspaceId),
        eq(conversations.userId, session.user.id)
      )
    );

  // First-time user: auto-create first conversation and redirect
  if (Number(count) === 0) {
    const [firstConvo] = await db
      .insert(conversations)
      .values({
        workspaceId,
        userId: session.user.id,
        title: null, // Will be AI-generated
      })
      .returning();

    redirect(`/dashboard/${workspaceId}/conversations/${firstConvo.id}`);
  }

  // Fetch conversations
  const convos = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.workspaceId, workspaceId),
        eq(conversations.userId, session.user.id)
      )
    )
    .orderBy(desc(conversations.updatedAt));

  const conversationIds = convos.map((c) => c.id);
  const countsByConversation = conversationIds.length
    ? await db
        .select({
          conversationId: messages.conversationId,
          count: sql<number>`count(*)`,
        })
        .from(messages)
        .where(inArray(messages.conversationId, conversationIds))
        .groupBy(messages.conversationId)
    : [];

  const countMap = new Map<string, number>(
    countsByConversation.map((row) => [row.conversationId, Number(row.count)])
  );

  return (
    <ConversationListClient
      workspaceId={workspaceId}
      conversations={convos.map((c) => ({
        id: c.id,
        title: c.title,
        messageCount: countMap.get(c.id) ?? 0,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      }))}
    />
  );
}
