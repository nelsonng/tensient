import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getWorkspaceMembership } from "@/lib/auth/workspace-access";

/**
 * GET /api/slack/install?workspaceId=...
 *
 * Initiates the Slack OAuth flow. Redirects to Slack's authorize URL.
 * The `state` param carries a signed (HMAC-SHA256) workspaceId so the
 * callback can verify it hasn't been tampered with.
 *
 * Required env vars: SLACK_CLIENT_ID, NEXTAUTH_URL / NEXT_PUBLIC_APP_URL
 */
async function sign(workspaceId: string): Promise<string> {
  const secret = process.env.NEXTAUTH_SECRET ?? "";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(workspaceId)
  );
  const hex = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${workspaceId}.${hex}`;
}

export async function GET(request: Request) {
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

  const clientId = process.env.SLACK_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "Slack integration is not configured (SLACK_CLIENT_ID missing)" },
      { status: 503 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const redirectUri = `${appUrl}/api/slack/oauth/callback`;
  const state = await sign(workspaceId);

  const slackUrl = new URL("https://slack.com/oauth/v2/authorize");
  slackUrl.searchParams.set("client_id", clientId);
  slackUrl.searchParams.set("scope", "chat:write,chat:write.public,channels:read,channels:history,users:read");
  slackUrl.searchParams.set("redirect_uri", redirectUri);
  slackUrl.searchParams.set("state", state);

  return NextResponse.redirect(slackUrl.toString());
}
