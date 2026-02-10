import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";

// ── Anthropic (primary LLM) ──────────────────────────────────────────

let _anthropic: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }
  return _anthropic;
}

export const DEFAULT_MODEL = "claude-opus-4-6";

// ── Gemini (retained ONLY for embeddings) ────────────────────────────

let _gemini: GoogleGenAI | null = null;

function getGemini(): GoogleGenAI {
  if (!_gemini) {
    _gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return _gemini;
}

// ── Structured JSON generation via Anthropic ─────────────────────────

export async function generateStructuredJSON<T>(opts: {
  system?: string;
  prompt: string;
  schema: Record<string, unknown>;
  temperature?: number;
  maxTokens?: number;
}): Promise<{ result: T; inputTokens: number; outputTokens: number }> {
  const anthropic = getAnthropic();

  const response = await anthropic.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: opts.maxTokens ?? 4096,
    messages: [{ role: "user", content: opts.prompt }],
    ...(opts.system ? { system: opts.system } : {}),
    output_config: {
      format: {
        type: "json_schema" as const,
        schema: opts.schema,
      },
    },
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const text = textBlock && textBlock.type === "text" ? textBlock.text : "{}";

  return {
    result: JSON.parse(text) as T,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

// ── Embeddings (Gemini) ──────────────────────────────────────────────

export async function generateEmbedding(text: string): Promise<number[]> {
  const gemini = getGemini();
  const response = await gemini.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
    config: { outputDimensionality: 1536 },
  });
  return response.embeddings?.[0]?.values ?? [];
}

// ── Cost calculation (Anthropic Opus 4.6 pricing) ────────────────────
/**
 * Claude Opus 4.6 pricing (per 1M tokens):
 *   Input:  $5.00  -> 0.0005 cents/token
 *   Output: $25.00 -> 0.0025 cents/token
 */
export function calculateCostCents(
  inputTokens: number,
  outputTokens: number
): number {
  const inputCost = (inputTokens / 1_000_000) * 500; // $5.00 = 500 cents
  const outputCost = (outputTokens / 1_000_000) * 2500; // $25.00 = 2500 cents
  return Math.ceil(inputCost + outputCost);
}
