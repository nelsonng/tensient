import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { brainDocuments, memberships } from "@/lib/db/schema";
import { DocumentListClient } from "@/components/document-list-client";

export default async function ContextPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const { workspaceId } = await params;
  const { tab } = await searchParams;
  const activeTab = tab === "workspace" ? "workspace" : "personal";

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
      activeTab === "personal"
        ? and(
            eq(brainDocuments.workspaceId, workspaceId),
            eq(brainDocuments.userId, session.user.id),
            eq(brainDocuments.scope, "personal")
          )
        : and(
            eq(brainDocuments.workspaceId, workspaceId),
            eq(brainDocuments.scope, "workspace"),
            isNull(brainDocuments.userId)
          )
    )
    .orderBy(desc(brainDocuments.updatedAt));

  return (
    <div className="space-y-4">
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="mb-4 border-b border-border pb-2">
          <div className="flex items-center gap-1">
            <Link
              href={`/dashboard/${workspaceId}/context?tab=personal`}
              className={`px-3 py-1.5 font-mono text-xs tracking-wider ${
                activeTab === "personal"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted hover:text-foreground"
              }`}
            >
              MY CONTEXT
            </Link>
            <Link
              href={`/dashboard/${workspaceId}/context?tab=workspace`}
              className={`px-3 py-1.5 font-mono text-xs tracking-wider ${
                activeTab === "workspace"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted hover:text-foreground"
              }`}
            >
              WORKSPACE CONTEXT
            </Link>
          </div>
        </div>
      </div>

      <DocumentListClient
        workspaceId={workspaceId}
        kind={activeTab === "personal" ? "brain" : "canon"}
        documents={docs.map((d) => ({
          ...d,
          createdAt: d.createdAt.toISOString(),
          updatedAt: d.updatedAt.toISOString(),
        }))}
      />
    </div>
  );
}
