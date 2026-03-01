import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { brainDocuments } from "@/lib/db/schema";
import { eq, and, isNull, asc } from "drizzle-orm";
import { getWorkspaceMembership } from "@/lib/auth/workspace-access";
import { generateEmbedding } from "@/lib/ai";
import { logger } from "@/lib/logger";
import { withErrorTracking } from "@/lib/api-handler";
import {
  shouldChunkDocument,
  buildDocumentChunks,
  buildChunkEmbeddingText,
} from "@/lib/services/chunk-document";

type Params = { params: Promise<{ workspaceId: string; documentId: string }> };

// GET /api/workspaces/[id]/canon/[did] -- Get Canon document
export const GET = withErrorTracking("View workspace context document", async (
  _request: Request,
  { params }: Params
) => {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId, documentId } = await params;
  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [doc] = await db
    .select()
    .from(brainDocuments)
    .where(
      and(
        eq(brainDocuments.id, documentId),
        eq(brainDocuments.workspaceId, workspaceId),
        eq(brainDocuments.scope, "workspace"),
        isNull(brainDocuments.userId),
        isNull(brainDocuments.parentDocumentId)
      )
    )
    .limit(1);

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(doc);
});

// PATCH /api/workspaces/[id]/canon/[did] -- Update Canon document
export const PATCH = withErrorTracking("Update workspace context document", async (
  request: Request,
  { params }: Params
) => {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId, documentId } = await params;
  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  const nextTitle = body.title !== undefined ? String(body.title) : undefined;
  const hasContentUpdate = body.content !== undefined;
  const nextContent = hasContentUpdate ? String(body.content ?? "") : undefined;
  const shouldChunk = hasContentUpdate && shouldChunkDocument(nextContent);
  const chunkBaseTitle = (nextTitle ?? "").trim();
  const chunks =
    hasContentUpdate && nextContent && shouldChunk
      ? buildDocumentChunks(chunkBaseTitle || "Untitled", nextContent)
      : [];
  const chunkEmbeddings = chunks.length
    ? await Promise.all(
        chunks.map((chunk) => generateEmbedding(buildChunkEmbeddingText(chunk.content)))
      )
    : [];

  if (nextTitle !== undefined) updates.title = nextTitle;
  if (hasContentUpdate) {
    updates.content = nextContent;
    try {
      if (nextContent && !shouldChunk) {
        updates.embedding = await generateEmbedding(nextContent.slice(0, 8000));
      } else {
        updates.embedding = null;
      }
    } catch (error) {
      logger.error("Embedding generation failed on Canon update", { error: String(error) });
    }
  }

  const [updated] = await db
    .update(brainDocuments)
    .set(updates)
    .where(
      and(
        eq(brainDocuments.id, documentId),
        eq(brainDocuments.workspaceId, workspaceId),
        eq(brainDocuments.scope, "workspace"),
        isNull(brainDocuments.userId),
        isNull(brainDocuments.parentDocumentId)
      )
    )
    .returning();

  if (updated && hasContentUpdate) {
    await db
      .delete(brainDocuments)
      .where(eq(brainDocuments.parentDocumentId, documentId));

    if (chunks.length > 0) {
      const chunkRows: typeof brainDocuments.$inferInsert[] = chunks.map((chunk, index) => ({
        workspaceId,
        userId: null,
        scope: "workspace",
        title: `${nextTitle ?? updated.title} (Chunk ${chunk.chunkIndex + 1})`,
        content: chunk.content,
        embedding: chunkEmbeddings[index],
        parentDocumentId: updated.id,
        chunkIndex: chunk.chunkIndex,
        fileUrl: null,
        fileType: null,
        fileName: null,
      }));
      await db.insert(brainDocuments).values(chunkRows);
    }
  } else if (updated && nextTitle !== undefined) {
    const chunks = await db
      .select({
        id: brainDocuments.id,
        chunkIndex: brainDocuments.chunkIndex,
      })
      .from(brainDocuments)
      .where(eq(brainDocuments.parentDocumentId, documentId))
      .orderBy(asc(brainDocuments.chunkIndex));

    for (const chunk of chunks) {
      const chunkIndex = chunk.chunkIndex ?? 0;
      await db
        .update(brainDocuments)
        .set({ title: `${nextTitle} (Chunk ${chunkIndex + 1})`, updatedAt: new Date() })
        .where(eq(brainDocuments.id, chunk.id));
    }
  }

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
});

// DELETE /api/workspaces/[id]/canon/[did] -- Delete Canon document
export const DELETE = withErrorTracking("Delete workspace context document", async (
  _request: Request,
  { params }: Params
) => {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId, documentId } = await params;
  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [deleted] = await db
    .delete(brainDocuments)
    .where(
      and(
        eq(brainDocuments.id, documentId),
        eq(brainDocuments.workspaceId, workspaceId),
        eq(brainDocuments.scope, "workspace"),
        isNull(brainDocuments.userId),
        isNull(brainDocuments.parentDocumentId)
      )
    )
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
});
