import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { brainDocuments } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getWorkspaceMembership } from "@/lib/auth/workspace-access";
import { generateEmbedding } from "@/lib/ai";
import { logger } from "@/lib/logger";

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
        eq(brainDocuments.scope, "personal")
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

  if (body.title !== undefined) updates.title = body.title;
  if (body.content !== undefined) {
    updates.content = body.content;
    // Re-generate embedding when content changes
    try {
      if (body.content) {
        updates.embedding = await generateEmbedding(body.content.slice(0, 8000));
      }
    } catch (error) {
      logger.error("Embedding generation failed on update", { error: String(error) });
    }
  }

  const [updated] = await db
    .update(brainDocuments)
    .set(updates)
    .where(
      and(
        eq(brainDocuments.id, documentId),
        eq(brainDocuments.workspaceId, workspaceId),
        eq(brainDocuments.userId, session.user.id),
        eq(brainDocuments.scope, "personal")
      )
    )
    .returning();

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
        eq(brainDocuments.scope, "personal")
      )
    )
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
