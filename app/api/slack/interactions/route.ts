import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { feedbackSubmissions } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { verifySlackSignature, updateFeedbackMessage } from "@/lib/slack";
import { logger } from "@/lib/logger";

/**
 * POST /api/slack/interactions
 *
 * Handles Slack interactive component payloads (Block Kit action buttons).
 * Triggered when a user clicks "Set Status" or "Set Priority" dropdowns
 * in the feedback notification message.
 *
 * Configure in Slack app settings:
 *   Interactivity & Shortcuts → Request URL: {APP_URL}/api/slack/interactions
 */

const VALID_STATUSES = [
  "new",
  "reviewing",
  "awaiting_response",
  "escalated",
  "resolved",
  "spam",
] as const;
type FeedbackStatus = (typeof VALID_STATUSES)[number];

const VALID_PRIORITIES = ["critical", "high", "medium", "low"] as const;
type FeedbackPriority = (typeof VALID_PRIORITIES)[number];

export async function POST(request: Request) {
  const body = await request.text();

  const valid = await verifySlackSignature(request, body);
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Slack sends interactions as URL-encoded payload=<JSON>
  const params = new URLSearchParams(body);
  const payloadStr = params.get("payload");
  if (!payloadStr) {
    return NextResponse.json({ error: "Missing payload" }, { status: 400 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(payloadStr) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid payload JSON" }, { status: 400 });
  }

  if (payload.type !== "block_actions") {
    return NextResponse.json({ ok: true });
  }

  const actions = payload.actions as Array<Record<string, unknown>> | undefined;
  if (!actions?.length) return NextResponse.json({ ok: true });

  const action = actions[0];
  const actionId = action.action_id as string;
  const blockId = (action.block_id as string) ?? "";

  // block_id format: feedback_actions_{feedbackId}
  const feedbackId = blockId.startsWith("feedback_actions_")
    ? blockId.slice("feedback_actions_".length)
    : null;

  if (!feedbackId) return NextResponse.json({ ok: true });

  try {
    // Fetch the submission to get workspaceId
    const [submission] = await db
      .select()
      .from(feedbackSubmissions)
      .where(eq(feedbackSubmissions.id, feedbackId))
      .limit(1);

    if (!submission) return NextResponse.json({ ok: true });

    const updateValues: Partial<{
      status: FeedbackStatus;
      priority: FeedbackPriority | null;
      updatedAt: Date;
    }> = { updatedAt: new Date() };

    if (actionId === "set_status") {
      const selected = (action.selected_option as { value: string } | undefined)?.value;
      if (selected && VALID_STATUSES.includes(selected as FeedbackStatus)) {
        updateValues.status = selected as FeedbackStatus;
      }
    } else if (actionId === "set_priority") {
      const selected = (action.selected_option as { value: string } | undefined)?.value;
      if (selected === "none") {
        updateValues.priority = null;
      } else if (selected && VALID_PRIORITIES.includes(selected as FeedbackPriority)) {
        updateValues.priority = selected as FeedbackPriority;
      }
    }

    if (Object.keys(updateValues).length <= 1) {
      return NextResponse.json({ ok: true });
    }

    const [updated] = await db
      .update(feedbackSubmissions)
      .set(updateValues)
      .where(
        and(
          eq(feedbackSubmissions.id, feedbackId),
          eq(feedbackSubmissions.workspaceId, submission.workspaceId)
        )
      )
      .returning();

    if (updated) {
      // Re-render the Slack message to reflect the new status/priority
      await updateFeedbackMessage(submission.workspaceId, {
        id: updated.id,
        workspaceId: updated.workspaceId,
        category: updated.category,
        subject: updated.subject,
        description: updated.description,
        status: updated.status,
        priority: updated.priority ?? null,
        submitterEmail: updated.submitterEmail ?? null,
        submitterName: updated.submitterName ?? null,
        submitterExternalId: updated.submitterExternalId ?? null,
        geoCity: updated.geoCity ?? null,
        geoCountry: updated.geoCountry ?? null,
        currentUrl: updated.currentUrl ?? null,
        slackMessageId: updated.slackMessageId ?? null,
      });
    }
  } catch (err) {
    logger.error("Failed to handle Slack interaction", {
      feedbackId,
      actionId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return NextResponse.json({ ok: true });
}
