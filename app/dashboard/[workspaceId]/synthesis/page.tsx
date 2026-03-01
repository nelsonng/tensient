import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  brainDocuments,
  memberships,
  synthesisCommitSignals,
  synthesisDocumentVersions,
} from "@/lib/db/schema";
import { getUnprocessedSignalCount } from "@/lib/services/process-synthesis";
import { SynthesisDocumentListClient } from "./document-list-client";

export default async function SynthesisPage({
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
    const docs = await db
      .select({
        id: brainDocuments.id,
        title: brainDocuments.title,
        content: brainDocuments.content,
        updatedAt: brainDocuments.updatedAt,
      })
      .from(brainDocuments)
      .where(
        and(
          eq(brainDocuments.workspaceId, workspaceId),
          eq(brainDocuments.scope, "synthesis"),
          isNull(brainDocuments.userId),
          isNull(brainDocuments.parentDocumentId)
        )
      );

    const docIds = docs.map((doc) => doc.id);
    const versions = docIds.length
      ? await db
          .select({
            documentId: synthesisDocumentVersions.documentId,
            commitId: synthesisDocumentVersions.commitId,
          })
          .from(synthesisDocumentVersions)
          .where(inArray(synthesisDocumentVersions.documentId, docIds))
      : [];

    const commitIds = Array.from(new Set(versions.map((v) => v.commitId)));
    const commitSignalRows = commitIds.length
      ? await db
          .select({
            commitId: synthesisCommitSignals.commitId,
            signalId: synthesisCommitSignals.signalId,
          })
          .from(synthesisCommitSignals)
          .where(inArray(synthesisCommitSignals.commitId, commitIds))
      : [];

    const commitSignalCount = new Map<string, number>();
    for (const row of commitSignalRows) {
      commitSignalCount.set(
        row.commitId,
        (commitSignalCount.get(row.commitId) ?? 0) + 1
      );
    }

    const commitIdsByDoc = new Map<string, Set<string>>();
    for (const version of versions) {
      const set = commitIdsByDoc.get(version.documentId) ?? new Set<string>();
      set.add(version.commitId);
      commitIdsByDoc.set(version.documentId, set);
    }

    const unprocessedCount = await getUnprocessedSignalCount(workspaceId);

    return (
      <SynthesisDocumentListClient
        workspaceId={workspaceId}
        unprocessedCount={unprocessedCount}
        rows={docs.map((doc) => {
          const docCommitIds = commitIdsByDoc.get(doc.id) ?? new Set<string>();
          let signalCount = 0;
          for (const commitId of docCommitIds) {
            signalCount += commitSignalCount.get(commitId) ?? 0;
          }
          return {
            id: doc.id,
            title: doc.title,
            content: doc.content,
            commitCount: docCommitIds.size,
            signalCount,
            updatedAt: doc.updatedAt.toISOString(),
          };
        })}
      />
    );
  } catch {
    return (
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="rounded-lg border border-border bg-panel p-6">
          <h1 className="font-display text-xl font-bold text-foreground">
            Synthesis Setup Required
          </h1>
          <p className="mt-2 text-sm text-muted">
            Synthesis schema is not yet applied to this database. Run the Sprint 4
            schema migration (`drizzle-kit push`) before using this page.
          </p>
        </div>
      </div>
    );
  }
}
