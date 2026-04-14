import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { memberships, tasks, users } from "@/lib/db/schema";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { TasksClient } from "./tasks-client";

export default async function TasksPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const { workspaceId } = await params;

  const [membership] = await db
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, session.user.id),
        eq(memberships.workspaceId, workspaceId)
      )
    )
    .limit(1);

  if (!membership) redirect("/sign-in");

  // Load workspace members for assignee dropdowns
  const members = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.workspaceId, workspaceId));

  const rows = await db
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
    .where(and(eq(tasks.workspaceId, workspaceId), isNull(tasks.archivedAt)))
    .orderBy(asc(tasks.position), desc(tasks.createdAt));

  return (
    <TasksClient
      workspaceId={workspaceId}
      initialRows={rows.map((row) => ({
        ...row,
        dueDate: row.dueDate?.toISOString() ?? null,
        archivedAt: row.archivedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }))}
      members={members}
    />
  );
}
