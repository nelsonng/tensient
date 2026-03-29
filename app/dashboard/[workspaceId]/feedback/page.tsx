import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { feedbackSubmissions, memberships, users } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { FeedbackListClient } from "./feedback-list-client";

export default async function FeedbackPage({
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

  const rows = await db
    .select({
      id: feedbackSubmissions.id,
      trackingId: feedbackSubmissions.trackingId,
      category: feedbackSubmissions.category,
      subject: feedbackSubmissions.subject,
      status: feedbackSubmissions.status,
      priority: feedbackSubmissions.priority,
      aiPriority: feedbackSubmissions.aiPriority,
      submitterEmail: feedbackSubmissions.submitterEmail,
      submitterName: feedbackSubmissions.submitterName,
      submitterExternalId: feedbackSubmissions.submitterExternalId,
      submitterIsAuthenticated: feedbackSubmissions.submitterIsAuthenticated,
      assigneeId: feedbackSubmissions.assigneeId,
      assigneeFirstName: users.firstName,
      assigneeLastName: users.lastName,
      assigneeEmail: users.email,
      createdAt: feedbackSubmissions.createdAt,
      updatedAt: feedbackSubmissions.updatedAt,
    })
    .from(feedbackSubmissions)
    .leftJoin(users, eq(users.id, feedbackSubmissions.assigneeId))
    .where(eq(feedbackSubmissions.workspaceId, workspaceId))
    .orderBy(desc(feedbackSubmissions.createdAt))
    .catch(() => null);

  if (!rows) {
    return (
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="rounded-lg border border-border bg-panel p-6">
          <h1 className="font-display text-xl font-bold text-foreground">
            Feedback Setup Required
          </h1>
          <p className="mt-2 text-sm text-muted">
            Feedback tables are not yet available. Apply the latest schema migration first.
          </p>
        </div>
      </div>
    );
  }

  return (
    <FeedbackListClient
      workspaceId={workspaceId}
      rows={rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }))}
    />
  );
}
