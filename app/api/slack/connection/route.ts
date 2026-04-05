import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { slackConnections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getWorkspaceMembership } from "@/lib/auth/workspace-access";
import { withErrorTracking } from "@/lib/api-handler";

// GET /api/slack/connection?workspaceId=...
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

  const [conn] = await db
    .select({
      id: slackConnections.id,
      slackTeamName: slackConnections.slackTeamName,
      slackChannelId: slackConnections.slackChannelId,
      slackChannelName: slackConnections.slackChannelName,
      createdAt: slackConnections.createdAt,
    })
    .from(slackConnections)
    .where(eq(slackConnections.workspaceId, workspaceId))
    .limit(1);

  if (!conn) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    ...conn,
    createdAt: conn.createdAt.toISOString(),
  });
}

// PATCH /api/slack/connection?workspaceId=... — update channel
async function patchHandler(request: Request) {
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

  const body = await request.json();
  const { channelId, channelName } = body ?? {};

  if (!channelId || !channelName) {
    return NextResponse.json({ error: "channelId and channelName required" }, { status: 400 });
  }

  const [updated] = await db
    .update(slackConnections)
    .set({ slackChannelId: channelId as string, slackChannelName: channelName as string })
    .where(eq(slackConnections.workspaceId, workspaceId))
    .returning({ id: slackConnections.id });

  if (!updated) {
    return NextResponse.json({ error: "No Slack connection found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/slack/connection?workspaceId=... — disconnect
async function deleteHandler(request: Request) {
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

  await db
    .delete(slackConnections)
    .where(eq(slackConnections.workspaceId, workspaceId));

  return NextResponse.json({ ok: true });
}

export const GET = withErrorTracking("Get Slack connection", getHandler);
export const PATCH = withErrorTracking("Update Slack channel", patchHandler);
export const DELETE = withErrorTracking("Disconnect Slack", deleteHandler);
