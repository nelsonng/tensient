import { GoogleGenAI } from "@google/genai";

let _gemini: GoogleGenAI | null = null;

function getGemini(): GoogleGenAI {
  if (!_gemini) {
    _gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return _gemini;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const gemini = getGemini();
  const response = await gemini.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
    config: { outputDimensionality: 1536 },
  });
  return response.embeddings?.[0]?.values ?? [];
}
