import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { feedbackReplies, feedbackSubmissions } from "@/lib/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { getWorkspaceMembership } from "@/lib/auth/workspace-access";
import { withErrorTracking } from "@/lib/api-handler";

type Params = { params: Promise<{ id: string }> };

// GET /api/feedback/[id]/replies?workspaceId=...
async function getHandler(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const url = new URL(request.url);
  const workspaceId = url.searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }

  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify submission belongs to workspace
  const [submission] = await db
    .select({ id: feedbackSubmissions.id })
    .from(feedbackSubmissions)
    .where(
      and(
        eq(feedbackSubmissions.id, id),
        eq(feedbackSubmissions.workspaceId, workspaceId)
      )
    )
    .limit(1);

  if (!submission) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rows = await db
    .select()
    .from(feedbackReplies)
    .where(eq(feedbackReplies.feedbackSubmissionId, id))
    .orderBy(asc(feedbackReplies.createdAt));

  return NextResponse.json(
    rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }))
  );
}

// POST /api/feedback/[id]/replies?workspaceId=...
async function postHandler(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const url = new URL(request.url);
  const workspaceId = url.searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }

  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [submission] = await db
    .select({ id: feedbackSubmissions.id })
    .from(feedbackSubmissions)
    .where(
      and(
        eq(feedbackSubmissions.id, id),
        eq(feedbackSubmissions.workspaceId, workspaceId)
      )
    )
    .limit(1);

  if (!submission) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const content = body?.content as string | undefined;
  const isInternal = body?.isInternal === true;

  if (!content?.trim()) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const [reply] = await db
    .insert(feedbackReplies)
    .values({
      feedbackSubmissionId: id,
      content: content.trim(),
      authorType: "team",
      authorUserId: session.user.id,
      authorName: session.user.name ?? session.user.email ?? "Team",
      isInternal,
    })
    .returning();

  // Auto-advance status to awaiting_response when team sends a visible reply
  if (!isInternal) {
    await db
      .update(feedbackSubmissions)
      .set({ status: "awaiting_response", updatedAt: new Date() })
      .where(
        and(
          eq(feedbackSubmissions.id, id),
          eq(feedbackSubmissions.workspaceId, workspaceId)
        )
      );
  }

  return NextResponse.json({ ...reply, createdAt: reply.createdAt.toISOString() }, { status: 201 });
}

export const GET = withErrorTracking("Get feedback replies", getHandler);
export const POST = withErrorTracking("Add feedback reply", postHandler);
