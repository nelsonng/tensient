import { eq, desc, sql as dsql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  captures,
  artifacts,
  canons,
  memberships,
  protocols,
  actions,
} from "@/lib/db/schema";
import { generateStructuredJSON, generateEmbedding, calculateCostCents } from "@/lib/ai";
import { cosineSimilarity } from "@/lib/utils";

export interface CaptureResult {
  capture: {
    id: string;
    content: string;
  };
  artifact: {
    id: string;
    alignmentScore: number;
    sentimentScore: number;
    content: string;
    actionItems: Array<{ task: string; status: string }>;
    feedback: string;
    coachingQuestions: Array<{ coach: string; question: string }>;
    alignmentExplanation: string;
  };
  streakCount: number;
  alignmentScore: number;
}

export interface RefineSynthesisResult {
  artifact: {
    id: string;
    alignmentScore: number;
    sentimentScore: number;
    content: string;
    actionItems: Array<{ task: string; status: string }>;
    feedback: string;
    coachingQuestions: Array<{ coach: string; question: string }>;
    alignmentExplanation: string;
  };
  iterationCount: number;
}

export interface CaptureUsage {
  inputTokens: number;
  outputTokens: number;
  estimatedCostCents: number;
}

// ── LLM response type ───────────────────────────────────────────────────

interface CaptureAnalysisResponse {
  sentiment_score: number;
  action_items: Array<{ task: string; status: string }>;
  synthesis: string;
  feedback: string;
  coaching_questions: Array<{ coach: string; question: string }>;
  alignment_explanation: string;
  goal_pillar?: string;
}

const CAPTURE_ANALYSIS_SCHEMA = {
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
    alignment_explanation: { type: "string" },
    goal_pillar: { type: "string" },
  },
  required: ["sentiment_score", "action_items", "synthesis", "feedback", "coaching_questions", "alignment_explanation"],
  additionalProperties: false,
};

