import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { feedbackSubmissions, memberships, users } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getWorkspaceMembership } from "@/lib/auth/workspace-access";
import { withErrorTracking } from "@/lib/api-handler";

type Params = { params: Promise<{ id: string }> };

// GET /api/feedback/[id]
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

  const [row] = await db
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
        eq(feedbackSubmissions.id, id),
        eq(feedbackSubmissions.workspaceId, workspaceId)
      )
    )
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

const VALID_STATUSES = [
  "new",
  "reviewing",
  "awaiting_response",
  "escalated",
  "auto_responded",
  "converted",
  "resolved",
  "spam",
] as const;
type FeedbackStatus = (typeof VALID_STATUSES)[number];

const VALID_PRIORITIES = ["critical", "high", "medium", "low"] as const;
type FeedbackPriority = (typeof VALID_PRIORITIES)[number];

// PATCH /api/feedback/[id]
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
  const { status, priority, assigneeId, duplicateOfId, signalId } = body ?? {};

  if (
    status !== undefined &&
    !VALID_STATUSES.includes(status as FeedbackStatus)
  ) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  if (
    priority !== undefined &&
    priority !== null &&
    !VALID_PRIORITIES.includes(priority as FeedbackPriority)
  ) {
    return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
  }

  const updateValues: Partial<{
    status: FeedbackStatus;
    priority: FeedbackPriority | null;
    assigneeId: string | null;
    duplicateOfId: string | null;
    signalId: string | null;
    updatedAt: Date;
  }> = { updatedAt: new Date() };

  if (status !== undefined) updateValues.status = status as FeedbackStatus;
  if (priority !== undefined) updateValues.priority = (priority as FeedbackPriority) ?? null;
  if (assigneeId !== undefined) updateValues.assigneeId = (assigneeId as string) ?? null;
  if (duplicateOfId !== undefined) updateValues.duplicateOfId = (duplicateOfId as string) ?? null;
  if (signalId !== undefined) updateValues.signalId = (signalId as string) ?? null;

  if (Object.keys(updateValues).length === 1) {
    return NextResponse.json(
      { error: "Provide at least one field to update" },
      { status: 400 }
    );
  }

  const [row] = await db
    .update(feedbackSubmissions)
    .set(updateValues)
    .where(
      and(
        eq(feedbackSubmissions.id, id),
        eq(feedbackSubmissions.workspaceId, workspaceId)
      )
    )
    .returning();

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

export const GET = withErrorTracking("Get feedback submission", getHandler);
export const PATCH = withErrorTracking("Update feedback submission", patchHandler);
