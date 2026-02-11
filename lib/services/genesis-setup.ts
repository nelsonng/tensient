import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { canons, protocols, workspaces } from "@/lib/db/schema";
import { generateStructuredJSON, generateEmbedding, calculateCostCents } from "@/lib/ai";

// ── Types ──────────────────────────────────────────────────────────────

interface CoachingQuestion {
  coach: string;
  question: string;
}

interface SmartScore {
  specific: number;
  measurable: number;
  achievable: number;
  relevant: number;
  timeBound: number;
}

interface PillarHealth {
  title: string;
  score: number;
  smart: SmartScore;
  suggestion: string;
}

interface HealthAnalysis {
  overallScore: number;
  pillars: PillarHealth[];
}

interface StrategyResult {
  canon: {
    id: string;
    content: string;
    rawInput: string;
  };
  protocol: {
    id: string;
    name: string;
  } | null;
  pillars: string[];
  tone: string;
  coachingQuestions: CoachingQuestion[];
  improvementRationale: string;
  healthAnalysis: HealthAnalysis | null;
  teamMembers: Array<{ name: string; role: string }>;
}

export interface StrategyUsage {
  inputTokens: number;
  outputTokens: number;
  estimatedCostCents: number;
}

// ── LLM response types ──────────────────────────────────────────────────

interface ExtractionResponse {
  pillars: string[];
  tone: string;
  synthesis: string;
  improvement_rationale: string;
  coaching_questions: Array<{ coach: string; question: string }>;
  team_members: Array<{ name: string; role: string }>;
}

interface SmartResponse {
  overall_score: number;
  pillars: Array<{
    title: string;
    score: number;
    smart: {
      specific: number;
      measurable: number;
      achievable: number;
      relevant: number;
      time_bound: number;
    };
    suggestion: string;
  }>;
}

// ── Schemas (Anthropic JSON Schema format) ───────────────────────────

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    pillars: {
      type: "array",
      items: { type: "string" },
    },
    tone: {
      type: "string",
      enum: ["wartime", "peacetime", "analytical", "growth"],
    },
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
    team_members: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          role: { type: "string" },
        },
        required: ["name", "role"],
        additionalProperties: false,
      },
    },
  },
  required: ["pillars", "tone", "synthesis", "improvement_rationale", "coaching_questions", "team_members"],
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

// ── Build composite coaching context from all public coaches ───────────

async function buildCoachingContext(): Promise<{ context: string; coachNames: string[] }> {
  const allCoaches = await db
    .select({ name: protocols.name, systemPrompt: protocols.systemPrompt })
    .from(protocols)
    .where(eq(protocols.isPublic, true));

  const coachNames = allCoaches.map((c) => c.name);
  const context = allCoaches
    .map((c) => `[COACH: ${c.name}]\n${c.systemPrompt}`)
    .join("\n\n");

  return { context, coachNames };
}

// ── Run Strategy (initial goal setting) ────────────────────────────────

