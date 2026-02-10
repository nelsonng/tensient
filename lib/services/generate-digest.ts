/**
 * Generate a weekly Top 5 digest for a workspace.
 *
 * Fetches all artifacts from the given period,
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
  digests,
} from "@/lib/db/schema";

interface DigestItem {
  rank: number;
  title: string;
  detail: string;
  goalPillar: string | null;
  priority: "critical" | "high" | "medium" | "low";
}

interface DigestResult {
  summary: string;
  items: DigestItem[];
}

const DIGEST_SCHEMA = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description: "1-2 sentences, max 20 words. The week in one breath.",
    },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          rank: { type: "number" },
          title: {
            type: "string",
            description: "Max 8 words, plain language, no subtitles or em-dashes",
          },
          detail: {
            type: "string",
            description: "1 sentence, max 15 words. The one fact that makes you feel it.",
          },
          goalPillar: {
            type: ["string", "null"],
            description: "Exact goal pillar name from the list, or null if emergent",
          },
          priority: {
            type: "string",
            enum: ["critical", "high", "medium", "low"],
          },
        },
        required: ["rank", "title", "detail", "goalPillar", "priority"],
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

  // Fetch current goals + health analysis for pillar names
  const [canon] = await db
    .select({
      content: canons.content,
      healthAnalysis: canons.healthAnalysis,
    })
    .from(canons)
    .where(eq(canons.workspaceId, workspaceId))
    .orderBy(desc(canons.createdAt))
    .limit(1);

  if (!canon) return null;

  // Extract pillar names from healthAnalysis
  const pillarNames: string[] = canon.healthAnalysis
    ? (
        ((canon.healthAnalysis as Record<string, unknown>).pillars as Array<{ title: string }>) || []
      ).map((p) => p.title)
    : [];

  const goalPillarsText = pillarNames.length > 0
    ? `GOAL PILLARS:\n${pillarNames.map((n, i) => `${i + 1}. ${n}`).join("\n")}`
    : `GOALS:\n${canon.content}`;

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

  // Build the prompt
  const synthesisText = weekArtifacts
    .map((a, i) => `[${i + 1}] ${a.feedback || a.content || "(no content)"}`)
    .join("\n\n");

  const prompt = `You are writing a Top 5 Things memo for an executive. This is the most important document of the week. It must be brutally concise.

VOICE: Like you're texting your co-founder at midnight. Plain words. Specific numbers. No jargon, no consulting-speak, no "leading indicators" or "strategic imperatives." Incomplete sentences are fine. Every word must earn its place.

${goalPillarsText}

THIS WEEK'S UPDATES (${weekArtifacts.length} items):
${synthesisText || "(No updates yet this week)"}

FORMAT RULES (STRICT — violating these is a failure):
- summary: 1-2 sentences. Max 20 words. The week in one breath.
- title: Max 8 words. Plain language. No subtitles, no em-dashes, no colons. Say what's happening.
- detail: 1 sentence. Max 15 words. The one fact that makes you feel it.
- goalPillar: The exact pillar name from GOAL PILLARS that this relates to, or null if emergent work.
- priority: "critical" = do it today. "high" = do it this week. "medium" = track it.

ANTI-PATTERNS (do NOT do these):
- "The loss of X is not an isolated incident — it's a leading indicator that..." → Just say "Lost X."
- "Scope a focused 1-2 week sprint to eliminate the top 3 friction points" → Just say "Fix top 3 issues this sprint."
- Titles with em-dashes or subtitles → "Fix onboarding. Customer quit." not "Emergency Fix the TMS Integration Wizard — Onboarding Is the Strategy"
- Paragraphs in the detail field → If your detail is more than 1 sentence, you failed.

EXAMPLE of a perfect item:
{ "rank": 1, "title": "Fix onboarding. Customer quit this week.", "detail": "DataFlow ($40K ARR) said \\"we gave up.\\" Top priority.", "goalPillar": "Fix onboarding experience", "priority": "critical" }

Return exactly 5 items ranked by impact on stated goals.`;

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
