import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { memberships, brainDocuments } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { DocumentEditorClient } from "@/components/document-editor-client";

export default async function BrainDocumentPage({
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

  const [doc] = await db
    .select()
    .from(brainDocuments)
    .where(
      and(
        eq(brainDocuments.id, documentId),
        eq(brainDocuments.workspaceId, workspaceId),
        eq(brainDocuments.userId, session.user.id),
        eq(brainDocuments.scope, "personal")
      )
    )
    .limit(1);

  if (!doc) redirect(`/dashboard/${workspaceId}/brain`);

  return (
    <DocumentEditorClient
      workspaceId={workspaceId}
      document={{
        id: doc.id,
        title: doc.title,
        content: doc.content,
        fileUrl: doc.fileUrl,
        fileType: doc.fileType,
        fileName: doc.fileName,
      }}
      kind="brain"
    />
  );
}
