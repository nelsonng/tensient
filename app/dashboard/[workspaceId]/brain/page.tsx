import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { memberships, brainDocuments } from "@/lib/db/schema";
import { eq, and, desc, isNull, inArray, sql } from "drizzle-orm";
import { DocumentListClient } from "@/components/document-list-client";

export default async function BrainPage({
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

  const docs = await db
    .select({
      id: brainDocuments.id,
      title: brainDocuments.title,
      content: brainDocuments.content,
      fileUrl: brainDocuments.fileUrl,
      fileType: brainDocuments.fileType,
      fileName: brainDocuments.fileName,
      scope: brainDocuments.scope,
      createdAt: brainDocuments.createdAt,
      updatedAt: brainDocuments.updatedAt,
    })
    .from(brainDocuments)
    .where(
      and(
        eq(brainDocuments.workspaceId, workspaceId),
        eq(brainDocuments.userId, session.user.id),
        eq(brainDocuments.scope, "personal"),
        isNull(brainDocuments.parentDocumentId)
      )
    )
    .orderBy(desc(brainDocuments.updatedAt));

  const chunkRows = docs.length
    ? await db
        .select({
          parentDocumentId: brainDocuments.parentDocumentId,
          count: sql<number>`count(*)`,
        })
        .from(brainDocuments)
        .where(inArray(brainDocuments.parentDocumentId, docs.map((doc) => doc.id)))
        .groupBy(brainDocuments.parentDocumentId)
    : [];
  const chunkCountByParentId = new Map(
    chunkRows.map((row) => [row.parentDocumentId, Number(row.count)])
  );

  return (
    <DocumentListClient
      workspaceId={workspaceId}
      documents={docs.map((d) => ({
        ...d,
        chunkCount: chunkCountByParentId.get(d.id) ?? 0,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
      }))}
      kind="brain"
    />
  );
}
