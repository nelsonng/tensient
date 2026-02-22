import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { brainDocuments, synthesisCommits, synthesisDocumentVersions } from "@/lib/db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getWorkspaceMembership } from "@/lib/auth/workspace-access";
import { generateEmbedding } from "@/lib/ai";

type Params = { params: Promise<{ workspaceId: string; documentId: string }> };

// GET /api/workspaces/[workspaceId]/synthesis/documents/[documentId]
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
        eq(brainDocuments.scope, "synthesis"),
        isNull(brainDocuments.userId)
      )
    )
    .limit(1);

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(doc);
}

// PATCH /api/workspaces/[workspaceId]/synthesis/documents/[documentId]
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
    if (body.content) {
      updates.embedding = await generateEmbedding(String(body.content).slice(0, 8000));
    } else {
      updates.embedding = null;
    }
  }

  const [updated] = await db
    .update(brainDocuments)
    .set(updates)
    .where(
      and(
        eq(brainDocuments.id, documentId),
        eq(brainDocuments.workspaceId, workspaceId),
        eq(brainDocuments.scope, "synthesis"),
        isNull(brainDocuments.userId)
      )
    )
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

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
      summary: `Manual edit: ${updated.title}`,
      trigger: "manual",
      signalCount: 0,
    })
    .returning({ id: synthesisCommits.id });

  await db.insert(synthesisDocumentVersions).values({
    documentId: updated.id,
    commitId: manualCommit.id,
    title: updated.title,
    content: updated.content ?? "",
    changeType: "modified",
  });

  return NextResponse.json(updated);
}

// DELETE /api/workspaces/[workspaceId]/synthesis/documents/[documentId]
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
        eq(brainDocuments.scope, "synthesis"),
        isNull(brainDocuments.userId)
      )
    )
    .returning({
      id: brainDocuments.id,
      title: brainDocuments.title,
      content: brainDocuments.content,
    });

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

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
      summary: `Manual delete: ${deleted.title}`,
      trigger: "manual",
      signalCount: 0,
    })
    .returning({ id: synthesisCommits.id });

  await db.insert(synthesisDocumentVersions).values({
    documentId: deleted.id,
    commitId: manualCommit.id,
    title: deleted.title,
    content: deleted.content ?? "",
    changeType: "deleted",
  });

  return NextResponse.json({ success: true });
}
