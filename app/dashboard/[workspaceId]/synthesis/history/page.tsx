import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { memberships, synthesisCommits } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { HistoryListClient } from "./history-list-client";

export default async function SynthesisHistoryPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const { workspaceId } = await params;

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
        id: synthesisCommits.id,
        summary: synthesisCommits.summary,
        trigger: synthesisCommits.trigger,
        signalCount: synthesisCommits.signalCount,
        createdAt: synthesisCommits.createdAt,
      })
      .from(synthesisCommits)
      .where(eq(synthesisCommits.workspaceId, workspaceId))
      .orderBy(desc(synthesisCommits.createdAt));

    return (
      <HistoryListClient
        workspaceId={workspaceId}
        rows={rows.map((row) => ({
          ...row,
          createdAt: row.createdAt.toISOString(),
        }))}
      />
    );
  } catch {
    return (
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="rounded-lg border border-border bg-panel p-6">
          <h1 className="font-display text-xl font-bold text-foreground">
            History Setup Required
          </h1>
          <p className="mt-2 text-sm text-muted">
            Synthesis commit tables are not available in the current database yet.
            Apply Sprint 4 schema migration first.
          </p>
        </div>
      </div>
    );
  }
}
