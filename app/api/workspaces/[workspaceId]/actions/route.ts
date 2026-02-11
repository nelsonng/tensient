import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { actions } from "@/lib/db/schema";
import { getWorkspaceMembership } from "@/lib/auth/workspace-access";
import { trackEvent } from "@/lib/platform-events";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await params;

  // Verify workspace membership
  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { title, description, priority, goalId } = await request.json();

  if (!title || title.trim().length < 2) {
    return NextResponse.json(
      { error: "Action title must be at least 2 characters" },
      { status: 400 }
    );
  }

  try {
    const [action] = await db
      .insert(actions)
      .values({
        workspaceId,
        userId: session.user.id,
        title: title.trim(),
        description: description?.trim() || null,
        priority: priority || "medium",
        goalId: goalId || null,
        status: "open",
      })
      .returning();

    trackEvent("action_created", {
      userId: session.user.id,
      workspaceId,
      metadata: { title: title.trim(), priority: priority || "medium" },
    });

    return NextResponse.json(action);
  } catch (error) {
    trackEvent("api_error", {
      userId: session.user.id,
      workspaceId,
      metadata: { route: "/api/workspaces/*/actions", error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json(
      { error: "Failed to create action" },
      { status: 500 }
    );
  }
}
