import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { feedbackReplies, feedbackSubmissions, slackConnections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifySlackSignature } from "@/lib/slack";
import { logger } from "@/lib/logger";

/**
 * POST /api/slack/events
 *
 * Handles Slack Event Subscriptions:
 *   - url_verification challenge (required on first setup)
 *   - message events in a thread → syncs as feedbackReply
 *
 * Configure in Slack app settings:
 *   Event Subscriptions → Request URL: {APP_URL}/api/slack/events
 *   Subscribe to: message.channels
 */
export async function POST(request: Request) {
  const body = await request.text();

  // Verify Slack signature before processing anything
  const valid = await verifySlackSignature(request, body);
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Slack sends this once when you first configure the Event Subscriptions URL
  if (payload.type === "url_verification") {
    return NextResponse.json({ challenge: payload.challenge });
  }

  if (payload.type !== "event_callback") {
    return NextResponse.json({ ok: true });
  }

  const event = payload.event as Record<string, unknown> | undefined;
  if (!event) return NextResponse.json({ ok: true });

  // Only process regular user messages in threads
  if (
    event.type !== "message" ||
    event.subtype !== undefined || // skip bot messages, edits, deletes
    !event.thread_ts ||
    event.thread_ts === event.ts // skip the parent message itself
  ) {
    return NextResponse.json({ ok: true });
  }

  const threadTs = event.thread_ts as string;
  const messageText = event.text as string | undefined;
  const slackUserId = event.user as string | undefined;

  if (!messageText?.trim()) return NextResponse.json({ ok: true });

  try {
    // Find the feedback submission with this Slack message ID
    const [submission] = await db
      .select({
        id: feedbackSubmissions.id,
        workspaceId: feedbackSubmissions.workspaceId,
      })
      .from(feedbackSubmissions)
      .where(eq(feedbackSubmissions.slackMessageId, threadTs))
      .limit(1);

    if (!submission) return NextResponse.json({ ok: true });

    // Resolve the Slack user's display name
    let authorName = "Slack user";
    if (slackUserId) {
      try {
        const [conn] = await db
          .select({ botToken: slackConnections.botToken })
          .from(slackConnections)
          .where(eq(slackConnections.workspaceId, submission.workspaceId))
          .limit(1);

        if (conn) {
          const { WebClient } = await import("@slack/web-api");
          const client = new WebClient(conn.botToken);
          const userInfo = await client.users.info({ user: slackUserId });
          authorName = (userInfo.user as { real_name?: string } | undefined)?.real_name
            ?? (userInfo.user as { name?: string } | undefined)?.name
            ?? authorName;
        }
      } catch {
        // Non-fatal — proceed with fallback name
      }
    }

    await db.insert(feedbackReplies).values({
      feedbackSubmissionId: submission.id,
      content: messageText.trim(),
      authorType: "team",
      authorName,
      isInternal: false,
    });
  } catch (err) {
    logger.error("Failed to sync Slack thread reply", {
      threadTs,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Slack requires a 200 within 3 seconds
  return NextResponse.json({ ok: true });
}
