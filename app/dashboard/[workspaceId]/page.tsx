import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { memberships, conversations } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
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

    redirect(`/dashboard/${workspaceId}/conversations/${firstConvo.id}?onboarding=true`);
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

  return (
    <ConversationListClient
      workspaceId={workspaceId}
      conversations={convos.map((c) => ({
        id: c.id,
        title: c.title,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      }))}
    />
  );
}
