import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, desc, sql as dsql } from "drizzle-orm";
import {
  captures,
  artifacts,
  canons,
  memberships,
} from "@/lib/db/schema";
import { openai, generateEmbedding } from "@/lib/openai";

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
    driftScore: number;
    sentimentScore: number;
    content: string;
    actionItems: Array<{ task: string; status: string }>;
    feedback: string;
  };
  streakCount: number;
  tractionScore: number;
}

export async function processCapture(
  userId: string,
  workspaceId: string,
  content: string
): Promise<CaptureResult> {
  // 1. Create the capture record
  const [capture] = await db
    .insert(captures)
    .values({
      userId,
      workspaceId,
      content,
      source: "web",
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
  const analysis = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are an organizational intelligence agent. Analyze this employee update and extract:
1. sentiment_score: Float from -1.0 (very negative) to 1.0 (very positive)
2. action_items: Array of { task: string, status: "open" | "blocked" | "done" }
3. synthesis: A clean, professional summary of the update (2-3 sentences)
4. feedback: Coaching advice for the employee (1-2 sentences). Be direct and actionable.

Respond in JSON:
{
  "sentiment_score": 0.3,
  "action_items": [{"task": "...", "status": "open"}],
  "synthesis": "...",
  "feedback": "..."
}`,
      },
      {
        role: "user",
        content: content,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  const parsed = JSON.parse(analysis.choices[0].message.content || "{}");

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

  if (membership) {
    // Calculate streak: if last capture was within 48 hours, increment
    const now = new Date();
    const lastCapture = membership.lastCaptureAt;
    const hoursElapsed = lastCapture
      ? (now.getTime() - new Date(lastCapture).getTime()) / (1000 * 60 * 60)
      : Infinity;

    const newStreak =
      hoursElapsed <= 48 ? membership.streakCount + 1 : 1;

    // Rolling average traction score (inverse of drift)
    const traction = 1 - driftScore;
    const newTractionScore =
      membership.tractionScore === 0
        ? traction
        : membership.tractionScore * 0.7 + traction * 0.3;

    await db
      .update(memberships)
      .set({
        lastCaptureAt: now,
        streakCount: newStreak,
        tractionScore: Math.round(newTractionScore * 100) / 100,
        updatedAt: now,
      })
      .where(eq(memberships.id, membership.id));

    return {
      capture: { id: capture.id, content: capture.content },
      artifact: {
        id: artifact.id,
        driftScore: Math.round(driftScore * 100) / 100,
        sentimentScore: parsed.sentiment_score || 0,
        content: parsed.synthesis || content,
        actionItems: parsed.action_items || [],
        feedback: parsed.feedback || "",
      },
      streakCount: newStreak,
      tractionScore: Math.round(newTractionScore * 100) / 100,
    };
  }

  return {
    capture: { id: capture.id, content: capture.content },
    artifact: {
      id: artifact.id,
      driftScore: Math.round(driftScore * 100) / 100,
      sentimentScore: parsed.sentiment_score || 0,
      content: parsed.synthesis || content,
      actionItems: parsed.action_items || [],
      feedback: parsed.feedback || "",
    },
    streakCount: 0,
    tractionScore: 0,
  };
}
