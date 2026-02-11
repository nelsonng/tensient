/**
 * seed-yc-demo.ts -- Creates a complete demo workspace for YC reviewers.
 *
 * Usage:
 *   DATABASE_URL=... GEMINI_API_KEY=... ANTHROPIC_API_KEY=... npx tsx lib/db/seed-yc-demo.ts
 *
 * Creates: 1 org, 7 users, 1 workspace, 7 memberships, 1 canon (with health analysis),
 *          7 captures + artifacts, 1 weekly digest (Top 5)
 *
 * Credentials:
 *   Email:    jamie@meridian-ops.com
 *   Password: MeridianDemo2026
 *
 * Cost: ~10 Anthropic API calls + ~8 Gemini embeddings
 * Runtime: ~3-4 minutes
 *
 * This script is self-contained (no @/ imports).
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, desc, gte, and } from "drizzle-orm";
import { hash } from "bcryptjs";
import { GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import {
  organizations,
  users,
  workspaces,
  memberships,
  protocols,
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

function nanoid(length: number = 8): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) {
    result += alphabet[bytes[i] % alphabet.length];
  }
  return result;
}

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

// ── Demo credentials ────────────────────────────────────────────────────

const DEMO_PASSWORD = "MeridianDemo2026";

// ── Protagonist ─────────────────────────────────────────────────────────

const PROTAGONIST = {
  email: "jamie@meridian-ops.com",
  firstName: "Jamie",
  lastName: "Reeves",
  role: "owner" as const,
};

// ── V2MOM (Meridian goals) ──────────────────────────────────────────────

const V2MOM = `Meridian V2MOM -- 2026

Vision
Build the operating system for mid-market logistics -- replacing fragmented spreadsheets, legacy TMS platforms, and tribal knowledge with a single platform that gives operators real-time visibility and automated decision-making across their entire network.

Values
Visibility Over Gut Feel: Every routing decision should be data-driven, not based on who shouted loudest on the operations floor.
Speed Without Chaos: Move fast on product, but keep every action traceable and reversible.
Customer Outcomes First: Measure success by what customers can now do, not by features we shipped.
Defensible Data: We win on data quality and integrations, not on lock-in.

Methods
1. Ship real-time carrier matching engine to replace manual broker load assignment. Already in staging, tested with Midwest Freight at 89% accuracy.
2. Fix the customer onboarding experience. Trial-to-paid conversion is suffering because TMS integration wizard is too complex. Lost DataFlow Logistics (40k ARR) this month.
3. Expand into cold chain logistics vertical. Rachel validated demand with 6 operator interviews -- nobody has good temperature-sensitive shipment visibility. Market is wide open.
4. Build a data quality layer to handle garbage data from legacy TMS APIs. Had two outages this week from carrier sync failures.
5. Hire 3 senior engineers to support platform scalability and the cold chain expansion.

Obstacles
Dependency on legacy TMS APIs for customer data -- often dirty, undocumented, and unreliable.
Onboarding friction is causing early-stage churn.
Team is stretched thin across carrier matching, onboarding fixes, cold chain research, and infra stability.

Measures
Reduce average customer onboarding time.
Increase platform uptime to 99.9%.
Grow ARR.
Launch carrier matching for at least 3 enterprise accounts.`;

// ── Protagonist's thought (Jamie's T5T) ─────────────────────────────────

const PROTAGONIST_THOUGHT = `ok so biggest thing this week -- we finally got the carrier matching algorithm working in staging and honestly it's kind of incredible. We tested it against Midwest Freight's actual load data and it matched 89% of loads to the right carrier in under 2 seconds. That's insane compared to the 15-20 minutes their brokers spend per load manually. I'm really pumped about this, gonna demo it to their ops team next Thursday.

second thing -- onboarding is still killing us. Lost another prospect this week, DataFlow Logistics, because they couldn't figure out the TMS integration during their trial. They literally emailed saying "we gave up." That's 40k ARR just walking out the door. I keep saying we need to fix the integration wizard but it keeps getting deprioritized because carrier matching is the shiny thing.

third -- Rachel's cold chain research is really promising, she talked to 6 operators and basically validated that nobody has a good solution for temperature-sensitive visibility. The market is wide open. But I'm honestly worried we're spreading too thin. We haven't fully nailed the core product, onboarding is broken, and now we're talking about an entire new vertical? I don't know.

fourth, infra stuff -- two more outages this week, both the carrier data sync. Legacy TMS APIs just randomly return garbage and our system doesn't handle it gracefully. Marcus is putting together a proposal for a data quality layer but I don't think we can afford to wait for the perfect solution. We need a band-aid AND a long-term fix.

last thing -- hiring is painfully slow. Posted for senior platform engineer 6 weeks ago, interviewed maybe 12 people, nobody really gets logistics domain complexity. Starting to think we should just hire someone great technically and teach them the domain instead of looking for a unicorn who already knows freight.`;

// ── Team members + their thoughts ───────────────────────────────────────

interface TeamMember {
  email: string;
  firstName: string;
  lastName: string;
  thought: string;
}

const TEAM: TeamMember[] = [
  {
    email: "rachel@meridian-ops.com",
    firstName: "Rachel",
    lastName: "Chen",
    thought: `really good week actually. The carrier matching staging environment is looking solid -- Jordan's team nailed the accuracy numbers and I sat in on the Midwest Freight preview call, they're genuinely excited. We're on track for the Thursday demo. On cold chain, I finished the sixth operator interview and the pattern is super clear -- nobody has real-time temperature visibility for LTL shipments. I'm putting together a one-pager to scope a minimum viable cold chain module, thinking 8 weeks to a pilot. My concern is bandwidth. We've got carrier matching launching, onboarding still broken, and now cold chain scoping -- I need to have a hard conversation with Jamie about sequencing. We can't do all three at full speed.`,
  },
  {
    email: "jordan@meridian-ops.com",
    firstName: "Jordan",
    lastName: "Rivera",
    thought: `carrier matching is in great shape. 89% accuracy on Midwest Freight's historical data, sub-2-second response time, and the ops team there is pumped for the live demo Thursday. I've been working with their dispatch lead to set up a parallel run -- our engine plus their existing manual process side by side for two weeks. If the parallel run goes well we're looking at a signed contract by end of month. Also started scoping what it would take to onboard two more carriers -- TruckNow and Pacific Route. Main bottleneck is each carrier's API is slightly different so we need some adapter work. Already talked to Marcus about it, he says he can get to it after the data quality sprint.`,
  },
  {
    email: "alex@meridian-ops.com",
    firstName: "Alex",
    lastName: "Kim",
    thought: `spent this whole week deep in the onboarding flow. Did five user session recordings from recent trial signups and the pattern is painfully clear -- people get to the TMS integration step and just freeze. The wizard asks for API credentials, webhook URLs, and data mapping configs all on one screen. Nobody knows what half of those fields mean. I've got wireframes for a redesigned flow that breaks it into three guided steps with inline help and a test-connection button so they get instant feedback. Could cut the integration step from 45 minutes to under 10. I want to get this in front of engineering next week but I keep hearing carrier matching is the priority. Feels like we're optimizing acquisition while the bucket has a hole in it.`,
  },
  {
    email: "marcus@meridian-ops.com",
    firstName: "Marcus",
    lastName: "Thompson",
    thought: `honestly this week was a mess. Two more outages from the carrier data sync -- same root cause, legacy TMS APIs returning malformed JSON and our parser just crashes instead of handling it gracefully. I patched the immediate issue with a try-catch wrapper and some fallback logic but it's duct tape. I've got the full data quality layer proposal ready to go, it's a 3-week sprint to build proper ingestion with validation, retry logic, and alerting. But I keep getting pulled into carrier matching bugs and Jordan needs API adapters for two new carriers. I can't do everything. Something has to give. Either we pause carrier matching expansion for three weeks and fix the foundation, or we accept that we'll keep having outages. I need Jamie to make the call.`,
  },
  {
    email: "priya@meridian-ops.com",
    firstName: "Priya",
    lastName: "Patel",
    thought: `ok so something kind of big happened this week that I don't think anyone's paying attention to. FreightHub -- they're the largest digital freight marketplace in the midwest -- reached out to me after seeing our carrier matching demo at the LogiTech conference last month. They want to explore an integration partnership. Their platform has 200+ carriers and 50+ shippers already on it. If we integrate our matching engine into their marketplace, we could get in front of their entire customer base overnight. I had a 45-minute call with their VP of Partnerships and they're serious -- they want a technical scoping meeting within two weeks. This could be bigger than any single enterprise deal we're chasing. But I mentioned it in standup and everyone just nodded and moved on. I don't know if anyone understands what this could mean for our growth trajectory.`,
  },
  {
    email: "sam@meridian-ops.com",
    firstName: "Sam",
    lastName: "Okafor",
    thought: `I'm drowning. 14 support tickets this week, three of them escalations. DataFlow Logistics -- the ones who churned from the trial -- actually came back asking if we could walk them through the integration manually. I spent three hours on a screen share with their CTO and honestly got them 80% of the way there. But I can't do that for every customer. The other escalation was Midwest Freight having issues with their staging data -- timing is terrible because we're about to do the carrier matching demo for them Thursday. I keep thinking we need self-service documentation and video walkthroughs for the integration process. Like really good ones, not the half-page FAQ we have now. That alone would probably cut my ticket volume in half. But nobody asks what I think and I don't have time to build it because I'm always firefighting. Starting to feel like I'm just here to absorb pain.`,
  },
];

// ── Strategy extraction schemas ─────────────────────────────────────────

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    pillars: { type: "array", items: { type: "string" } },
    tone: { type: "string", enum: ["wartime", "peacetime", "analytical", "growth"] },
    synthesis: { type: "string" },
    improvement_rationale: { type: "string" },
    coaching_questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          coach: { type: "string" },
          question: { type: "string" },
        },
        required: ["coach", "question"],
        additionalProperties: false,
      },
    },
  },
  required: ["pillars", "tone", "synthesis", "improvement_rationale", "coaching_questions"],
  additionalProperties: false,
};

const SMART_SCHEMA = {
  type: "object",
  properties: {
    overall_score: { type: "number" },
    pillars: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          score: { type: "number" },
          smart: {
            type: "object",
            properties: {
              specific: { type: "number" },
              measurable: { type: "number" },
              achievable: { type: "number" },
              relevant: { type: "number" },
              time_bound: { type: "number" },
            },
            required: ["specific", "measurable", "achievable", "relevant", "time_bound"],
            additionalProperties: false,
          },
          suggestion: { type: "string" },
        },
        required: ["title", "score", "smart", "suggestion"],
        additionalProperties: false,
      },
    },
  },
  required: ["overall_score", "pillars"],
  additionalProperties: false,
};

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

// ── Strategy processing (replicates genesis-setup.ts) ───────────────────

async function seedRunStrategy(workspaceId: string, rawInput: string) {
  console.log("   Extracting strategic pillars via Anthropic...");

  // Fetch all public coaches for composite prompt
  const allCoaches = await db
    .select({ name: protocols.name, systemPrompt: protocols.systemPrompt })
    .from(protocols)
    .where(eq(protocols.isPublic, true));

  const coachingContext = allCoaches
    .map((c) => `[COACH: ${c.name}]\n${c.systemPrompt}`)
    .join("\n\n");

  const extraction = await generateStructuredJSON<{
    pillars: string[];
    tone: string;
    synthesis: string;
    improvement_rationale: string;
    coaching_questions: Array<{ coach: string; question: string }>;
  }>({
    prompt: `You are a strategic advisor with access to multiple coaching lenses. Given a leader's raw strategic input:

1. Extract the core 3-5 strategic pillars (concise, actionable statements). IMPROVE them where obvious improvements are possible -- make them more specific, measurable, or time-bound.
2. Detect the overall tone (one of: "wartime", "peacetime", "analytical", "growth")
3. Synthesize a strategy document (2-3 paragraphs) -- this is the IMPROVED version
4. Provide an improvement_rationale: 2-3 sentences explaining what you improved from the raw input and why.
5. From the coaching lenses below, pick the 3-4 MOST RELEVANT coaches. For each, generate ONE specific question.

COACHING LENSES:
${coachingContext}

RAW STRATEGIC INPUT:
${rawInput}`,
    schema: EXTRACTION_SCHEMA,
    temperature: 0.3,
  });

  const { pillars, tone, synthesis } = extraction;

  console.log("   Running SMART analysis...");
  await sleep(1000);

  const smartAnalysis = await generateStructuredJSON<{
    overall_score: number;
    pillars: Array<{
      title: string;
      score: number;
      smart: { specific: number; measurable: number; achievable: number; relevant: number; time_bound: number };
      suggestion: string;
    }>;
  }>({
    prompt: `You are a goal quality analyst. Evaluate the following strategic pillars against the SMART framework.

For each pillar, provide:
- A score from 0.0 to 1.0 for each SMART dimension
- An overall score (average of the 5 dimensions)
- One specific suggestion to improve the pillar

Also provide an overall_score across all pillars.

STRATEGIC PILLARS:
${pillars.map((p: string, i: number) => `${i + 1}. ${p}`).join("\n")}

CONTEXT:
${synthesis}`,
    schema: SMART_SCHEMA,
    temperature: 0.2,
  });

  const healthAnalysis = {
    overallScore: smartAnalysis.overall_score ?? 0.5,
    pillars: (smartAnalysis.pillars ?? []).map((p) => ({
      title: p.title,
      score: p.score,
      smart: {
        specific: p.smart.specific,
        measurable: p.smart.measurable,
        achievable: p.smart.achievable,
        relevant: p.smart.relevant,
        timeBound: p.smart.time_bound,
      },
      suggestion: p.suggestion,
    })),
  };

  console.log("   Generating strategy embedding...");
  const embedding = await generateEmbedding(synthesis);

  const [canon] = await db
    .insert(canons)
    .values({
      workspaceId,
      content: synthesis,
      embedding,
      rawInput,
      healthScore: healthAnalysis.overallScore,
      healthAnalysis,
    })
    .returning();

  // Auto-select protocol by tone
  const toneToCategory: Record<string, string> = {
    wartime: "strategy",
    peacetime: "leadership",
    analytical: "leadership",
    growth: "personal",
  };
  const category = toneToCategory[tone] || "leadership";
  const [protocol] = await db
    .select()
    .from(protocols)
    .where(eq(protocols.category, category))
    .limit(1);

  if (protocol) {
    await db
      .update(workspaces)
      .set({ activeProtocolId: protocol.id, updatedAt: new Date() })
      .where(eq(workspaces.id, workspaceId));
  }

  return { canon, pillars, tone, protocol, healthAnalysis };
}

// ── Capture processing ──────────────────────────────────────────────────

async function seedProcessCapture(
  userId: string,
  workspaceId: string,
  content: string,
  canonId: string | null,
  canonEmbedding: number[] | null,
  captureDate: Date,
) {
  const [capture] = await db
    .insert(captures)
    .values({ userId, workspaceId, content, source: "web" })
    .returning();

  const captureEmbedding = await generateEmbedding(content);

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

  // Backdate
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

// ── Digest generation ───────────────────────────────────────────────────

async function generateDigest(
  workspaceId: string,
  weekStart: Date,
  goalPillarsText: string,
) {
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

VOICE: Like you're texting your co-founder at midnight. Plain words. Specific numbers. No jargon, no consulting-speak. Incomplete sentences are fine. Every word must earn its place.

${goalPillarsText}

THIS WEEK'S UPDATES (${weekArtifacts.length} items):
${synthesisText || "(No updates yet this week)"}

FORMAT RULES (STRICT):
- summary: 1-2 sentences. Max 20 words. The week in one breath.
- title: Max 8 words. Plain language. No subtitles, no em-dashes, no colons.
- detail: 1 sentence. Max 15 words. The one fact that makes you feel it.
- goalPillar: The exact pillar name from GOAL PILLARS that this relates to, or null if emergent work.
- priority: "critical" = do it today. "high" = do it this week. "medium" = track it.

ANTI-PATTERNS (do NOT do these):
- "The loss of X is not an isolated incident" → Just say "Lost X."
- Titles with em-dashes or subtitles → "Fix onboarding. Customer quit." not "Emergency Fix — Onboarding"
- Paragraphs in the detail field → 1 sentence max.

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
    schema: DIGEST_SCHEMA,
    temperature: 0.3,
  });

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

async function seedYCDemo() {
  console.log("=== Seeding Meridian YC Demo Workspace ===\n");

  // ── Step 1: Create organization ────────────────────────────────────
  console.log("1. Creating organization...");
  const [org] = await db
    .insert(organizations)
    .values({ name: "Meridian" })
    .returning();
  console.log(`   OK Organization: ${org.id}\n`);

  // ── Step 2: Create protagonist ─────────────────────────────────────
  console.log("2. Creating protagonist...");
  const passwordHash = await hash(DEMO_PASSWORD, 12);

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, PROTAGONIST.email))
    .limit(1);

  let protagonistId: string;
  if (existing) {
    protagonistId = existing.id;
    console.log(`   = ${PROTAGONIST.firstName} ${PROTAGONIST.lastName} (${PROTAGONIST.email}) -- already exists`);
  } else {
    const [user] = await db
      .insert(users)
      .values({
        email: PROTAGONIST.email,
        firstName: PROTAGONIST.firstName,
        lastName: PROTAGONIST.lastName,
        passwordHash,
        organizationId: org.id,
      })
      .returning();
    protagonistId = user.id;
    console.log(`   + ${PROTAGONIST.firstName} ${PROTAGONIST.lastName} (${PROTAGONIST.email})`);
  }
  console.log();

  // ── Step 3: Create workspace ───────────────────────────────────────
  console.log("3. Creating workspace...");
  const [workspace] = await db
    .insert(workspaces)
    .values({
      name: "Meridian Operations",
      organizationId: org.id,
      joinCode: nanoid(8),
    })
    .returning();
  console.log(`   OK Workspace: ${workspace.id}`);
  console.log(`   OK Join code: ${workspace.joinCode}\n`);

  // ── Step 4: Create protagonist membership ──────────────────────────
  console.log("4. Creating protagonist membership...");
  await db.insert(memberships).values({
    userId: protagonistId,
    workspaceId: workspace.id,
    role: "owner",
  });
  console.log(`   + ${PROTAGONIST.firstName} (owner)\n`);

  // ── Step 5: Process goals (strategy extraction + SMART) ────────────
  console.log("5. Processing goals (strategy extraction + SMART analysis)...");
  const strategyResult = await seedRunStrategy(workspace.id, V2MOM);
  console.log(`   OK Canon: ${strategyResult.canon.id}`);
  console.log(`   OK Pillars: ${strategyResult.pillars.length}`);
  console.log(`   OK SMART score: ${Math.round((strategyResult.healthAnalysis.overallScore) * 100)}%`);
  console.log(`   OK Tone: ${strategyResult.tone}`);
  console.log(`   OK Protocol: ${strategyResult.protocol?.name || "none"}`);

  // Override to Jensen T5T
  const [jensenProtocol] = await db
    .select({ id: protocols.id, name: protocols.name })
    .from(protocols)
    .where(eq(protocols.name, "Jensen T5T"))
    .limit(1);

  if (jensenProtocol) {
    await db
      .update(workspaces)
      .set({ activeProtocolId: jensenProtocol.id, updatedAt: new Date() })
      .where(eq(workspaces.id, workspace.id));
    console.log(`   OK Override protocol: Jensen T5T`);
  }
  console.log();

  const canonEmbedding = strategyResult.canon.embedding as number[] | null;

  // Week start for backdating
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + mondayOffset);
  weekStart.setHours(0, 0, 0, 0);

  // ── Step 6: Process protagonist's thought ──────────────────────────
  console.log("6. Processing protagonist's thought...");
  const protagonistCaptureDate = new Date(weekStart);
  protagonistCaptureDate.setHours(9, 0, 0, 0);

  const protagonistResult = await seedProcessCapture(
    protagonistId,
    workspace.id,
    PROTAGONIST_THOUGHT,
    strategyResult.canon.id,
    canonEmbedding,
    protagonistCaptureDate,
  );

  // Update protagonist membership
  await db
    .update(memberships)
    .set({
      tractionScore: protagonistResult.alignmentScore,
      lastCaptureAt: protagonistCaptureDate,
      streakCount: 1,
      updatedAt: protagonistCaptureDate,
    })
    .where(
      and(
        eq(memberships.userId, protagonistId),
        eq(memberships.workspaceId, workspace.id)
      )
    );

  console.log(
    `   -> ${Math.round(protagonistResult.alignmentScore * 100)}% aligned, sentiment ${protagonistResult.sentimentScore.toFixed(2)}`
  );
  console.log();
  await sleep(1500);

  // ── Step 7: Create team members + process captures ─────────────────
  console.log(`7. Creating team members and processing ${TEAM.length} captures...\n`);

  const userMap: Record<string, string> = {};

  for (const member of TEAM) {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, member.email))
      .limit(1);

    if (existing) {
      userMap[member.email] = existing.id;
    } else {
      const memberHash = await hash(DEMO_PASSWORD, 12);
      const [user] = await db
        .insert(users)
        .values({
          email: member.email,
          firstName: member.firstName,
          lastName: member.lastName,
          passwordHash: memberHash,
          organizationId: org.id,
        })
        .returning();
      userMap[member.email] = user.id;
    }

    // Create membership
    await db.insert(memberships).values({
      userId: userMap[member.email],
      workspaceId: workspace.id,
      role: "member",
    });
  }

  for (let i = 0; i < TEAM.length; i++) {
    const member = TEAM[i];
    const userId = userMap[member.email];
    const captureDate = new Date(weekStart);
    captureDate.setDate(weekStart.getDate() + i);
    captureDate.setHours(9 + i, 0, 0, 0);

    process.stdout.write(
      `   [${String(i + 1).padStart(2)}/${TEAM.length}] ${member.firstName.padEnd(8)} `
    );

    try {
      const result = await seedProcessCapture(
        userId,
        workspace.id,
        member.thought,
        strategyResult.canon.id,
        canonEmbedding,
        captureDate,
      );

      // Update membership traction score
      await db
        .update(memberships)
        .set({
          tractionScore: result.alignmentScore,
          lastCaptureAt: captureDate,
          streakCount: 1,
          updatedAt: captureDate,
        })
        .where(
          and(
            eq(memberships.userId, userId),
            eq(memberships.workspaceId, workspace.id)
          )
        );

      console.log(
        `-> ${Math.round(result.alignmentScore * 100)}% aligned, sentiment ${result.sentimentScore.toFixed(2)}`
      );

      if (i < TEAM.length - 1) {
        await sleep(1500);
      }
    } catch (error) {
      console.log(`X ERROR: ${error instanceof Error ? error.message : "unknown"}`);
      await sleep(5000);
    }
  }

  // ── Step 8: Generate digest ────────────────────────────────────────
  console.log("\n8. Generating Top 5 digest...");

  const pillarNames: string[] = strategyResult.healthAnalysis?.pillars
    ? strategyResult.healthAnalysis.pillars.map((p: { title: string }) => p.title)
    : [];

  const goalPillarsText = pillarNames.length > 0
    ? `GOAL PILLARS:\n${pillarNames.map((n: string, i: number) => `${i + 1}. ${n}`).join("\n")}`
    : `GOALS:\n${strategyResult.canon.content}`;

  try {
    const digest = await generateDigest(workspace.id, weekStart, goalPillarsText);
    console.log(`   OK: "${digest.summary}"`);
    for (const item of digest.items) {
      console.log(`      #${item.rank}: ${item.title} [${item.priority}]`);
    }
  } catch (error) {
    console.log(`   WARN: ${error instanceof Error ? error.message : "unknown"}`);
  }

  // ── Done! ──────────────────────────────────────────────────────────
  console.log("\n===============================================================");
  console.log("YC Demo workspace ready!");
  console.log("===============================================================");
  console.log();
  console.log(`   Dashboard URL: /dashboard/${workspace.id}`);
  console.log();
  console.log("   CREDENTIALS:");
  console.log(`   Email:    ${PROTAGONIST.email}`);
  console.log(`   Password: ${DEMO_PASSWORD}`);
  console.log();
  console.log(`   Protagonist: ${PROTAGONIST.firstName} ${PROTAGONIST.lastName} (CEO, Meridian)`);
  console.log(`   Team: ${TEAM.map((m) => `${m.firstName} ${m.lastName}`).join(", ")}`);
  console.log("===============================================================\n");
}

seedYCDemo().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
