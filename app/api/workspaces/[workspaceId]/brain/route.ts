import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { brainDocuments } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getWorkspaceMembership } from "@/lib/auth/workspace-access";
import { generateEmbedding } from "@/lib/ai";
import { extractTextFromFile } from "@/lib/extract-text";
import { trackEvent } from "@/lib/platform-events";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ workspaceId: string }> };

// GET /api/workspaces/[id]/brain -- List personal Brain documents
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
        eq(brainDocuments.userId, session.user.id),
        eq(brainDocuments.scope, "personal")
      )
    )
    .orderBy(desc(brainDocuments.updatedAt));

  return NextResponse.json(docs);
}

// POST /api/workspaces/[id]/brain -- Create Brain document
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
  const { title, content, fileUrl, fileType, fileName } = body;

  if (!title || typeof title !== "string") {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  try {
    // If a file was uploaded, extract text content
    let resolvedContent = content || "";
    if (fileUrl && fileType && !content) {
      const extracted = await extractTextFromFile(fileUrl, fileType);
      resolvedContent = extracted || "";
    }

    // Generate embedding from content
    const embedding = resolvedContent
      ? await generateEmbedding(resolvedContent.slice(0, 8000))
      : null;

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
      })
      .returning();

    trackEvent("brain_document_created", {
      userId: session.user.id,
      workspaceId,
      metadata: { documentId: doc.id, hasFile: !!fileUrl },
    });

    return NextResponse.json(doc, { status: 201 });
  } catch (error) {
    logger.error("Brain document creation failed", { error: String(error) });
    return NextResponse.json(
      { error: "Failed to create document" },
      { status: 500 }
    );
  }
}