export async function processCapture(
  userId: string,
  workspaceId: string,
  content: string,
  source: "web" | "voice" = "web",
  audioUrl?: string
): Promise<{ result: CaptureResult; usage: CaptureUsage }> {
  // 1. Create the capture record
  const [capture] = await db
    .insert(captures)
    .values({
      userId,
      workspaceId,
      content,
      source,
      ...(audioUrl ? { audioUrl } : {}),
    })
    .returning();

  // 2. Generate embedding for the capture
  const captureEmbedding = await generateEmbedding(content);

  // 3. Get the latest Canon for drift comparison
  const [canon] = await db
    .select()
    .from(canons)
    .where(eq(canons.workspaceId, workspaceId))
    .orderBy(desc(canons.createdAt))
    .limit(1);

  // 3b. Extract goal pillar titles from healthAnalysis
  const pillarTitles: string[] = canon?.healthAnalysis
    ? (((canon.healthAnalysis as Record<string, unknown>).pillars as Array<{ title: string }>) || []).map((p) => p.title)
    : [];

  // 4. Calculate drift score (calibrated)
  // Raw cosine similarity for business text embeddings clusters in [0.35, 0.85].
  // We stretch that band to [0, 1] so alignment scores show meaningful spread.
  const SIMILARITY_FLOOR = 0.35;
  const SIMILARITY_CEILING = 0.85;

  let driftScore = 0.5; // default if no canon
  if (canon?.embedding) {
    const rawSimilarity = cosineSimilarity(
      captureEmbedding,
      canon.embedding as number[]
    );
    const calibrated = Math.max(
      0,
      Math.min(1, (rawSimilarity - SIMILARITY_FLOOR) / (SIMILARITY_CEILING - SIMILARITY_FLOOR))
    );
    driftScore = Math.max(0, Math.min(1, 1 - calibrated));
  }

  // 5. Fetch all public coaches for composite prompt
  const allCoaches = await db
    .select({
      name: protocols.name,
      systemPrompt: protocols.systemPrompt,
    })
    .from(protocols)
    .where(eq(protocols.isPublic, true));

  // Build composite coaching context
  const coachNames = allCoaches.map((c) => c.name);
  let coachingContext = "";
  if (allCoaches.length > 0) {
    coachingContext = `\n\nYou have access to multiple coaching perspectives. Apply ALL of the following lenses when analyzing:\n\n`;
    coachingContext += allCoaches
      .map((c) => `[COACH: ${c.name}]\n${c.systemPrompt}`)
      .join("\n\n");
  }

  // 6. Extract sentiment, action items, synthesis, coaching questions, and alignment explanation via LLM
  const analysis = await generateStructuredJSON<CaptureAnalysisResponse>({
    prompt: `You are an organizational intelligence agent with multiple coaching perspectives.${coachingContext}

Analyze this employee update and extract:
1. sentiment_score: Float from -1.0 (very negative) to 1.0 (very positive)
2. action_items: Array of objects with task and status fields. These are concrete next steps extracted from the update. Do NOT attribute actions to individual coaches.
3. synthesis: A clean, professional summary of the update (2-3 sentences). This should be an IMPROVED version -- clearer, more actionable, and better structured than the raw input.
4. feedback: Brief overall coaching advice (1-2 sentences). Be direct and actionable.
5. coaching_questions: Pick the 3-4 MOST RELEVANT coaches from the lenses above. For each, generate ONE specific question that would help the person improve their update or uncover missing context. Questions should be conversational and direct.
6. alignment_explanation: Explain specifically why the alignment with strategic goals is what it is. Name which strategic pillars are addressed by this update and which are not. Be specific: "This update covers [Pillar A] and [Pillar B] but does not address [Pillar C]."${pillarTitles.length > 0 ? `
7. goal_pillar: Which single strategic goal pillar this update most closely relates to. Use the EXACT title from the list below, or null if none apply.

The organization has these strategic goal pillars:
${pillarTitles.map((t, i) => `${i + 1}. ${t}`).join("\n")}` : ""}

Here is the employee update:

${content}`,
    schema: CAPTURE_ANALYSIS_SCHEMA,
    temperature: 0.3,
  });

  const parsed = analysis.result;

  const inputTokens = analysis.inputTokens;
  const outputTokens = analysis.outputTokens;

  // 7. Create artifact
  const assignedPillar = parsed.goal_pillar || null;

  const [artifact] = await db
    .insert(artifacts)
    .values({
      captureId: capture.id,
      canonId: canon?.id || null,
      driftScore,
      sentimentScore: parsed.sentiment_score || 0,
      content: parsed.synthesis || content,
      actionItems: parsed.action_items || [],
      feedback: parsed.feedback || "",
      goalPillar: assignedPillar,
      embedding: captureEmbedding,
    })
    .returning();

  // 8. Create action items as first-class rows (no coach attribution on individual actions)
  const actionItems: Array<{ task: string; status: string }> = parsed.action_items || [];

  if (actionItems.length > 0 && canon?.embedding) {
    for (const item of actionItems) {
      let goalAlignmentScore: number | null = null;
      let goalId: string | null = null;

      try {
        const actionEmbedding = await generateEmbedding(item.task);
        const similarity = cosineSimilarity(actionEmbedding, canon.embedding as number[]);
        goalAlignmentScore = Math.round(similarity * 100) / 100;
        if (similarity > 0.3) {
          goalId = canon.id;
        }
      } catch {
        // Non-critical: skip embedding if it fails
      }

      await db.insert(actions).values({
        workspaceId,
        userId,
        artifactId: artifact.id,
        goalId,
        title: item.task,
        status: item.status === "done" ? "done" : item.status === "blocked" ? "blocked" : "open",
        priority: "medium",
        goalAlignmentScore,
        goalPillar: assignedPillar,
      });
    }
  } else if (actionItems.length > 0) {
    for (const item of actionItems) {
      await db.insert(actions).values({
        workspaceId,
        userId,
        artifactId: artifact.id,
        title: item.task,
        status: item.status === "done" ? "done" : item.status === "blocked" ? "blocked" : "open",
        priority: "medium",
        goalPillar: assignedPillar,
      });
    }
  }

  // 9. Mark capture as processed
  await db
    .update(captures)
    .set({ processedAt: new Date() })
    .where(eq(captures.id, capture.id));

  // 10. Update membership gamification
  const [membership] = await db
    .select()
    .from(memberships)
    .where(
      dsql`${memberships.userId} = ${userId} AND ${memberships.workspaceId} = ${workspaceId}`
    )
    .limit(1);

  const alignmentScore = Math.round((1 - driftScore) * 100) / 100;

  // Filter coaching questions to known coach names
  const coachingQuestions = (parsed.coaching_questions ?? [])
    .filter((cq: { coach: string; question: string }) => coachNames.includes(cq.coach))
    .map((cq: { coach: string; question: string }) => ({
      coach: cq.coach,
      question: cq.question,
    }));

  const artifactResult = {
    id: artifact.id,
    alignmentScore,
    sentimentScore: parsed.sentiment_score || 0,
    content: parsed.synthesis || content,
    actionItems: (parsed.action_items || []).map((a: { task: string; status: string }) => ({
      task: a.task,
      status: a.status,
    })),
    feedback: parsed.feedback || "",
    coachingQuestions,
    alignmentExplanation: parsed.alignment_explanation || "",
  };

  const usageData: CaptureUsage = {
    inputTokens,
    outputTokens,
    estimatedCostCents: calculateCostCents(inputTokens, outputTokens),
  };

  if (membership) {
    // Calculate streak: if last capture was within 48 hours, increment
    const now = new Date();
    const lastCapture = membership.lastCaptureAt;
    const hoursElapsed = lastCapture
      ? (now.getTime() - new Date(lastCapture).getTime()) / (1000 * 60 * 60)
      : Infinity;

    const newStreak =
      hoursElapsed <= 48 ? membership.streakCount + 1 : 1;

    // Rolling average alignment score (inverse of drift)
    const newAlignmentScore =
      membership.tractionScore === 0
        ? alignmentScore
        : membership.tractionScore * 0.7 + alignmentScore * 0.3;

    await db
      .update(memberships)
      .set({
        lastCaptureAt: now,
        streakCount: newStreak,
        tractionScore: Math.round(newAlignmentScore * 100) / 100,
        updatedAt: now,
      })
      .where(eq(memberships.id, membership.id));

    return {
      result: {
        capture: { id: capture.id, content: capture.content },
        artifact: artifactResult,
        streakCount: newStreak,
        alignmentScore: Math.round(newAlignmentScore * 100) / 100,
      },
      usage: usageData,
    };
  }

  return {
    result: {
      capture: { id: capture.id, content: capture.content },
      artifact: artifactResult,
      streakCount: 0,
      alignmentScore: 0,
    },
    usage: usageData,
  };
}

