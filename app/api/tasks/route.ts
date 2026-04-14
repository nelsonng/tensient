import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { tasks, users } from "@/lib/db/schema";
import { and, asc, desc, eq, isNull, SQL } from "drizzle-orm";
import { getWorkspaceMembership } from "@/lib/auth/workspace-access";
import { withErrorTracking } from "@/lib/api-handler";

// GET /api/tasks?workspaceId=...&status=...&archived=true
async function getHandler(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const workspaceId = url.searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }

  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = url.searchParams.get("status");
  const archived = url.searchParams.get("archived") === "true";

  const where: SQL[] = [eq(tasks.workspaceId, workspaceId)];
  if (!archived) where.push(isNull(tasks.archivedAt));

  const validStatuses = ["backlog", "todo", "in_progress", "in_review", "testing", "done"] as const;
  type TaskStatus = (typeof validStatuses)[number];
  if (status && validStatuses.includes(status as TaskStatus)) {
    where.push(eq(tasks.status, status as TaskStatus));
  }

  // Alias to avoid confusion with schema users table
  const assigneeUser = users;

  const rows = await db
    .select({
      id: tasks.id,
      workspaceId: tasks.workspaceId,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      priority: tasks.priority,
      assigneeId: tasks.assigneeId,
      assigneeFirstName: assigneeUser.firstName,
      assigneeLastName: assigneeUser.lastName,
      assigneeEmail: assigneeUser.email,
      createdById: tasks.createdById,
      position: tasks.position,
      dueDate: tasks.dueDate,
      archivedAt: tasks.archivedAt,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
    })
    .from(tasks)
    .leftJoin(assigneeUser, eq(assigneeUser.id, tasks.assigneeId))
    .where(and(...where))
    .orderBy(asc(tasks.position), desc(tasks.createdAt));

  return NextResponse.json(
    rows.map((row) => ({
      ...row,
      dueDate: row.dueDate?.toISOString() ?? null,
      archivedAt: row.archivedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }))
  );
}

const VALID_STATUSES = ["backlog", "todo", "in_progress", "in_review", "testing", "done"] as const;
type TaskStatus = (typeof VALID_STATUSES)[number];
const VALID_PRIORITIES = ["critical", "high", "medium", "low"] as const;
type TaskPriority = (typeof VALID_PRIORITIES)[number];

// POST /api/tasks
async function postHandler(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { workspaceId, title, description, status, priority, assigneeId, dueDate } = body ?? {};

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }
  if (!title?.trim()) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const taskStatus: TaskStatus =
    status && VALID_STATUSES.includes(status) ? status : "backlog";

  // Position at end of column: find max position for this status
  const existing = await db
    .select({ position: tasks.position })
    .from(tasks)
    .where(and(eq(tasks.workspaceId, workspaceId), eq(tasks.status, taskStatus), isNull(tasks.archivedAt)))
    .orderBy(desc(tasks.position))
    .limit(1);

  const maxPosition = existing[0]?.position ?? 0;

  const [row] = await db
    .insert(tasks)
    .values({
      workspaceId,
      title: title.trim(),
      description: description?.trim() ?? null,
      status: taskStatus,
      priority: priority && VALID_PRIORITIES.includes(priority) ? (priority as TaskPriority) : null,
      assigneeId: assigneeId ?? null,
      createdById: session.user.id,
      position: maxPosition + 1000,
      dueDate: dueDate ? new Date(dueDate) : null,
    })
    .returning();

  return NextResponse.json({
    ...row,
    dueDate: row.dueDate?.toISOString() ?? null,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }, { status: 201 });
}

export const GET = withErrorTracking("List tasks", getHandler);
export const POST = withErrorTracking("Create task", postHandler);
