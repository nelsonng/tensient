import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { feedbackSubmissions } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { getWorkspaceMembership } from "@/lib/auth/workspace-access";
import { withErrorTracking } from "@/lib/api-handler";

// POST /api/feedback/bulk
// Body: { ids: string[], action: "archive" | "unarchive" | "delete", workspaceId: string }
async function postHandler(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { ids, action, workspaceId } = body ?? {};

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids must be a non-empty array" }, { status: 400 });
  }
  if (!["archive", "unarchive", "delete"].includes(action)) {
    return NextResponse.json({ error: "action must be archive, unarchive, or delete" }, { status: 400 });
  }
  if (ids.length > 200) {
    return NextResponse.json({ error: "Cannot bulk-act on more than 200 items at once" }, { status: 400 });
  }

  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const whereClause = and(
    eq(feedbackSubmissions.workspaceId, workspaceId),
    inArray(feedbackSubmissions.id, ids)
  );

  if (action === "delete") {
    const deleted = await db
      .delete(feedbackSubmissions)
      .where(whereClause)
      .returning({ id: feedbackSubmissions.id });
    return NextResponse.json({ affected: deleted.length });
  }

  const updated = await db
    .update(feedbackSubmissions)
    .set({
      archivedAt: action === "archive" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(whereClause)
    .returning({ id: feedbackSubmissions.id });

  return NextResponse.json({ affected: updated.length });
}

export const POST = withErrorTracking("Bulk feedback action", postHandler);
