import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { brainDocuments, synthesisCommits, synthesisDocumentVersions } from "@/lib/db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getWorkspaceMembership } from "@/lib/auth/workspace-access";
import { generateEmbedding } from "@/lib/ai";

type Params = { params: Promise<{ workspaceId: string }> };

// GET /api/workspaces/[workspaceId]/synthesis/documents
export async function GET(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await params;
  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
        eq(brainDocuments.scope, "synthesis"),
        isNull(brainDocuments.userId)
      )
    )
    .orderBy(desc(brainDocuments.updatedAt));

  return NextResponse.json(docs);
}

// POST /api/workspaces/[workspaceId]/synthesis/documents
export async function POST(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await params;
  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const title = body?.title as string | undefined;
  const content = body?.content as string | undefined;

  if (!title || typeof title !== "string") {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const embedding = content ? await generateEmbedding(content.slice(0, 8000)) : null;

  const [doc] = await db
    .insert(brainDocuments)
    .values({
      workspaceId,
      userId: null,
      scope: "synthesis",
      title,
      content: content ?? "",
      embedding,
    })
    .returning();

  const [headCommit] = await db
    .select({ id: synthesisCommits.id })
    .from(synthesisCommits)
    .where(eq(synthesisCommits.workspaceId, workspaceId))
    .orderBy(desc(synthesisCommits.createdAt))
    .limit(1);

  const [manualCommit] = await db
    .insert(synthesisCommits)
    .values({
      workspaceId,
      parentId: headCommit?.id ?? null,
      summary: `Manual create: ${doc.title}`,
      trigger: "manual",
      signalCount: 0,
    })
    .returning({ id: synthesisCommits.id });

  await db.insert(synthesisDocumentVersions).values({
    documentId: doc.id,
    commitId: manualCommit.id,
    title: doc.title,
    content: doc.content ?? "",
    changeType: "created",
  });

  return NextResponse.json(doc, { status: 201 });
}
