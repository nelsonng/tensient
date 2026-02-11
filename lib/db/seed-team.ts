/**
 * seed-team.ts -- Injects 6 team member personas into an existing workspace.
 *
 * Usage:
 *   DATABASE_URL=... GEMINI_API_KEY=... ANTHROPIC_API_KEY=... npx tsx lib/db/seed-team.ts <workspaceId>
 *
 * Prerequisites:
 *   - Workspace must already exist (created during onboarding)
 *   - Goals (canon) must already be set
 *   - Nelson's thought must already be processed
 *
 * Creates: 6 users, 6 memberships, 6 captures + artifacts, regenerates digest
 * Cost: ~7 Anthropic API calls + ~7 Gemini embeddings
 * Runtime: ~60-90 seconds
 *
 * This script is self-contained and does not import from service modules
 * (which use @/ path aliases that tsx cannot resolve).
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, desc, gte, and } from "drizzle-orm";
import { hash } from "bcryptjs";
import { GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import {
  users,
  workspaces,
  memberships,
  captures,
  artifacts,
  canons,
  digests,
} from "./schema";

// ── Database & AI clients ───────────────────────────────────────────────

const sqlFn = neon(process.env.DATABASE_URL!);
const db = drizzle(sqlFn);
const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const MODEL = "claude-opus-4-6";

// ── Helpers ─────────────────────────────────────────────────────────────

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await gemini.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
    config: { outputDimensionality: 1536 },
  });
  return response.embeddings?.[0]?.values ?? [];
}

async function generateStructuredJSON<T>(opts: {
  prompt: string;
  schema: Record<string, unknown>;
  temperature?: number;
}): Promise<T> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{ role: "user", content: opts.prompt }],
    output_config: {
      format: {
        type: "json_schema" as const,
        schema: opts.schema,
      },
    },
  });
  const textBlock = response.content.find((b) => b.type === "text");
  const text = textBlock && textBlock.type === "text" ? textBlock.text : "{}";
  return JSON.parse(text) as T;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Team Personas ───────────────────────────────────────────────────────

interface TeamMember {
  email: string;
  firstName: string;
  lastName: string;
  thought: string;
}

const SEED_PASSWORD = process.env.SEED_PASSWORD || "change-me-before-use";

const TEAM: TeamMember[] = [
  {
    email: "rachel@meridian-demo.com",
    firstName: "Rachel",
    lastName: "Chen",
    thought: `really good week actually. The carrier matching staging environment is looking solid -- Jordan's team nailed the accuracy numbers and I sat in on the Midwest Freight preview call, they're genuinely excited. We're on track for the Thursday demo. On cold chain, I finished the sixth operator interview and the pattern is super clear -- nobody has real-time temperature visibility for LTL shipments. I'm putting together a one-pager to scope a minimum viable cold chain module, thinking 8 weeks to a pilot. My concern is bandwidth. We've got carrier matching launching, onboarding still broken, and now cold chain scoping -- I need to have a hard conversation with Nelson about sequencing. We can't do all three at full speed.`,
  },
  {
    email: "jordan@meridian-demo.com",
    firstName: "Jordan",
    lastName: "Rivera",
    thought: `carrier matching is in great shape. 89% accuracy on Midwest Freight's historical data, sub-2-second response time, and the ops team there is pumped for the live demo Thursday. I've been working with their dispatch lead to set up a parallel run -- our engine plus their existing manual process side by side for two weeks. If the parallel run goes well we're looking at a signed contract by end of month. Also started scoping what it would take to onboard two more carriers -- TruckNow and Pacific Route. Main bottleneck is each carrier's API is slightly different so we need some adapter work. Already talked to Marcus about it, he says he can get to it after the data quality sprint.`,
  },
  {
    email: "alex@meridian-demo.com",
    firstName: "Alex",
    lastName: "Kim",
    thought: `spent this whole week deep in the onboarding flow. Did five user session recordings from recent trial signups and the pattern is painfully clear -- people get to the TMS integration step and just freeze. The wizard asks for API credentials, webhook URLs, and data mapping configs all on one screen. Nobody knows what half of those fields mean. I've got wireframes for a redesigned flow that breaks it into three guided steps with inline help and a test-connection button so they get instant feedback. Could cut the integration step from 45 minutes to under 10. I want to get this in front of engineering next week but I keep hearing carrier matching is the priority. Feels like we're optimizing acquisition while the bucket has a hole in it.`,
  },
  {
    email: "marcus@meridian-demo.com",
    firstName: "Marcus",
    lastName: "Thompson",
    thought: `honestly this week was a mess. Two more outages from the carrier data sync -- same root cause, legacy TMS APIs returning malformed JSON and our parser just crashes instead of handling it gracefully. I patched the immediate issue with a try-catch wrapper and some fallback logic but it's duct tape. I've got the full data quality layer proposal ready to go, it's a 3-week sprint to build proper ingestion with validation, retry logic, and alerting. But I keep getting pulled into carrier matching bugs and Jordan needs API adapters for two new carriers. I can't do everything. Something has to give. Either we pause carrier matching expansion for three weeks and fix the foundation, or we accept that we'll keep having outages. I need Nelson to make the call.`,
  },
  {
    email: "priya@meridian-demo.com",
    firstName: "Priya",
    lastName: "Patel",
    thought: `ok so something kind of big happened this week that I don't think anyone's paying attention to. FreightHub -- they're the largest digital freight marketplace in the midwest -- reached out to me after seeing our carrier matching demo at the LogiTech conference last month. They want to explore an integration partnership. Their platform has 200+ carriers and 50+ shippers already on it. If we integrate our matching engine into their marketplace, we could get in front of their entire customer base overnight. I had a 45-minute call with their VP of Partnerships and they're serious -- they want a technical scoping meeting within two weeks. This could be bigger than any single enterprise deal we're chasing. But I mentioned it in standup and everyone just nodded and moved on. I don't know if anyone understands what this could mean for our growth trajectory.`,
  },
  {
    email: "sam@meridian-demo.com",
    firstName: "Sam",
    lastName: "Okafor",
    thought: `I'm drowning. 14 support tickets this week, three of them escalations. DataFlow Logistics -- the ones who churned from the trial -- actually came back asking if we could walk them through the integration manually. I spent three hours on a screen share with their CTO and honestly got them 80% of the way there. But I can't do that for every customer. The other escalation was Midwest Freight having issues with their staging data -- timing is terrible because we're about to do the carrier matching demo for them Thursday. I keep thinking we need self-service documentation and video walkthroughs for the integration process. Like really good ones, not the half-page FAQ we have now. That alone would probably cut my ticket volume in half. But nobody asks what I think and I don't have time to build it because I'm always firefighting. Starting to feel like I'm just here to absorb pain.`,
  },
];

// ── Process a single capture (embedding + LLM + artifact) ───────────────

async function seedProcessCapture(
  userId: string,
  workspaceId: string,
  content: string,
  canonId: string | null,
  canonEmbedding: number[] | null,
  captureDate: Date,
) {
  // 1. Create capture
  const [capture] = await db
    .insert(captures)
    .values({ userId, workspaceId, content, source: "web" })
    .returning();

  // 2. Embedding
  const captureEmbedding = await generateEmbedding(content);

  // 3. Drift score
  // Calibrate: raw cosine sim for business text clusters in [0.35, 0.85]
  // Stretch to [0, 1] for meaningful alignment display
  const SIMILARITY_FLOOR = 0.35;
  const SIMILARITY_CEILING = 0.85;

  let driftScore = 0.5;
  if (canonEmbedding) {
    const rawSimilarity = cosineSimilarity(captureEmbedding, canonEmbedding);
    const calibrated = Math.max(
      0,
      Math.min(1, (rawSimilarity - SIMILARITY_FLOOR) / (SIMILARITY_CEILING - SIMILARITY_FLOOR))
    );
    driftScore = Math.max(0, Math.min(1, 1 - calibrated));
  }

  // 4. LLM analysis
  const parsed = await generateStructuredJSON<{
    sentiment_score: number;
    action_items: Array<{ task: string; status: string }>;
    synthesis: string;
    feedback: string;
    goal_pillar: string | null;
  }>({
    prompt: `You are an organizational intelligence agent. Analyze this employee update and extract:
1. sentiment_score: Float from -1.0 (very negative) to 1.0 (very positive)
2. action_items: Array of objects with task and status fields
3. synthesis: A clean, professional summary of the update (2-3 sentences)
4. feedback: Coaching advice for the employee (1-2 sentences). Be direct and actionable.
5. goal_pillar: Which single strategic goal pillar this update most closely relates to. Use the EXACT title from the list, or null if none apply.

Here is the employee update:

${content}`,
    schema: {
      type: "object",
      properties: {
        sentiment_score: { type: "number" },
        action_items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              task: { type: "string" },
              status: { type: "string", enum: ["open", "blocked", "done"] },
            },
            required: ["task", "status"],
            additionalProperties: false,
          },
        },
        synthesis: { type: "string" },
        feedback: { type: "string" },
        goal_pillar: { type: ["string", "null"] },
      },
      required: ["sentiment_score", "action_items", "synthesis", "feedback", "goal_pillar"],
      additionalProperties: false,
    },
    temperature: 0.3,
  });

  // 5. Create artifact
  const [artifact] = await db
    .insert(artifacts)
    .values({
      captureId: capture.id,
      canonId,
      driftScore,
      sentimentScore: parsed.sentiment_score || 0,
      content: parsed.synthesis || content,
      actionItems: parsed.action_items || [],
      feedback: parsed.feedback || "",
      goalPillar: parsed.goal_pillar || null,
      embedding: captureEmbedding,
    })
    .returning();

  // 6. Backdate timestamps
  await db
    .update(captures)
    .set({ processedAt: captureDate, createdAt: captureDate })
    .where(eq(captures.id, capture.id));

  await db
    .update(artifacts)
    .set({ createdAt: captureDate })
    .where(eq(artifacts.id, artifact.id));

  const alignmentScore = Math.round((1 - driftScore) * 100) / 100;

  return {
    capture,
    artifact,
    alignmentScore,
    sentimentScore: parsed.sentiment_score || 0,
    actionItems: parsed.action_items || [],
  };
}

// ── Digest generation (self-contained) ──────────────────────────────────

async function generateDigest(
  workspaceId: string,
  weekStart: Date,
  goalPillarsText: string,
) {
  // Fetch all artifacts from this week
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

  const parsed = await generateStructuredJSON<{
    summary: string;
    items: Array<{
      rank: number;
      title: string;
      detail: string;
      goalPillar: string | null;
      priority: string;
    }>;
  }>({
    prompt,
    schema: {
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
    },
    temperature: 0.3,
  });

  // Delete existing digests for this workspace
  const existingDigests = await db
    .select({ id: digests.id })
    .from(digests)
    .where(eq(digests.workspaceId, workspaceId));

  for (const d of existingDigests) {
    await db.delete(digests).where(eq(digests.id, d.id));
  }

  // Store new digest
  await db.insert(digests).values({
    workspaceId,
    weekStart,
    summary: parsed.summary,
    items: parsed.items,
  });

  return parsed;
}

// ═══════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════

async function seedTeam() {
  const workspaceId = process.argv[2];
  if (!workspaceId) {
    console.error("Usage: npx tsx lib/db/seed-team.ts <workspaceId>");
    process.exit(1);
  }

  console.log("=== Seeding Meridian team data ===\n");
  console.log(`   Workspace: ${workspaceId}\n`);

  // ── Step 1: Look up workspace ──────────────────────────────────────
  console.log("1. Looking up workspace...");
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!workspace) {
    console.error(`   ERROR: Workspace ${workspaceId} not found`);
    process.exit(1);
  }
  console.log(`   OK: ${workspace.name} (org: ${workspace.organizationId})\n`);

  // ── Step 2: Look up canon ──────────────────────────────────────────
  console.log("2. Looking up goals (canon)...");
  const [canon] = await db
    .select()
    .from(canons)
    .where(eq(canons.workspaceId, workspaceId))
    .orderBy(desc(canons.createdAt))
    .limit(1);

  if (!canon) {
    console.error("   ERROR: No canon found. Complete onboarding first.");
    process.exit(1);
  }

  const canonEmbedding = canon.embedding as number[] | null;

  // Extract pillar names for digest prompt
  const pillarNames: string[] = canon.healthAnalysis
    ? (
        ((canon.healthAnalysis as Record<string, unknown>).pillars as Array<{ title: string }>) || []
      ).map((p) => p.title)
    : [];

  const goalPillarsText = pillarNames.length > 0
    ? `GOAL PILLARS:\n${pillarNames.map((n, i) => `${i + 1}. ${n}`).join("\n")}`
    : `GOALS:\n${canon.content}`;

  console.log(`   OK: Canon ${canon.id}`);
  console.log(`   OK: ${pillarNames.length} pillars: ${pillarNames.join(", ")}\n`);

  // ── Step 3: Create team users ──────────────────────────────────────
  console.log("3. Creating team users...");
  const userMap: Record<string, string> = {};

  for (const member of TEAM) {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, member.email))
      .limit(1);

    if (existing) {
      userMap[member.email] = existing.id;
      console.log(`   = ${member.firstName} ${member.lastName} (${member.email}) -- already exists`);
    } else {
      const passwordHash = await hash(SEED_PASSWORD, 12);
      const [user] = await db
        .insert(users)
        .values({
          email: member.email,
          firstName: member.firstName,
          lastName: member.lastName,
          passwordHash,
          organizationId: workspace.organizationId,
        })
        .returning();
      userMap[member.email] = user.id;
      console.log(`   + ${member.firstName} ${member.lastName} (${member.email})`);
    }
  }
  console.log();

  // ── Step 4: Create memberships ─────────────────────────────────────
  console.log("4. Creating memberships...");
  for (const member of TEAM) {
    const userId = userMap[member.email];
    // Check if membership already exists
    const [existing] = await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(
          eq(memberships.userId, userId),
          eq(memberships.workspaceId, workspaceId)
        )
      )
      .limit(1);

    if (existing) {
      console.log(`   = ${member.firstName} -- already a member`);
    } else {
      await db.insert(memberships).values({
        userId,
        workspaceId,
        role: "member",
      });
      console.log(`   + ${member.firstName} (member)`);
    }
  }
  console.log();

  // ── Step 5: Process captures ───────────────────────────────────────
  console.log(`5. Processing ${TEAM.length} captures through AI pipeline...\n`);

  // Backdate to "this week" -- use current Monday as base
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + mondayOffset);
  weekStart.setHours(0, 0, 0, 0);

  for (let i = 0; i < TEAM.length; i++) {
    const member = TEAM[i];
    const userId = userMap[member.email];
    // Stagger captures across the week (Mon-Sat)
    const captureDate = new Date(weekStart);
    captureDate.setDate(weekStart.getDate() + i);
    captureDate.setHours(9 + i, 0, 0, 0);

    process.stdout.write(
      `   [${String(i + 1).padStart(2)}/${TEAM.length}] ${member.firstName.padEnd(8)} `
    );

    try {
      const result = await seedProcessCapture(
        userId,
        workspaceId,
        member.thought,
        canon.id,
        canonEmbedding,
        captureDate,
      );

      // Update membership traction score
      const [membership] = await db
        .select({
          id: memberships.id,
          tractionScore: memberships.tractionScore,
        })
        .from(memberships)
        .where(
          and(
            eq(memberships.userId, userId),
            eq(memberships.workspaceId, workspaceId)
          )
        )
        .limit(1);

      if (membership) {
        const newScore = membership.tractionScore === 0
          ? result.alignmentScore
          : membership.tractionScore * 0.7 + result.alignmentScore * 0.3;

        await db
          .update(memberships)
          .set({
            tractionScore: newScore,
            lastCaptureAt: captureDate,
            streakCount: 1,
            updatedAt: captureDate,
          })
          .where(eq(memberships.id, membership.id));
      }

      console.log(
        `-> ${Math.round(result.alignmentScore * 100)}% aligned, sentiment ${result.sentimentScore.toFixed(2)}, ${result.actionItems.length} actions`
      );

      // Rate limit delay
      if (i < TEAM.length - 1) {
        await sleep(1500);
      }
    } catch (error) {
      console.log(`X ERROR: ${error instanceof Error ? error.message : "unknown"}`);
      await sleep(5000);
    }
  }

  // ── Step 6: Regenerate digest ──────────────────────────────────────
  console.log("\n6. Regenerating Top 5 digest with all team data...");

  try {
    const digest = await generateDigest(workspaceId, weekStart, goalPillarsText);
    console.log(`   OK: "${digest.summary}"`);
    console.log(`   OK: ${digest.items.length} items generated`);
    for (const item of digest.items) {
      console.log(`      #${item.rank}: ${item.title} [${item.priority}]`);
    }
  } catch (error) {
    console.log(`   WARN: Digest generation failed: ${error instanceof Error ? error.message : "unknown"}`);
    console.log("   You can regenerate by navigating to the dashboard in the app.");
  }

  // ── Done! ──────────────────────────────────────────────────────────
  console.log("\n===============================================================");
  console.log("Team seed complete!");
  console.log(`   Workspace ID: ${workspaceId}`);
  console.log(`   Dashboard URL: /dashboard/${workspaceId}`);
  console.log(`   Team members: ${TEAM.length} added`);
  console.log("===============================================================\n");
}

seedTeam().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
