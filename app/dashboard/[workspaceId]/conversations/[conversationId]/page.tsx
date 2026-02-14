import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { memberships, conversations, messages, protocols } from "@/lib/db/schema";
import { eq, and, asc, or } from "drizzle-orm";
import { ConversationViewClient } from "./conversation-view-client";

export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string; conversationId: string }>;
  searchParams: Promise<{ onboarding?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const { workspaceId, conversationId } = await params;
  const { onboarding } = await searchParams;
  const isOnboarding = onboarding === "true";

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

  // Fetch available coaches (system + workspace + user)
  const coaches = await db
    .select({
      id: protocols.id,
      name: protocols.name,
      description: protocols.description,
      category: protocols.category,
    })
    .from(protocols)
    .where(
      or(
        eq(protocols.ownerType, "system"),
        eq(protocols.ownerId, workspaceId),
        eq(protocols.ownerId, session.user.id)
      )
    );

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
        coachIds: m.coachIds as string[] | null,
        createdAt: m.createdAt.toISOString(),
      }))}
      coaches={coaches}
      isOnboarding={isOnboarding}
    />
  );
}