// ── Refine Synthesis (iteration on thoughts) ───────────────────────────

export async function refineSynthesis(
  userId: string,
  workspaceId: string,
  artifactId: string,
  feedback: string
): Promise<{ result: RefineSynthesisResult; usage: CaptureUsage }> {
  // Load existing artifact + its capture
  const [existingArtifact] = await db
    .select()
    .from(artifacts)
    .where(eq(artifacts.id, artifactId))
    .limit(1);

  if (!existingArtifact) {
    throw new Error("Artifact not found");
  }

  const [originalCapture] = existingArtifact.captureId
    ? await db.select().from(captures).where(eq(captures.id, existingArtifact.captureId)).limit(1)
    : [null];

  // Count previous artifacts for this capture to track iteration
  const previousArtifacts = originalCapture
    ? await db.select({ id: artifacts.id }).from(artifacts).where(eq(artifacts.captureId, originalCapture.id))
    : [];
  const iterationCount = previousArtifacts.length + 1;

  // Get latest canon for drift comparison
  const [canon] = await db
    .select()
    .from(canons)
    .where(eq(canons.workspaceId, workspaceId))
    .orderBy(desc(canons.createdAt))
    .limit(1);

  const pillarTitles: string[] = canon?.healthAnalysis
    ? (((canon.healthAnalysis as Record<string, unknown>).pillars as Array<{ title: string }>) || []).map((p) => p.title)
    : [];

  // Fetch all public coaches for composite prompt
  const allCoaches = await db
    .select({ name: protocols.name, systemPrompt: protocols.systemPrompt })
    .from(protocols)
    .where(eq(protocols.isPublic, true));

  const refineCoachNames = allCoaches.map((c) => c.name);
  let coachingContext = "";
  if (allCoaches.length > 0) {
    coachingContext = `\n\nYou have access to multiple coaching perspectives. Apply ALL of the following lenses:\n\n`;
    coachingContext += allCoaches
      .map((c) => `[COACH: ${c.name}]\n${c.systemPrompt}`)
      .join("\n\n");
  }

  // Build the refinement prompt with full context
  const analysis = await generateStructuredJSON<CaptureAnalysisResponse>({
    prompt: `You are an organizational intelligence agent refining a synthesis through coaching iteration. The user answered coaching questions or provided additional context. Your job is to IMPROVE the synthesis based on their answers.${coachingContext}

ORIGINAL INPUT:
${originalCapture?.content ?? "(no original capture)"}

PREVIOUS SYNTHESIS:
${existingArtifact.content}

PREVIOUS COACHING FEEDBACK:
${existingArtifact.feedback || "(none)"}

USER'S ANSWERS / ADDITIONAL CONTEXT:
${feedback}

INSTRUCTIONS:
1. sentiment_score: Float from -1.0 to 1.0 reflecting the UPDATED emotional state
2. action_items: IMPROVED array of objects with task and status. Incorporate the user's answers to add, modify, or reprioritize actions. Do NOT attribute actions to individual coaches.
3. synthesis: An IMPROVED professional summary that integrates the user's answers (2-3 sentences). Make it clearer, more actionable, and better structured.
4. feedback: Brief overall coaching advice (1-2 sentences) on what improved and what still needs attention.
5. coaching_questions: Pick the 3-4 MOST RELEVANT coaches. For each, generate ONE specific follow-up question targeting remaining gaps or weaknesses. Questions should push toward better clarity and actionability.
6. alignment_explanation: Explain specifically why the alignment with strategic goals is what it is. Name which strategic pillars are addressed and which are not. Be specific.${pillarTitles.length > 0 ? `
7. goal_pillar: Which single strategic goal pillar this update most closely relates to. Use the EXACT title from: ${pillarTitles.join(", ")}` : ""}`,
    schema: CAPTURE_ANALYSIS_SCHEMA,
    temperature: 0.3,
  });

  const parsed = analysis.result;

  const inputTokens = analysis.inputTokens;
  const outputTokens = analysis.outputTokens;

  // Calculate drift for the improved synthesis
  const synthesisEmbedding = await generateEmbedding(parsed.synthesis || feedback);
  let driftScore = 0.5;
  if (canon?.embedding) {
    const similarity = cosineSimilarity(synthesisEmbedding, canon.embedding as number[]);
    driftScore = Math.max(0, Math.min(1, 1 - similarity));
  }

  const alignmentScore = Math.round((1 - driftScore) * 100) / 100;
  const assignedPillar = parsed.goal_pillar || null;

  // Create new artifact (linked to original capture)
  const [newArtifact] = await db
    .insert(artifacts)
    .values({
      captureId: existingArtifact.captureId, // always exists -- original artifact has it
      canonId: canon?.id || null,
      driftScore,
      sentimentScore: parsed.sentiment_score || 0,
      content: parsed.synthesis || feedback,
      actionItems: parsed.action_items || [],
      feedback: parsed.feedback || "",
      goalPillar: assignedPillar,
      embedding: synthesisEmbedding,
    })
    .returning();

  // Create action items as first-class rows (no coach attribution on individual actions)
  const refineActionItems: Array<{ task: string; status: string }> = parsed.action_items || [];

  for (const item of refineActionItems) {
    let goalAlignmentScore: number | null = null;
    let goalId: string | null = null;

    if (canon?.embedding) {
      try {
        const actionEmbedding = await generateEmbedding(item.task);
        const similarity = cosineSimilarity(actionEmbedding, canon.embedding as number[]);
        goalAlignmentScore = Math.round(similarity * 100) / 100;
        if (similarity > 0.3) goalId = canon.id;
      } catch {
        // Non-critical
      }
    }

    await db.insert(actions).values({
      workspaceId,
      userId,
      artifactId: newArtifact.id,
      goalId,
      title: item.task,
      status: item.status === "done" ? "done" : item.status === "blocked" ? "blocked" : "open",
      priority: "medium",
      goalAlignmentScore,
      goalPillar: assignedPillar,
    });
  }

  // Filter coaching questions to known coach names
  const refineCoachingQuestions = (parsed.coaching_questions ?? [])
    .filter((cq: { coach: string; question: string }) => refineCoachNames.includes(cq.coach))
    .map((cq: { coach: string; question: string }) => ({
      coach: cq.coach,
      question: cq.question,
    }));

  return {
    result: {
      artifact: {
        id: newArtifact.id,
        alignmentScore,
        sentimentScore: parsed.sentiment_score || 0,
        content: parsed.synthesis || feedback,
        actionItems: (parsed.action_items || []).map((a: { task: string; status: string }) => ({
          task: a.task,
          status: a.status,
        })),
        feedback: parsed.feedback || "",
        coachingQuestions: refineCoachingQuestions,
        alignmentExplanation: parsed.alignment_explanation || "",
      },
      iterationCount,
    },
    usage: {
      inputTokens,
      outputTokens,
      estimatedCostCents: calculateCostCents(inputTokens, outputTokens),
    },
  };
}
