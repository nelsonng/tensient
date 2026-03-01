import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users, workspaces, memberships } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "@/lib/utils";
import { trackEvent } from "@/lib/platform-events";
import { logger } from "@/lib/logger";
import { withErrorTracking } from "@/lib/api-handler";

async function postHandler(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name } = await request.json();

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Workspace name is required" },
        { status: 400 }
      );
    }

    if (name.trim().length > 100) {
      return NextResponse.json(
        { error: "Workspace name must be 100 characters or fewer" },
        { status: 400 }
      );
    }

    const [user] = await db
      .select({ organizationId: users.organizationId })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user?.organizationId) {
      return NextResponse.json(
        { error: "No organization found" },
        { status: 400 }
      );
    }

    const [workspace] = await db
      .insert(workspaces)
      .values({
        name: name.trim(),
        organizationId: user.organizationId,
        joinCode: nanoid(8),
      })
      .returning();

    await db.insert(memberships).values({
      userId: session.user.id,
      workspaceId: workspace.id,
      role: "owner",
    });

    trackEvent("workspace_created", {
      userId: session.user.id,
      workspaceId: workspace.id,
      organizationId: user.organizationId,
      metadata: { name: workspace.name },
    });

    return NextResponse.json({
      id: workspace.id,
      name: workspace.name,
      joinCode: workspace.joinCode,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    logger.error("Create workspace failed", { error: message });
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

export const POST = withErrorTracking("Create workspace", postHandler);
