import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  memberships,
  signals,
  synthesisCommitSignals,
  synthesisCommits,
  synthesisDocumentVersions,
} from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";

export default async function SynthesisCommitDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string; commitId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const { workspaceId, commitId } = await params;

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

  const [commit] = await db
    .select()
    .from(synthesisCommits)
    .where(and(eq(synthesisCommits.id, commitId), eq(synthesisCommits.workspaceId, workspaceId)))
    .limit(1);

  if (!commit) redirect(`/dashboard/${workspaceId}/synthesis/history`);

  const documentVersions = await db
    .select({
      id: synthesisDocumentVersions.id,
      documentId: synthesisDocumentVersions.documentId,
      title: synthesisDocumentVersions.title,
      content: synthesisDocumentVersions.content,
      changeType: synthesisDocumentVersions.changeType,
    })
    .from(synthesisDocumentVersions)
    .where(eq(synthesisDocumentVersions.commitId, commit.id));

  const linked = await db
    .select({ signalId: synthesisCommitSignals.signalId })
    .from(synthesisCommitSignals)
    .where(eq(synthesisCommitSignals.commitId, commit.id));

  const signalIds = linked.map((row) => row.signalId);
  const linkedSignals = signalIds.length
    ? await db
        .select({
          id: signals.id,
          content: signals.content,
          aiPriority: signals.aiPriority,
          humanPriority: signals.humanPriority,
        })
        .from(signals)
        .where(inArray(signals.id, signalIds))
    : [];

  return (
    <div className="mx-auto max-w-[1000px] px-6">
      <div className="mb-6">
        <Link
          href={`/dashboard/${workspaceId}/synthesis/history`}
          className="font-mono text-xs uppercase tracking-wider text-muted hover:text-foreground"
        >
          ← Back to History
        </Link>
      </div>

      <div className="rounded-lg border border-border bg-panel p-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
          Commit
        </p>
        <h1 className="mt-2 font-display text-xl font-bold tracking-tight text-foreground">
          {commit.summary}
        </h1>
        <p className="mt-2 font-mono text-[11px] text-muted">
          Trigger: {commit.trigger} · Signals: {commit.signalCount} ·{" "}
          {commit.createdAt.toLocaleString()}
        </p>
      </div>

      <div className="mt-6 rounded-lg border border-border bg-panel p-6">
        <h2 className="font-mono text-xs uppercase tracking-widest text-muted">
          Document Changes
        </h2>
        {documentVersions.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No document changes recorded.</p>
        ) : (
          <div className="mt-3 space-y-4">
            {documentVersions.map((version) => (
              <div key={version.id} className="rounded border border-border/70 p-3">
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
                  {version.changeType}
                </p>
                <p className="mt-1 text-sm text-foreground">{version.title}</p>
                <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap text-xs text-muted">
                  {version.content || "--"}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 rounded-lg border border-border bg-panel p-6">
        <h2 className="font-mono text-xs uppercase tracking-widest text-muted">
          Linked Signals
        </h2>
        {linkedSignals.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No linked signals.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {linkedSignals.map((signal) => (
              <li key={signal.id} className="rounded border border-border/70 px-3 py-2">
                <p className="text-sm text-foreground">{signal.content}</p>
                <p className="mt-1 font-mono text-[10px] text-muted">
                  AI {signal.aiPriority ? signal.aiPriority.toUpperCase() : "--"} · YOU{" "}
                  {signal.humanPriority ? signal.humanPriority.toUpperCase() : "--"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
