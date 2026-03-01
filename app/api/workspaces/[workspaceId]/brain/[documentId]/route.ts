import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { brainDocuments } from "@/lib/db/schema";
import { eq, and, isNull, asc } from "drizzle-orm";
import { getWorkspaceMembership } from "@/lib/auth/workspace-access";
import { generateEmbedding } from "@/lib/ai";
import { logger } from "@/lib/logger";
import {
  shouldChunkDocument,
  buildDocumentChunks,
  buildChunkEmbeddingText,
} from "@/lib/services/chunk-document";

type Params = { params: Promise<{ workspaceId: string; documentId: string }> };

// GET /api/workspaces/[id]/brain/[did] -- Get Brain document
export async function GET(_request: Request, { params }: Params) {
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
        eq(brainDocuments.userId, session.user.id),
        eq(brainDocuments.scope, "personal"),
        isNull(brainDocuments.parentDocumentId)
      )
    )
    .limit(1);

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(doc);
}

// PATCH /api/workspaces/[id]/brain/[did] -- Update Brain document
export async function PATCH(request: Request, { params }: Params) {
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

  if (nextTitle !== undefined) updates.title = nextTitle;
  if (hasContentUpdate) {
    updates.content = nextContent;
    // Re-generate embedding when content changes
    try {
      if (nextContent && !shouldChunk) {
        updates.embedding = await generateEmbedding(nextContent.slice(0, 8000));
      } else {
        updates.embedding = null;
      }
    } catch (error) {
      logger.error("Embedding generation failed on update", { error: String(error) });
    }
  }

  const [updated] = await db.transaction(async (tx) => {
    const [parentDoc] = await tx
      .update(brainDocuments)
      .set(updates)
      .where(
        and(
          eq(brainDocuments.id, documentId),
          eq(brainDocuments.workspaceId, workspaceId),
          eq(brainDocuments.userId, session.user.id),
          eq(brainDocuments.scope, "personal"),
          isNull(brainDocuments.parentDocumentId)
        )
      )
      .returning();

    if (!parentDoc) return [null];

    if (hasContentUpdate) {
      await tx
        .delete(brainDocuments)
        .where(eq(brainDocuments.parentDocumentId, documentId));

      if (nextContent && shouldChunk) {
        const chunkBaseTitle = nextTitle ?? parentDoc.title;
        const chunks = buildDocumentChunks(chunkBaseTitle, nextContent);
        const chunkRows: typeof brainDocuments.$inferInsert[] = [];
        for (const chunk of chunks) {
          const chunkEmbedding = await generateEmbedding(buildChunkEmbeddingText(chunk.content));
          chunkRows.push({
            workspaceId,
            userId: session.user.id,
            scope: "personal",
            title: chunk.title,
            content: chunk.content,
            embedding: chunkEmbedding,
            parentDocumentId: parentDoc.id,
            chunkIndex: chunk.chunkIndex,
            fileUrl: null,
            fileType: null,
            fileName: null,
          });
        }
        if (chunkRows.length > 0) {
          await tx.insert(brainDocuments).values(chunkRows);
        }
      }
    } else if (nextTitle !== undefined) {
      const chunks = await tx
        .select({
          id: brainDocuments.id,
          chunkIndex: brainDocuments.chunkIndex,
        })
        .from(brainDocuments)
        .where(eq(brainDocuments.parentDocumentId, documentId))
        .orderBy(asc(brainDocuments.chunkIndex));

      for (const chunk of chunks) {
        const chunkIndex = chunk.chunkIndex ?? 0;
        await tx
          .update(brainDocuments)
          .set({ title: `${nextTitle} (Chunk ${chunkIndex + 1})`, updatedAt: new Date() })
          .where(eq(brainDocuments.id, chunk.id));
      }
    }

    return [parentDoc];
  });

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

// DELETE /api/workspaces/[id]/brain/[did] -- Delete Brain document
export async function DELETE(_request: Request, { params }: Params) {
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
        eq(brainDocuments.userId, session.user.id),
        eq(brainDocuments.scope, "personal"),
        isNull(brainDocuments.parentDocumentId)
      )
    )
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
