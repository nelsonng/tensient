import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { brainDocuments } from "@/lib/db/schema";
import { eq, and, desc, isNull, inArray, sql } from "drizzle-orm";
import { getWorkspaceMembership } from "@/lib/auth/workspace-access";
import { generateEmbedding } from "@/lib/ai";
import { extractTextFromFile } from "@/lib/extract-text";
import { trackEvent } from "@/lib/platform-events";
import { withErrorTracking } from "@/lib/api-handler";
import {
  shouldChunkDocument,
  buildDocumentChunks,
  buildChunkEmbeddingText,
} from "@/lib/services/chunk-document";

type Params = { params: Promise<{ workspaceId: string }> };

// GET /api/workspaces/[id]/brain -- List personal Brain documents
export const GET = withErrorTracking("List personal context documents", async (
  _request: Request,
  { params }: Params
) => {
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

  return NextResponse.json(
    docs.map((doc) => ({
      ...doc,
      chunkCount: chunkCountByParentId.get(doc.id) ?? 0,
    }))
  );
});

// POST /api/workspaces/[id]/brain -- Create Brain document
export const POST = withErrorTracking("Upload personal context document", async (
  request: Request,
  { params }: Params
) => {
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
  const { title, content, fileUrl, fileType, fileName } = body;

  if (!title || typeof title !== "string") {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  // If a file was uploaded, extract text content
  let resolvedContent = content || "";
  let extractionFailed = false;
  if (fileUrl && fileType && !content) {
    const extracted = await extractTextFromFile(fileUrl, fileType);
    resolvedContent = extracted || "";
    extractionFailed = !extracted?.trim();
  }

  const shouldChunk = shouldChunkDocument(resolvedContent);
  const chunks =
    shouldChunk && resolvedContent ? buildDocumentChunks(title, resolvedContent) : [];
  const chunkCount = chunks.length;

  const embedding =
    resolvedContent && !shouldChunk
      ? await generateEmbedding(resolvedContent.slice(0, 8000))
      : null;
  const chunkEmbeddings = chunks.length
    ? await Promise.all(
        chunks.map((chunk) => generateEmbedding(buildChunkEmbeddingText(chunk.content)))
      )
    : [];

  const [doc] = await db
    .insert(brainDocuments)
    .values({
      workspaceId,
      userId: session.user.id,
      scope: "personal",
      title,
      content: resolvedContent || null,
      fileUrl: fileUrl || null,
      fileType: fileType || null,
      fileName: fileName || null,
      embedding,
      parentDocumentId: null,
      chunkIndex: null,
    })
    .returning();

  if (chunks.length > 0) {
    const chunkRows: typeof brainDocuments.$inferInsert[] = chunks.map((chunk, index) => ({
      workspaceId,
      userId: session.user.id,
      scope: "personal",
      title: chunk.title,
      content: chunk.content,
      embedding: chunkEmbeddings[index],
      parentDocumentId: doc.id,
      chunkIndex: chunk.chunkIndex,
      fileUrl: null,
      fileType: null,
      fileName: null,
    }));

    await db.insert(brainDocuments).values(chunkRows);
  }

  trackEvent("brain_document_created", {
    userId: session.user.id,
    workspaceId,
    metadata: { documentId: doc.id, hasFile: !!fileUrl, extractionFailed },
  });

  return NextResponse.json(
    {
      ...doc,
      chunkCount,
      extractionFailed,
      extractionWarning: extractionFailed
        ? "File uploaded, but text extraction failed. This document may not be retrievable in conversations until content is added."
        : null,
    },
    { status: 201 }
  );
});
