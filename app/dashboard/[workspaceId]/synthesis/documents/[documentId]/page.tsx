import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { brainDocuments, memberships } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { DocumentEditorClient } from "@/components/document-editor-client";

export default async function SynthesisDocumentPage({
  params,
}: {
  params: Promise<{ workspaceId: string; documentId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const { workspaceId, documentId } = await params;

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

  const [document] = await db
    .select()
    .from(brainDocuments)
    .where(
      and(
        eq(brainDocuments.id, documentId),
        eq(brainDocuments.workspaceId, workspaceId),
        eq(brainDocuments.scope, "synthesis"),
        isNull(brainDocuments.userId)
      )
    )
    .limit(1);

  if (!document) redirect(`/dashboard/${workspaceId}/synthesis`);

  return (
    <DocumentEditorClient
      workspaceId={workspaceId}
      kind="synthesis"
      document={{
        id: document.id,
        title: document.title,
        content: document.content,
        fileUrl: document.fileUrl,
        fileType: document.fileType,
        fileName: document.fileName,
      }}
    />
  );
}
