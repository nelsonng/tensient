import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { tasks, taskFeedbackLinks, feedbackSubmissions, users } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getWorkspaceMembership } from "@/lib/auth/workspace-access";
import { withErrorTracking } from "@/lib/api-handler";

type Params = { params: Promise<{ id: string }> };

const VALID_STATUSES = ["backlog", "todo", "in_progress", "in_review", "testing", "done"] as const;
type TaskStatus = (typeof VALID_STATUSES)[number];
const VALID_PRIORITIES = ["critical", "high", "medium", "low"] as const;
type TaskPriority = (typeof VALID_PRIORITIES)[number];

// GET /api/tasks/[id]?workspaceId=...
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

  const [task] = await db
    .select({
      id: tasks.id,
      workspaceId: tasks.workspaceId,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      priority: tasks.priority,
      assigneeId: tasks.assigneeId,
      assigneeFirstName: users.firstName,
      assigneeLastName: users.lastName,
      assigneeEmail: users.email,
      createdById: tasks.createdById,
      position: tasks.position,
      dueDate: tasks.dueDate,
      archivedAt: tasks.archivedAt,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
    })
    .from(tasks)
    .leftJoin(users, eq(users.id, tasks.assigneeId))
    .where(and(eq(tasks.id, id), eq(tasks.workspaceId, workspaceId)))
    .limit(1);

  if (!task) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Load linked feedback
  const linkedFeedback = await db
    .select({
      linkId: taskFeedbackLinks.id,
      relationship: taskFeedbackLinks.relationship,
      feedbackId: feedbackSubmissions.id,
      feedbackSubject: feedbackSubmissions.subject,
      feedbackStatus: feedbackSubmissions.status,
      feedbackCategory: feedbackSubmissions.category,
      feedbackPriority: feedbackSubmissions.priority,
      feedbackCreatedAt: feedbackSubmissions.createdAt,
    })
    .from(taskFeedbackLinks)
    .innerJoin(feedbackSubmissions, eq(feedbackSubmissions.id, taskFeedbackLinks.feedbackSubmissionId))
    .where(eq(taskFeedbackLinks.taskId, id));

  return NextResponse.json({
    ...task,
    dueDate: task.dueDate?.toISOString() ?? null,
    archivedAt: task.archivedAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    linkedFeedback: linkedFeedback.map((f) => ({
      ...f,
      feedbackCreatedAt: f.feedbackCreatedAt.toISOString(),
    })),
  });
}

// PATCH /api/tasks/[id]?workspaceId=...
async function patchHandler(request: Request, { params }: Params) {
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

  const body = await request.json();
  const { title, description, status, priority, assigneeId, position, dueDate, archive, unarchive } = body ?? {};

  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (priority !== undefined && priority !== null && !VALID_PRIORITIES.includes(priority)) {
    return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
  }

  const updateValues: Record<string, unknown> = { updatedAt: new Date() };
  if (title !== undefined) updateValues.title = title.trim();
  if (description !== undefined) updateValues.description = description?.trim() ?? null;
  if (status !== undefined) updateValues.status = status as TaskStatus;
  if (priority !== undefined) updateValues.priority = (priority as TaskPriority) ?? null;
  if (assigneeId !== undefined) updateValues.assigneeId = assigneeId ?? null;
  if (position !== undefined) updateValues.position = position;
  if (dueDate !== undefined) updateValues.dueDate = dueDate ? new Date(dueDate) : null;
  if (archive === true) updateValues.archivedAt = new Date();
  if (unarchive === true) updateValues.archivedAt = null;

  if (Object.keys(updateValues).length === 1) {
    return NextResponse.json({ error: "Provide at least one field to update" }, { status: 400 });
  }

  const [row] = await db
    .update(tasks)
    .set(updateValues)
    .where(and(eq(tasks.id, id), eq(tasks.workspaceId, workspaceId)))
    .returning();

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...row,
    dueDate: row.dueDate?.toISOString() ?? null,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

// DELETE /api/tasks/[id]?workspaceId=...
async function deleteHandler(request: Request, { params }: Params) {
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

  const [deleted] = await db
    .delete(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.workspaceId, workspaceId)))
    .returning({ id: tasks.id });

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}

export const GET = withErrorTracking("Get task", getHandler);
export const PATCH = withErrorTracking("Update task", patchHandler);
export const DELETE = withErrorTracking("Delete task", deleteHandler);
