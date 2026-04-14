import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { feedbackSubmissions, memberships, users } from "@/lib/db/schema";
import { and, desc, eq, ilike, isNotNull, isNull, or, SQL } from "drizzle-orm";
import { getWorkspaceMembership } from "@/lib/auth/workspace-access";
import { withErrorTracking } from "@/lib/api-handler";

// GET /api/feedback?workspaceId=...&status=...&category=...&priority=...&search=...
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
  const category = url.searchParams.get("category");
  const priority = url.searchParams.get("priority");
  const search = url.searchParams.get("search");
  const archived = url.searchParams.get("archived") === "true";

  const conditions: SQL[] = [
    eq(feedbackSubmissions.workspaceId, workspaceId),
    archived ? isNotNull(feedbackSubmissions.archivedAt) : isNull(feedbackSubmissions.archivedAt),
  ];

  const validStatuses = [
    "new",
    "reviewing",
    "awaiting_response",
    "escalated",
    "auto_responded",
    "converted",
    "resolved",
    "spam",
  ];
  if (status && validStatuses.includes(status)) {
    conditions.push(
      eq(
        feedbackSubmissions.status,
        status as
          | "new"
          | "reviewing"
          | "awaiting_response"
          | "escalated"
          | "auto_responded"
          | "converted"
          | "resolved"
          | "spam"
      )
    );
  }

  const validCategories = ["bug_report", "feature_request", "help_request", "urgent_issue"];
  if (category && validCategories.includes(category)) {
    conditions.push(
      eq(
        feedbackSubmissions.category,
        category as "bug_report" | "feature_request" | "help_request" | "urgent_issue"
      )
    );
  }

  const validPriorities = ["critical", "high", "medium", "low"];
  if (priority && validPriorities.includes(priority)) {
    conditions.push(
      eq(
        feedbackSubmissions.priority,
        priority as "critical" | "high" | "medium" | "low"
      )
    );
  }

  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(feedbackSubmissions.subject, pattern),
        ilike(feedbackSubmissions.description, pattern),
        ilike(feedbackSubmissions.submitterEmail, pattern)
      )!
    );
  }

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
      archivedAt: feedbackSubmissions.archivedAt,
    })
    .from(feedbackSubmissions)
    .leftJoin(users, eq(users.id, feedbackSubmissions.assigneeId))
    .where(and(...conditions))
    .orderBy(desc(feedbackSubmissions.createdAt));

  return NextResponse.json(
    rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      archivedAt: row.archivedAt?.toISOString() ?? null,
    }))
  );
}

export const GET = withErrorTracking("List feedback", getHandler);
