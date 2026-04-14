import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  feedbackSubmissions,
  feedbackReplies,
  memberships,
  taskFeedbackLinks,
  tasks,
  users,
} from "@/lib/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { FeedbackDetailClient } from "./feedback-detail-client";

export default async function FeedbackDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string; feedbackId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const { workspaceId, feedbackId } = await params;

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

  const [submission] = await db
    .select({
      id: feedbackSubmissions.id,
      trackingId: feedbackSubmissions.trackingId,
      workspaceId: feedbackSubmissions.workspaceId,
      category: feedbackSubmissions.category,
      subject: feedbackSubmissions.subject,
      description: feedbackSubmissions.description,
      status: feedbackSubmissions.status,
      priority: feedbackSubmissions.priority,
      aiPriority: feedbackSubmissions.aiPriority,
      aiSummary: feedbackSubmissions.aiSummary,
      aiResponseDraft: feedbackSubmissions.aiResponseDraft,
      sentimentScore: feedbackSubmissions.sentimentScore,
      duplicateOfId: feedbackSubmissions.duplicateOfId,
      signalId: feedbackSubmissions.signalId,
      submitterEmail: feedbackSubmissions.submitterEmail,
      submitterName: feedbackSubmissions.submitterName,
      submitterExternalId: feedbackSubmissions.submitterExternalId,
      submitterIsAuthenticated: feedbackSubmissions.submitterIsAuthenticated,
      submitterMeta: feedbackSubmissions.submitterMeta,
      assigneeId: feedbackSubmissions.assigneeId,
      assigneeFirstName: users.firstName,
      assigneeLastName: users.lastName,
      assigneeEmail: users.email,
      currentUrl: feedbackSubmissions.currentUrl,
      referrerUrl: feedbackSubmissions.referrerUrl,
      pageTitle: feedbackSubmissions.pageTitle,
      userAgent: feedbackSubmissions.userAgent,
      locale: feedbackSubmissions.locale,
      timezone: feedbackSubmissions.timezone,
      ipAddress: feedbackSubmissions.ipAddress,
      geoCity: feedbackSubmissions.geoCity,
      geoRegion: feedbackSubmissions.geoRegion,
      geoCountry: feedbackSubmissions.geoCountry,
      browserInfo: feedbackSubmissions.browserInfo,
      screenInfo: feedbackSubmissions.screenInfo,
      consoleErrors: feedbackSubmissions.consoleErrors,
      customContext: feedbackSubmissions.customContext,
      tags: feedbackSubmissions.tags,
      ratingValue: feedbackSubmissions.ratingValue,
      ratingScale: feedbackSubmissions.ratingScale,
      ratingType: feedbackSubmissions.ratingType,
      responses: feedbackSubmissions.responses,
      createdAt: feedbackSubmissions.createdAt,
      updatedAt: feedbackSubmissions.updatedAt,
    })
    .from(feedbackSubmissions)
    .leftJoin(users, eq(users.id, feedbackSubmissions.assigneeId))
    .where(
      and(
        eq(feedbackSubmissions.id, feedbackId),
        eq(feedbackSubmissions.workspaceId, workspaceId)
      )
    )
    .limit(1);

  if (!submission) redirect(`/dashboard/${workspaceId}/feedback`);

  const replies = await db
    .select()
    .from(feedbackReplies)
    .where(eq(feedbackReplies.feedbackSubmissionId, feedbackId))
    .orderBy(asc(feedbackReplies.createdAt));

  const linkedTasks = await db
    .select({
      linkId: taskFeedbackLinks.id,
      relationship: taskFeedbackLinks.relationship,
      taskId: tasks.id,
      taskTitle: tasks.title,
      taskStatus: tasks.status,
      taskPriority: tasks.priority,
      taskAssigneeId: tasks.assigneeId,
      taskCreatedAt: tasks.createdAt,
    })
    .from(taskFeedbackLinks)
    .innerJoin(tasks, eq(tasks.id, taskFeedbackLinks.taskId))
    .where(eq(taskFeedbackLinks.feedbackSubmissionId, feedbackId))
    .orderBy(asc(tasks.createdAt));

  // Fetch workspace members for the assignee selector
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

  return (
    <FeedbackDetailClient
      workspaceId={workspaceId}
      submission={{
        ...submission,
        createdAt: submission.createdAt.toISOString(),
        updatedAt: submission.updatedAt.toISOString(),
      }}
      initialReplies={replies.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      }))}
      initialLinkedTasks={linkedTasks.map((t) => ({
        ...t,
        taskCreatedAt: t.taskCreatedAt.toISOString(),
      }))}
      members={members}
    />
  );
}
