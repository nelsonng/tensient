/**
 * Generate a weekly Top 5 digest for a workspace.
 *
 * Fetches all artifacts + actions from the given period,
 * calls Anthropic to synthesize the Top 5 priorities ranked by strategic impact,
 * and stores the result in the `digests` table.
 */

import { eq, desc, gte, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { generateStructuredJSON, calculateCostCents } from "@/lib/ai";
import { checkUsageAllowed, logUsage } from "@/lib/usage-guard";
import { logger } from "@/lib/logger";
import {
  artifacts,
  captures,
  canons,
  actions,
  protocols,
  digests,
} from "@/lib/db/schema";

interface DigestItem {
  rank: number;
  title: string;
  detail: string;
  coachAttribution: string;
  goalLinked: boolean;
  priority: "critical" | "high" | "medium" | "low";
}

interface DigestResult {
  summary: string;
  items: DigestItem[];
}

const DIGEST_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          rank: { type: "number" },
          title: { type: "string" },
          detail: { type: "string" },
          coachAttribution: { type: "string" },
          goalLinked: { type: "boolean" },
          priority: { type: "string", enum: ["critical", "high", "medium", "low"] },
        },
        required: ["rank", "title", "detail", "coachAttribution", "goalLinked", "priority"],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "items"],
  additionalProperties: false,
};

export async function generateWeeklyDigest({
  workspaceId,
  userId,
  weekStart,
}: {
  workspaceId: string;
  userId: string;
  weekStart: Date;
}): Promise<DigestResult | null> {
  // Cost control
  const usageCheck = await checkUsageAllowed(userId);
  if (!usageCheck.allowed) {
    logger.warn("Digest generation blocked", { reason: usageCheck.reason });
    return null;
  }

  // Fetch current goals
  const [canon] = await db
    .select({ content: canons.content })
    .from(canons)
    .where(eq(canons.workspaceId, workspaceId))
    .orderBy(desc(canons.createdAt))
    .limit(1);

  if (!canon) return null;

  // Fetch this week's synthesis
  const weekArtifacts = await db
    .select({
      content: artifacts.content,
      feedback: artifacts.feedback,
      driftScore: artifacts.driftScore,
    })
    .from(artifacts)
    .innerJoin(captures, eq(artifacts.captureId, captures.id))
    .where(
      and(
        eq(captures.workspaceId, workspaceId),
        gte(artifacts.createdAt, weekStart)
      )
    )
    .orderBy(desc(artifacts.createdAt))
    .limit(50);

  // Fetch open actions
  const weekActions = await db
    .select({
      title: actions.title,
      status: actions.status,
      priority: actions.priority,
      coachAttribution: actions.coachAttribution,
      goalAlignmentScore: actions.goalAlignmentScore,
    })
    .from(actions)
    .where(
      and(
        eq(actions.workspaceId, workspaceId),
        gte(actions.createdAt, weekStart)
      )
    )
    .limit(100);

  // Fetch all coaches for attribution context
  const coaches = await db
    .select({ name: protocols.name })
    .from(protocols)
    .where(eq(protocols.isPublic, true));

  const coachNames = coaches.map((c) => c.name).join(", ");

  // Build the prompt
  const synthesisText = weekArtifacts
    .map((a, i) => `[Synthesis ${i + 1}]\n${a.feedback || a.content || "(no content)"}`)
    .join("\n\n");

  const actionsText = weekActions
    .map(
      (a) =>
        `- [${a.priority?.toUpperCase()}] ${a.title} (status: ${a.status}, coach: ${a.coachAttribution || "unknown"}, goal-aligned: ${a.goalAlignmentScore ? Math.round(a.goalAlignmentScore * 100) + "%" : "N/A"})`
    )
    .join("\n");

  const prompt = `You are synthesizing a week of team updates into the Top 5 Things that matter most to this organization, ranked by strategic impact.

ORGANIZATION GOALS:
${canon.content}

THIS WEEK'S SYNTHESIS (${weekArtifacts.length} items):
${synthesisText || "(No synthesis yet this week)"}

THIS WEEK'S ACTION ITEMS (${weekActions.length} items):
${actionsText || "(No new actions this week)"}

AVAILABLE COACHING LENSES: ${coachNames}

INSTRUCTIONS:
1. Identify the 5 most strategically important themes/priorities from this week's data
2. Rank them by impact on the organization's stated goals (most impactful = #1)
3. For each item, attribute which coaching lens (${coachNames}) would most naturally surface this insight
4. Indicate whether each item links to a stated goal (true) or represents emergent work (false)
5. Assign priority: "critical" (blocking/urgent), "high" (important this week), "medium" (track it), "low" (informational)
6. For summary, write a 2-3 sentence executive summary of the week`;

  let parsed: DigestResult;
  try {
    const response = await generateStructuredJSON<DigestResult>({
      prompt,
      schema: DIGEST_SCHEMA,
      temperature: 0.3,
    });

    parsed = response.result;

    // Log usage
    await logUsage({
      userId,
      workspaceId,
      operation: "digest",
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      estimatedCostCents: calculateCostCents(response.inputTokens, response.outputTokens),
    });
  } catch (error) {
    logger.error("Failed to generate digest", { error });
    return null;
  }

  // Store in database
  await db.insert(digests).values({
    workspaceId,
    weekStart,
    summary: parsed.summary,
    items: parsed.items,
  });

  return parsed;
}
