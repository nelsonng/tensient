import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { canons, protocols, workspaces } from "@/lib/db/schema";
import { ai, DEFAULT_MODEL, generateEmbedding, calculateCostCents } from "@/lib/ai";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

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
}

export interface StrategyUsage {
  inputTokens: number;
  outputTokens: number;
  estimatedCostCents: number;
}

export async function runStrategy(
  workspaceId: string,
  rawInput: string
): Promise<{ result: StrategyResult; usage: StrategyUsage }> {
  // 1. Extract strategic pillars and tone via LLM
  const extraction = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `You are a strategic advisor. Given a leader's raw strategic input, extract:
1. The core 3-5 strategic pillars (concise, actionable statements)
2. The overall tone (one of: "wartime", "peacetime", "analytical", "growth")
3. A synthesized strategy document (2-3 paragraphs)

Here is the strategic input:

${rawInput}`,
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
          pillars: {
            type: "array" as const,
            items: { type: "string" as const },
          },
          tone: {
            type: "string" as const,
            enum: ["wartime", "peacetime", "analytical", "growth"],
          },
          synthesis: { type: "string" as const },
        },
        required: ["pillars", "tone", "synthesis"],
      },
    },
  });

  const parsed = JSON.parse(extraction.text ?? "{}");
  const { pillars, tone, synthesis } = parsed;

  const inputTokens = extraction.usageMetadata?.promptTokenCount ?? 0;
  const outputTokens = extraction.usageMetadata?.candidatesTokenCount ?? 0;

  // 2. Generate embedding for the synthesized strategy
  const embedding = await generateEmbedding(synthesis);

  // 3. Create Canon record
  const [canon] = await db
    .insert(canons)
    .values({
      workspaceId,
      content: synthesis,
      embedding,
      rawInput,
    })
    .returning();

  // 4. Select best-fit protocol based on tone
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

  // 5. Assign protocol to workspace
  if (protocol) {
    await db
      .update(workspaces)
      .set({ activeProtocolId: protocol.id, updatedAt: new Date() })
      .where(eq(workspaces.id, workspaceId));
  }

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
    },
    usage: {
      inputTokens,
      outputTokens,
      estimatedCostCents: calculateCostCents(inputTokens, outputTokens),
    },
  };
}
