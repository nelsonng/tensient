import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { workspaces, memberships } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { trackEvent } from "@/lib/platform-events";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { joinCode } = await request.json();

    if (!joinCode || typeof joinCode !== "string" || joinCode.trim().length === 0) {
      return NextResponse.json(
        { error: "Join code is required" },
        { status: 400 }
      );
    }

    const [workspace] = await db
      .select({ id: workspaces.id, name: workspaces.name })
      .from(workspaces)
      .where(eq(workspaces.joinCode, joinCode.trim()))
      .limit(1);

    if (!workspace) {
      return NextResponse.json(
        { error: "Invalid join code" },
        { status: 404 }
      );
    }

    const [existing] = await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(
          eq(memberships.userId, session.user.id),
          eq(memberships.workspaceId, workspace.id)
        )
      )
      .limit(1);

    if (existing) {
      return NextResponse.json({
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        alreadyMember: true,
      });
    }

    await db.insert(memberships).values({
      userId: session.user.id,
      workspaceId: workspace.id,
      role: "member",
    });

    trackEvent("workspace_joined", {
      userId: session.user.id,
      workspaceId: workspace.id,
      metadata: { joinCode: joinCode.trim() },
    });

    return NextResponse.json({
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      alreadyMember: false,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    logger.error("Join workspace failed", { error: message });
    trackEvent("api_error", {
      metadata: { route: "/api/workspaces/join", error: message },
    });
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
