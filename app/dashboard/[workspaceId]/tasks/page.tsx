import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { memberships, tasks, users, workspacePeople } from "@/lib/db/schema";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { TasksClient } from "./tasks-client";
import { listAssignablePeople } from "@/lib/tasks/assignees";

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

  const [assignees, rows] = await Promise.all([
    listAssignablePeople(workspaceId),
    db
      .select({
        id: tasks.id,
        workspaceId: tasks.workspaceId,
        title: tasks.title,
        description: tasks.description,
        status: tasks.status,
        priority: tasks.priority,
        assigneeId: tasks.assigneeId,
        assigneePersonId: tasks.assigneePersonId,
        assigneeDisplayName: workspacePeople.displayName,
        assigneePersonEmail: workspacePeople.email,
        assigneeUserId: workspacePeople.userId,
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
      .leftJoin(workspacePeople, eq(workspacePeople.id, tasks.assigneePersonId))
      .leftJoin(users, eq(users.id, tasks.assigneeId))
      .where(and(eq(tasks.workspaceId, workspaceId), isNull(tasks.archivedAt)))
      .orderBy(asc(tasks.position), desc(tasks.createdAt)),
  ]);

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
      assignees={assignees}
    />
  );
}
