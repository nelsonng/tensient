import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { taskFeedbackLinks, tasks, feedbackSubmissions } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getWorkspaceMembership } from "@/lib/auth/workspace-access";
import { withErrorTracking } from "@/lib/api-handler";

type Params = { params: Promise<{ id: string }> };

// POST /api/tasks/[id]/feedback-links?workspaceId=...
// Body: { feedbackSubmissionId: string, relationship?: "related" | "blocks" }
async function postHandler(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: taskId } = await params;
  const url = new URL(request.url);
  const workspaceId = url.searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }

  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { feedbackSubmissionId, relationship } = body ?? {};
  if (!feedbackSubmissionId) {
    return NextResponse.json({ error: "feedbackSubmissionId required" }, { status: 400 });
  }

  // Verify task belongs to workspace
  const [task] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.workspaceId, workspaceId)))
    .limit(1);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  // Verify feedback belongs to workspace
  const [feedback] = await db
    .select({ id: feedbackSubmissions.id })
    .from(feedbackSubmissions)
    .where(and(eq(feedbackSubmissions.id, feedbackSubmissionId), eq(feedbackSubmissions.workspaceId, workspaceId)))
    .limit(1);
  if (!feedback) {
    return NextResponse.json({ error: "Feedback not found" }, { status: 404 });
  }

  const validRelationships = ["related", "blocks"] as const;
  const rel = relationship && validRelationships.includes(relationship) ? relationship : "related";

  const [link] = await db
    .insert(taskFeedbackLinks)
    .values({ taskId, feedbackSubmissionId, relationship: rel })
    .onConflictDoUpdate({
      target: [taskFeedbackLinks.taskId, taskFeedbackLinks.feedbackSubmissionId],
      set: { relationship: rel },
    })
    .returning();

  return NextResponse.json(link, { status: 201 });
}

// DELETE /api/tasks/[id]/feedback-links?workspaceId=...&feedbackSubmissionId=...
async function deleteHandler(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: taskId } = await params;
  const url = new URL(request.url);
  const workspaceId = url.searchParams.get("workspaceId");
  const feedbackSubmissionId = url.searchParams.get("feedbackSubmissionId");
  if (!workspaceId || !feedbackSubmissionId) {
    return NextResponse.json({ error: "workspaceId and feedbackSubmissionId required" }, { status: 400 });
  }

  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [deleted] = await db
    .delete(taskFeedbackLinks)
    .where(
      and(
        eq(taskFeedbackLinks.taskId, taskId),
        eq(taskFeedbackLinks.feedbackSubmissionId, feedbackSubmissionId)
      )
    )
    .returning({ id: taskFeedbackLinks.id });

  if (!deleted) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}

export const POST = withErrorTracking("Link feedback to task", postHandler);
export const DELETE = withErrorTracking("Unlink feedback from task", deleteHandler);
