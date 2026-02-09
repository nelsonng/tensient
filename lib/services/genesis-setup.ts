import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { canons, protocols, workspaces } from "@/lib/db/schema";
import { openai, generateEmbedding } from "@/lib/openai";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

interface GenesisResult {
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

export async function runGenesis(
  workspaceId: string,
  rawInput: string
): Promise<GenesisResult> {
  // 1. Extract strategic pillars and tone via LLM
  const extraction = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a strategic advisor. Given a leader's raw strategic input, extract:
1. The core 3-5 strategic pillars (concise, actionable statements)
2. The overall tone (one of: "wartime", "peacetime", "analytical", "growth")
3. A synthesized strategy document (2-3 paragraphs)

Respond in JSON format:
{
  "pillars": ["pillar 1", "pillar 2", ...],
  "tone": "wartime|peacetime|analytical|growth",
  "synthesis": "The synthesized strategy..."
}`,
      },
      {
        role: "user",
        content: rawInput,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  const parsed = JSON.parse(extraction.choices[0].message.content || "{}");
  const { pillars, tone, synthesis } = parsed;

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
    canon: {
      id: canon.id,
      content: canon.content,
      rawInput: rawInput,
    },
    protocol: protocol ? { id: protocol.id, name: protocol.name } : null,
    pillars,
    tone,
  };
}
