import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { signals, conversations } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getWorkspaceMembership } from "@/lib/auth/workspace-access";

type Params = { params: Promise<{ workspaceId: string; signalId: string }> };

// GET /api/workspaces/[workspaceId]/signals/[signalId]
export async function GET(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId, signalId } = await params;
  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [row] = await db
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
      createdAt: signals.createdAt,
      conversationTitle: conversations.title,
    })
    .from(signals)
    .innerJoin(conversations, eq(conversations.id, signals.conversationId))
    .where(and(eq(signals.id, signalId), eq(signals.workspaceId, workspaceId)))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Signal not found" }, { status: 404 });
  }

  return NextResponse.json(row);
}

// PATCH /api/workspaces/[workspaceId]/signals/[signalId]
export async function PATCH(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId, signalId } = await params;
  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const humanPriority = body?.humanPriority as
    | "critical"
    | "high"
    | "medium"
    | "low"
    | null
    | undefined;
  const status = body?.status as "open" | "resolved" | "dismissed" | undefined;

  if (
    humanPriority !== undefined &&
    humanPriority !== null &&
    !["critical", "high", "medium", "low"].includes(humanPriority)
  ) {
    return NextResponse.json({ error: "Invalid humanPriority" }, { status: 400 });
  }

  if (status !== undefined && !["open", "resolved", "dismissed"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  if (humanPriority === undefined && status === undefined) {
    return NextResponse.json(
      { error: "Provide at least one field: humanPriority or status" },
      { status: 400 }
    );
  }

  const updateValues: {
    humanPriority?: "critical" | "high" | "medium" | "low" | null;
    reviewedAt?: Date | null;
    status?: "open" | "resolved" | "dismissed";
  } = {};

  if (humanPriority !== undefined) {
    updateValues.humanPriority = humanPriority ?? null;
    updateValues.reviewedAt = humanPriority ? new Date() : null;
  }
  if (status !== undefined) {
    updateValues.status = status;
  }

  const [row] = await db
    .update(signals)
    .set(updateValues)
    .where(and(eq(signals.id, signalId), eq(signals.workspaceId, workspaceId)))
    .returning();

  if (!row) {
    return NextResponse.json({ error: "Signal not found" }, { status: 404 });
  }

  return NextResponse.json(row);
}

// DELETE /api/workspaces/[workspaceId]/signals/[signalId]
export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId, signalId } = await params;
  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [row] = await db
    .delete(signals)
    .where(and(eq(signals.id, signalId), eq(signals.workspaceId, workspaceId)))
    .returning({ id: signals.id });

  if (!row) {
    return NextResponse.json({ error: "Signal not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
