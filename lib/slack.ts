import { WebClient } from "@slack/web-api";
import { db } from "@/lib/db";
import { feedbackSubmissions, slackConnections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

// ── Types ──────────────────────────────────────────────────────────────

export interface SlackConnection {
  id: string;
  workspaceId: string;
  slackTeamId: string;
  slackTeamName: string;
  slackChannelId: string;
  slackChannelName: string;
  botToken: string;
}

export interface FeedbackForSlack {
  id: string;
  workspaceId: string;
  category: string;
  subject: string;
  description: string;
  status: string;
  priority: string | null;
  submitterEmail: string | null;
  submitterName: string | null;
  submitterExternalId: string | null;
  geoCity: string | null;
  geoCountry: string | null;
  currentUrl: string | null;
  slackMessageId?: string | null;
}

// ── Constants ──────────────────────────────────────────────────────────

const CATEGORY_EMOJI: Record<string, string> = {
  bug_report: ":red_circle:",
  feature_request: ":large_blue_circle:",
  help_request: ":white_circle:",
  urgent_issue: ":large_orange_circle:",
};

const CATEGORY_LABEL: Record<string, string> = {
  bug_report: "BUG",
  feature_request: "FEATURE",
  help_request: "HELP",
  urgent_issue: "URGENT",
};

const STATUS_OPTIONS = [
  { text: { type: "plain_text" as const, text: "New" }, value: "new" },
  { text: { type: "plain_text" as const, text: "Reviewing" }, value: "reviewing" },
  { text: { type: "plain_text" as const, text: "Awaiting Response" }, value: "awaiting_response" },
  { text: { type: "plain_text" as const, text: "Escalated" }, value: "escalated" },
  { text: { type: "plain_text" as const, text: "Resolved" }, value: "resolved" },
  { text: { type: "plain_text" as const, text: "Spam" }, value: "spam" },
];

const PRIORITY_OPTIONS = [
  { text: { type: "plain_text" as const, text: "Critical" }, value: "critical" },
  { text: { type: "plain_text" as const, text: "High" }, value: "high" },
  { text: { type: "plain_text" as const, text: "Medium" }, value: "medium" },
  { text: { type: "plain_text" as const, text: "Low" }, value: "low" },
  { text: { type: "plain_text" as const, text: "— Clear —" }, value: "none" },
];

// ── Signature Verification ─────────────────────────────────────────────

/**
 * Verifies the X-Slack-Signature header using HMAC-SHA256.
 * Must be called before processing any Slack request body.
 */
export async function verifySlackSignature(
  request: Request,
  body: string
): Promise<boolean> {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    logger.error("SLACK_SIGNING_SECRET is not set");
    return false;
  }

  const timestamp = request.headers.get("x-slack-request-timestamp");
  const signature = request.headers.get("x-slack-signature");

  if (!timestamp || !signature) return false;

  // Reject requests older than 5 minutes to prevent replay attacks
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > 300) return false;

  const sigBase = `v0:${timestamp}:${body}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(sigBase));
  const hex = "v0=" + Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison
  if (hex.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) {
    diff |= hex.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

// ── Connection lookup ──────────────────────────────────────────────────

export async function getSlackConnection(
  workspaceId: string
): Promise<SlackConnection | null> {
  const [row] = await db
    .select()
    .from(slackConnections)
    .where(eq(slackConnections.workspaceId, workspaceId))
    .limit(1);
  return row ?? null;
}

// ── Block Kit builder ──────────────────────────────────────────────────

export function buildFeedbackBlocks(
  submission: FeedbackForSlack,
  tensientUrl: string
) {
  const emoji = CATEGORY_EMOJI[submission.category] ?? ":speech_balloon:";
  const categoryLabel = CATEGORY_LABEL[submission.category] ?? submission.category.toUpperCase();

  const submitter = submission.submitterEmail
    ?? submission.submitterName
    ?? submission.submitterExternalId
    ?? "Anonymous";

  const geo = [submission.geoCity, submission.geoCountry].filter(Boolean).join(", ");
  const descriptionPreview = submission.description.length > 300
    ? submission.description.slice(0, 297) + "…"
    : submission.description;

  const statusLabel = STATUS_OPTIONS.find((o) => o.value === submission.status)?.text.text
    ?? submission.status.toUpperCase();
  const priorityLabel = submission.priority
    ? PRIORITY_OPTIONS.find((o) => o.value === submission.priority)?.text.text ?? submission.priority.toUpperCase()
    : "--";

  const detailUrl = `${tensientUrl}/dashboard/${submission.workspaceId}/feedback/${submission.id}`;

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${emoji} *[${categoryLabel}]* ${submission.subject}`,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `From: *${submitter}*${geo ? ` · ${geo}` : ""}${submission.currentUrl ? ` · ${submission.currentUrl}` : ""}`,
        },
      ],
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: descriptionPreview,
      },
    },
    { type: "divider" },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Status: *${statusLabel}*   Priority: *${priorityLabel}*`,
        },
      ],
    },
    {
      type: "actions",
      block_id: `feedback_actions_${submission.id}`,
      elements: [
        {
          type: "static_select",
          action_id: "set_status",
          placeholder: { type: "plain_text", text: "Set Status" },
          options: STATUS_OPTIONS,
          initial_option: STATUS_OPTIONS.find((o) => o.value === submission.status),
        },
        {
          type: "static_select",
          action_id: "set_priority",
          placeholder: { type: "plain_text", text: "Set Priority" },
          options: PRIORITY_OPTIONS,
          ...(submission.priority
            ? { initial_option: PRIORITY_OPTIONS.find((o) => o.value === submission.priority) }
            : {}),
        },
        {
          type: "button",
          action_id: "view_in_tensient",
          text: { type: "plain_text", text: "View in Tensient →" },
          url: detailUrl,
        },
      ],
    },
  ];
}

// ── Notify new feedback ────────────────────────────────────────────────

/**
 * Posts a Block Kit message to the configured Slack channel.
 * Silently no-ops if no Slack connection is configured for the workspace.
 * Stores the Slack message `ts` back on the feedback submission for threading.
 */
export async function notifyNewFeedback(
  workspaceId: string,
  submission: FeedbackForSlack
): Promise<void> {
  try {
    const connection = await getSlackConnection(workspaceId);
    if (!connection) return;

    const tensientUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://tensient.com";
    const client = new WebClient(connection.botToken);
    const blocks = buildFeedbackBlocks(submission, tensientUrl);

    const result = await client.chat.postMessage({
      channel: connection.slackChannelId,
      text: `[${CATEGORY_LABEL[submission.category] ?? "FEEDBACK"}] ${submission.subject}`,
      blocks,
    });

    if (result.ok && result.ts) {
      await db
        .update(feedbackSubmissions)
        .set({ slackMessageId: result.ts })
        .where(eq(feedbackSubmissions.id, submission.id));
    }
  } catch (err) {
    logger.error("Failed to post Slack notification", {
      workspaceId,
      feedbackId: submission.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ── Update existing Slack message ──────────────────────────────────────

/**
 * Re-renders the Block Kit message to reflect updated status/priority.
 * Called from the feedback PATCH handler after triage changes.
 */
export async function updateFeedbackMessage(
  workspaceId: string,
  submission: FeedbackForSlack
): Promise<void> {
  if (!submission.slackMessageId) return;

  try {
    const connection = await getSlackConnection(workspaceId);
    if (!connection) return;

    const tensientUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://tensient.com";
    const client = new WebClient(connection.botToken);
    const blocks = buildFeedbackBlocks(submission, tensientUrl);

    await client.chat.update({
      channel: connection.slackChannelId,
      ts: submission.slackMessageId,
      text: `[${CATEGORY_LABEL[submission.category] ?? "FEEDBACK"}] ${submission.subject}`,
      blocks,
    });
  } catch (err) {
    logger.error("Failed to update Slack message", {
      workspaceId,
      feedbackId: submission.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
