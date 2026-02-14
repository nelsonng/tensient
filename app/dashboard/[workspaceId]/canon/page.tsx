import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { memberships, brainDocuments } from "@/lib/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { DocumentListClient } from "@/components/document-list-client";

export default async function CanonPage({
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
        eq(brainDocuments.scope, "workspace"),
        isNull(brainDocuments.userId)
      )
    )
    .orderBy(desc(brainDocuments.updatedAt));

  return (
    <DocumentListClient
      workspaceId={workspaceId}
      documents={docs.map((d) => ({
        ...d,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
      }))}
      kind="canon"
    />
  );
}