export async function runStrategy(
  workspaceId: string,
  rawInput: string
): Promise<{ result: StrategyResult; usage: StrategyUsage }> {
  const { context: coachingContext, coachNames } = await buildCoachingContext();

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // 1. Extract strategic pillars, tone, synthesis + coaching questions + rationale
  const extraction = await generateStructuredJSON<ExtractionResponse>({
    prompt: `You are a strategic advisor with access to multiple coaching lenses. Given a leader's raw strategic input:

1. Extract the core 3-5 strategic pillars (concise, actionable statements). IMPROVE them where obvious improvements are possible -- make them more specific, measurable, or time-bound.
2. Detect the overall tone (one of: "wartime", "peacetime", "analytical", "growth")
3. Synthesize a strategy document (2-3 paragraphs) -- this is the IMPROVED version
4. Provide an improvement_rationale: 2-3 sentences explaining what you improved from the raw input and why. Be specific about what changed.
5. From the coaching lenses below, pick the 3-4 MOST RELEVANT coaches for this input. For each, generate ONE specific question that would help improve these goals further. Questions should target the weakest areas. Questions should be conversational and direct -- as if the coach is sitting across from the user.
6. Extract any team member names and roles/titles mentioned in the input. If the user mentions specific people ("Marcus is behind on the API", "Rachel is handling product"), extract their name and their role/title if mentioned. If role is not explicitly stated, infer it from context (e.g., "working on the API" → "Engineer"). Return as team_members array. If no names are mentioned, return an empty array.

COACHING LENSES:
${coachingContext}

RAW STRATEGIC INPUT:
${rawInput}`,
    schema: EXTRACTION_SCHEMA,
    temperature: 0.3,
  });

  const { pillars, tone, synthesis, coaching_questions, improvement_rationale, team_members } = extraction.result;
  totalInputTokens += extraction.inputTokens;
  totalOutputTokens += extraction.outputTokens;

  // 2. Run SMART analysis on the extracted pillars
  const smartAnalysis = await generateStructuredJSON<SmartResponse>({
    prompt: `You are a goal quality analyst. Evaluate the following strategic pillars against the SMART framework (Specific, Measurable, Achievable, Relevant, Time-bound).

For each pillar, provide:
- A score from 0.0 to 1.0 for each SMART dimension
- An overall score (average of the 5 dimensions)
- One specific suggestion to improve the pillar

Also provide an overall_score across all pillars (average of all pillar scores).

STRATEGIC PILLARS:
${pillars.map((p: string, i: number) => `${i + 1}. ${p}`).join("\n")}

CONTEXT (full strategy):
${synthesis}`,
    schema: SMART_SCHEMA,
    temperature: 0.2,
  });

  totalInputTokens += smartAnalysis.inputTokens;
  totalOutputTokens += smartAnalysis.outputTokens;

  const healthAnalysis: HealthAnalysis = {
    overallScore: smartAnalysis.result.overall_score ?? 0.5,
    pillars: (smartAnalysis.result.pillars ?? []).map((p) => ({
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

  // 3. Generate embedding for the synthesized strategy
  const embedding = await generateEmbedding(synthesis);

  // 4. Create Canon record (with health analysis)
  const [canon] = await db
    .insert(canons)
    .values({
      workspaceId,
      content: synthesis,
      embedding,
      rawInput,
      healthScore: healthAnalysis.overallScore,
      healthAnalysis: healthAnalysis,
    })
    .returning();

  // 5. Select best-fit protocol based on tone
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

  // 6. Assign protocol to workspace
  if (protocol) {
    await db
      .update(workspaces)
      .set({ activeProtocolId: protocol.id, updatedAt: new Date() })
      .where(eq(workspaces.id, workspaceId));
  }

  // Map coaching questions, filtering to known coach names
  const coachingQuestions: CoachingQuestion[] = (coaching_questions ?? [])
    .filter((cq) => coachNames.includes(cq.coach))
    .map((cq) => ({ coach: cq.coach, question: cq.question }));

  return {
    result: {
      canon: {
        id: canon.id,
        content: canon.content,
        rawInput: rawInput,
      },
      protocol: protocol ? { id: protocol.id, name: protocol.name } : null,
      pillars,
      tone,
      coachingQuestions,
      improvementRationale: improvement_rationale || "",
      healthAnalysis,
      teamMembers: team_members ?? [],
    },
    usage: {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      estimatedCostCents: calculateCostCents(totalInputTokens, totalOutputTokens),
    },
  };
}

// ── Refine Strategy (iteration on goals) ───────────────────────────────

export interface RefineStrategyResult {
  canon: {
    id: string;
    content: string;
    rawInput: string;
  };
  pillars: string[];
  tone: string;
  coachingQuestions: CoachingQuestion[];
  improvementRationale: string;
  healthAnalysis: HealthAnalysis | null;
  iterationCount: number;
}

export async function refineStrategy(
  workspaceId: string,
  canonId: string,
  feedback: string
): Promise<{ result: RefineStrategyResult; usage: StrategyUsage }> {
  // Load existing canon
  const [existingCanon] = await db
    .select()
    .from(canons)
    .where(eq(canons.id, canonId))
    .limit(1);

  if (!existingCanon) {
    throw new Error("Canon not found");
  }

  // Count previous versions for this workspace
  const previousCanons = await db
    .select({ id: canons.id })
    .from(canons)
    .where(eq(canons.workspaceId, workspaceId));
  const iterationCount = previousCanons.length + 1;

  const { context: coachingContext, coachNames } = await buildCoachingContext();

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // Run refinement with full context
  const extraction = await generateStructuredJSON<ExtractionResponse>({
    prompt: `You are a strategic advisor refining a team's goals through coaching iteration. The user answered coaching questions or provided feedback. Your job is to IMPROVE the strategy based on their answers.

PREVIOUS STRATEGY (synthesized):
${existingCanon.content}

ORIGINAL RAW INPUT:
${existingCanon.rawInput}

USER'S ANSWERS / ADDITIONAL CONTEXT:
${feedback}

INSTRUCTIONS:
1. Incorporate the user's answers to produce IMPROVED strategic pillars (3-5 concise, actionable statements). Make them more specific, measurable, and time-bound based on what the user shared.
2. Detect the overall tone (one of: "wartime", "peacetime", "analytical", "growth")
3. Produce an improved synthesis (2-3 paragraphs) that integrates the new information
4. Provide an improvement_rationale: 2-3 sentences explaining specifically what improved from the previous version and why. Reference the user's answers.
5. From the coaching lenses below, pick the 3-4 MOST RELEVANT coaches. For each, generate ONE specific follow-up question targeting remaining weaknesses. Questions should push toward even sharper goals. If the goals are getting strong, questions can be more advanced (dependencies, sequencing, risk).

COACHING LENSES:
${coachingContext}`,
    schema: EXTRACTION_SCHEMA,
    temperature: 0.3,
  });

  const { pillars, tone, synthesis, coaching_questions, improvement_rationale } = extraction.result;
  totalInputTokens += extraction.inputTokens;
  totalOutputTokens += extraction.outputTokens;

  // Run SMART analysis on refined pillars
  const smartAnalysis = await generateStructuredJSON<SmartResponse>({
    prompt: `You are a goal quality analyst. Evaluate the following strategic pillars against the SMART framework (Specific, Measurable, Achievable, Relevant, Time-bound).

For each pillar, provide:
- A score from 0.0 to 1.0 for each SMART dimension
- An overall score (average of the 5 dimensions)
- One specific suggestion to improve the pillar

Also provide an overall_score across all pillars (average of all pillar scores).

STRATEGIC PILLARS:
${pillars.map((p: string, i: number) => `${i + 1}. ${p}`).join("\n")}

CONTEXT (full strategy):
${synthesis}`,
    schema: SMART_SCHEMA,
    temperature: 0.2,
  });

  totalInputTokens += smartAnalysis.inputTokens;
  totalOutputTokens += smartAnalysis.outputTokens;

  const healthAnalysis: HealthAnalysis = {
    overallScore: smartAnalysis.result.overall_score ?? 0.5,
    pillars: (smartAnalysis.result.pillars ?? []).map((p) => ({
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

  // Generate new embedding
  const embedding = await generateEmbedding(synthesis);

  // Create new Canon version (append, not overwrite)
  const combinedRawInput = `${existingCanon.rawInput}\n\n--- Iteration feedback ---\n${feedback}`;
  const [canon] = await db
    .insert(canons)
    .values({
      workspaceId,
      content: synthesis,
      embedding,
      rawInput: combinedRawInput,
      healthScore: healthAnalysis.overallScore,
      healthAnalysis: healthAnalysis,
    })
    .returning();

  const coachingQuestions: CoachingQuestion[] = (coaching_questions ?? [])
    .filter((cq) => coachNames.includes(cq.coach))
    .map((cq) => ({ coach: cq.coach, question: cq.question }));

  return {
    result: {
      canon: {
        id: canon.id,
        content: canon.content,
        rawInput: combinedRawInput,
      },
      pillars,
      tone,
      coachingQuestions,
      improvementRationale: improvement_rationale || "",
      healthAnalysis,
      iterationCount,
    },
    usage: {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      estimatedCostCents: calculateCostCents(totalInputTokens, totalOutputTokens),
    },
  };
}
