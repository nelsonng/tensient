import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, desc, sql as dsql } from "drizzle-orm";
import {
  captures,
  artifacts,
  canons,
  memberships,
} from "@/lib/db/schema";
import { ai, DEFAULT_MODEL, generateEmbedding, calculateCostCents } from "@/lib/ai";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

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
  };
  streakCount: number;
  alignmentScore: number;
}

export interface CaptureUsage {
  inputTokens: number;
  outputTokens: number;
  estimatedCostCents: number;
}

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

  // 4. Calculate drift score
  let driftScore = 0.5; // default if no canon
  if (canon?.embedding) {
    const similarity = cosineSimilarity(
      captureEmbedding,
      canon.embedding as number[]
    );
    driftScore = Math.max(0, Math.min(1, 1 - similarity));
  }

  // 5. Extract sentiment, action items, and synthesize via LLM
  const analysis = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `You are an organizational intelligence agent. Analyze this employee update and extract:
1. sentiment_score: Float from -1.0 (very negative) to 1.0 (very positive)
2. action_items: Array of objects with task and status fields
3. synthesis: A clean, professional summary of the update (2-3 sentences)
4. feedback: Coaching advice for the employee (1-2 sentences). Be direct and actionable.

Here is the employee update:

${content}`,
          },
        ],
      },
    ],
    config: {
      temperature: 0.3,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object" as const,
        properties: {
          sentiment_score: { type: "number" as const },
          action_items: {
            type: "array" as const,
            items: {
              type: "object" as const,
              properties: {
                task: { type: "string" as const },
                status: {
                  type: "string" as const,
                  enum: ["open", "blocked", "done"],
                },
              },
              required: ["task", "status"],
            },
          },
          synthesis: { type: "string" as const },
          feedback: { type: "string" as const },
        },
        required: ["sentiment_score", "action_items", "synthesis", "feedback"],
      },
    },
  });

  const parsed = JSON.parse(analysis.text ?? "{}");

  const inputTokens = analysis.usageMetadata?.promptTokenCount ?? 0;
  const outputTokens = analysis.usageMetadata?.candidatesTokenCount ?? 0;

  // 6. Create artifact
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
      embedding: captureEmbedding,
    })
    .returning();

  // 7. Mark capture as processed
  await db
    .update(captures)
    .set({ processedAt: new Date() })
    .where(eq(captures.id, capture.id));

  // 8. Update membership gamification
  const [membership] = await db
    .select()
    .from(memberships)
    .where(
      dsql`${memberships.userId} = ${userId} AND ${memberships.workspaceId} = ${workspaceId}`
    )
    .limit(1);

  const alignmentScore = Math.round((1 - driftScore) * 100) / 100;

  const artifactResult = {
    id: artifact.id,
    alignmentScore,
    sentimentScore: parsed.sentiment_score || 0,
    content: parsed.synthesis || content,
    actionItems: parsed.action_items || [],
    feedback: parsed.feedback || "",
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
