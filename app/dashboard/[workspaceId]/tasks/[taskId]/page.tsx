import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { memberships, tasks, taskFeedbackLinks, feedbackSubmissions, users, workspacePeople } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { TaskDetailClient } from "./task-detail-client";
import { listAssignablePeople } from "@/lib/tasks/assignees";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string; taskId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const { workspaceId, taskId } = await params;

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

  const [task] = await db
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
    .where(and(eq(tasks.id, taskId), eq(tasks.workspaceId, workspaceId)))
    .limit(1);

  if (!task) redirect(`/dashboard/${workspaceId}/tasks`);

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
    .where(eq(taskFeedbackLinks.taskId, taskId));

  const assignees = await listAssignablePeople(workspaceId);

  return (
    <TaskDetailClient
      workspaceId={workspaceId}
      task={{
        ...task,
        dueDate: task.dueDate?.toISOString() ?? null,
        archivedAt: task.archivedAt?.toISOString() ?? null,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
      }}
      initialLinkedFeedback={linkedFeedback.map((f) => ({
        ...f,
        feedbackCreatedAt: f.feedbackCreatedAt.toISOString(),
      }))}
      assignees={assignees}
    />
  );
}
