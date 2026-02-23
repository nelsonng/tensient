import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { signals, conversations } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { getWorkspaceMembership } from "@/lib/auth/workspace-access";
import { generateEmbedding } from "@/lib/ai";

type Params = { params: Promise<{ workspaceId: string }> };

// GET /api/workspaces/[workspaceId]/signals
export async function GET(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await params;
  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversationId");

  const rows = await db
    .select({
      id: signals.id,
      workspaceId: signals.workspaceId,
      userId: signals.userId,
      conversationId: signals.conversationId,
      messageId: signals.messageId,
      content: signals.content,
      status: signals.status,
      aiPriority: signals.aiPriority,
      humanPriority: signals.humanPriority,
      reviewedAt: signals.reviewedAt,
      source: signals.source,
      createdAt: signals.createdAt,
      conversationTitle: conversations.title,
    })
    .from(signals)
    .innerJoin(conversations, eq(conversations.id, signals.conversationId))
    .where(
      and(
        eq(signals.workspaceId, workspaceId),
        conversationId ? eq(signals.conversationId, conversationId) : undefined
      )
    )
    .orderBy(desc(signals.createdAt));

  return NextResponse.json(rows);
}

// POST /api/workspaces/[workspaceId]/signals
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
  const {
    content,
    conversationId,
    messageId,
    aiPriority,
    humanPriority,
  }: {
    content?: string;
    conversationId?: string;
    messageId?: string;
    aiPriority?: "critical" | "high" | "medium" | "low";
    humanPriority?: "critical" | "high" | "medium" | "low";
  } = body ?? {};

  if (!content?.trim() || !conversationId || !messageId) {
    return NextResponse.json(
      { error: "content, conversationId, and messageId are required" },
      { status: 400 }
    );
  }

  const embedding = await generateEmbedding(content.slice(0, 2000));

  const [row] = await db
    .insert(signals)
    .values({
      workspaceId,
      userId: session.user.id,
      conversationId,
      messageId,
      content: content.trim(),
      embedding,
      aiPriority: aiPriority ?? null,
      humanPriority: humanPriority ?? null,
      reviewedAt: humanPriority ? new Date() : null,
      source: "web",
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
