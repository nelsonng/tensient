import { NextResponse } from "next/server";
import { WebClient } from "@slack/web-api";
import { db } from "@/lib/db";
import { slackConnections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { logger } from "@/lib/logger";

/**
 * GET /api/slack/oauth/callback?code=...&state=...
 *
 * Slack redirects here after the user authorises the app install.
 * We verify the state HMAC, exchange the code for tokens, and upsert
 * the connection record, then redirect to the integrations page.
 */

async function verifyState(state: string): Promise<string | null> {
  const dotIndex = state.lastIndexOf(".");
  if (dotIndex === -1) return null;

  const workspaceId = state.slice(0, dotIndex);
  const receivedHex = state.slice(dotIndex + 1);

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
  const expectedHex = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (expectedHex !== receivedHex) return null;
  return workspaceId;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    logger.error("Slack OAuth denied", { error });
    return NextResponse.redirect(
      new URL(`/dashboard?slack_error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard?slack_error=missing_params", request.url)
    );
  }

  const workspaceId = await verifyState(state);
  if (!workspaceId) {
    return NextResponse.redirect(
      new URL("/dashboard?slack_error=invalid_state", request.url)
    );
  }

  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    logger.error("Slack env vars not set");
    return NextResponse.redirect(
      new URL(`/dashboard/${workspaceId}/integrations?slack_error=not_configured`, request.url)
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const redirectUri = `${appUrl}/api/slack/oauth/callback`;

  try {
    const client = new WebClient();
    const oauthResult = await client.oauth.v2.access({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    });

    if (!oauthResult.ok || !oauthResult.access_token) {
      throw new Error(oauthResult.error ?? "oauth.v2.access failed");
    }

    const botToken = oauthResult.access_token;
    const slackTeamId = (oauthResult.team as { id: string } | undefined)?.id ?? "";
    const slackTeamName = (oauthResult.team as { name: string } | undefined)?.name ?? "";

    // Pick the channel the bot was added to, or default to #general
    const botClient = new WebClient(botToken);
    const channelsResult = await botClient.conversations.list({
      types: "public_channel",
      exclude_archived: true,
      limit: 200,
    });

    const channels = (channelsResult.channels ?? []) as Array<{ id: string; name: string; is_member?: boolean }>;
    // Prefer a channel named "feedback", then first channel bot is member of, then first channel
    const feedbackChannel = channels.find((c) => c.name === "feedback")
      ?? channels.find((c) => c.is_member)
      ?? channels[0];

    const slackChannelId = feedbackChannel?.id ?? "";
    const slackChannelName = feedbackChannel?.name ?? "general";

    // Upsert connection (one per workspace)
    await db
      .insert(slackConnections)
      .values({
        workspaceId,
        slackTeamId,
        slackTeamName,
        slackChannelId,
        slackChannelName,
        botToken,
        installedByUserId: session.user.id,
      })
      .onConflictDoUpdate({
        target: slackConnections.workspaceId,
        set: {
          slackTeamId,
          slackTeamName,
          slackChannelId,
          slackChannelName,
          botToken,
          installedByUserId: session.user.id,
        },
      });

    return NextResponse.redirect(
      new URL(`/dashboard/${workspaceId}/integrations?slack=connected`, request.url)
    );
  } catch (err) {
    logger.error("Slack OAuth callback failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.redirect(
      new URL(`/dashboard/${workspaceId}/integrations?slack_error=oauth_failed`, request.url)
    );
  }
}
