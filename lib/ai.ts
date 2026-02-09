import { GoogleGenAI } from "@google/genai";

export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const DEFAULT_MODEL = "gemini-3-pro-preview";

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
    config: { outputDimensionality: 1536 },
  });
  return response.embeddings?.[0]?.values ?? [];
}

/**
 * Calculate estimated cost in cents for a Gemini API call.
 * Gemini 3 Pro pricing (per 1M tokens):
 *   Input:  $2.00  -> 0.0002 cents/token
 *   Output: $12.00 -> 0.0012 cents/token
 */
export function calculateCostCents(
  inputTokens: number,
  outputTokens: number
): number {
  const inputCost = (inputTokens / 1_000_000) * 200; // $2.00 = 200 cents
  const outputCost = (outputTokens / 1_000_000) * 1200; // $12.00 = 1200 cents
  return Math.ceil(inputCost + outputCost); // round up to nearest cent
}
