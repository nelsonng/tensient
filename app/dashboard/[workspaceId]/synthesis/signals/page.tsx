import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { conversations, memberships, signals } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { SignalListClient } from "./signal-list-client";

export default async function SynthesisSignalsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ conversationId?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const { workspaceId } = await params;
  const { conversationId } = await searchParams;

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

  try {
    const rows = await db
      .select({
        id: signals.id,
        content: signals.content,
        conversationId: signals.conversationId,
        conversationTitle: conversations.title,
        status: signals.status,
        aiPriority: signals.aiPriority,
        humanPriority: signals.humanPriority,
        reviewedAt: signals.reviewedAt,
        createdAt: signals.createdAt,
      })
      .from(signals)
      .innerJoin(conversations, eq(conversations.id, signals.conversationId))
      .where(
        and(
          eq(signals.workspaceId, workspaceId),
          conversationId ? eq(signals.conversationId, conversationId) : undefined
        )
      )
      .orderBy(desc(signals.createdAt));

    return (
      <SignalListClient
        workspaceId={workspaceId}
        conversationFilter={conversationId ?? null}
        rows={rows.map((row) => ({
          ...row,
          reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
          createdAt: row.createdAt.toISOString(),
        }))}
      />
    );
  } catch {
    return (
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="rounded-lg border border-border bg-panel p-6">
          <h1 className="font-display text-xl font-bold text-foreground">
            Signals Setup Required
          </h1>
          <p className="mt-2 text-sm text-muted">
            Signals tables are not available in the current database yet. Apply
            Sprint 4 schema migration first.
          </p>
        </div>
      </div>
    );
  }
}
