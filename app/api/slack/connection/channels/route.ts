import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { slackConnections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getWorkspaceMembership } from "@/lib/auth/workspace-access";
import { WebClient } from "@slack/web-api";
import { withErrorTracking } from "@/lib/api-handler";

// GET /api/slack/connection/channels?workspaceId=...
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
    .select({ botToken: slackConnections.botToken })
    .from(slackConnections)
    .where(eq(slackConnections.workspaceId, workspaceId))
    .limit(1);

  if (!conn) {
    return NextResponse.json({ channels: [] });
  }

  try {
    const client = new WebClient(conn.botToken);
    const result = await client.conversations.list({
      types: "public_channel",
      exclude_archived: true,
      limit: 200,
    });

    const channels = ((result.channels ?? []) as Array<{ id: string; name: string }>).map((c) => ({
      id: c.id,
      name: c.name,
    }));

    return NextResponse.json({ channels });
  } catch {
    return NextResponse.json({ channels: [] });
  }
}

export const GET = withErrorTracking("List Slack channels", getHandler);
