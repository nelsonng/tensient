import { generateStructuredJSON } from "../lib/ai";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const AI_RESPONSE_SCHEMA = {
  type: "object" as const,
  properties: {
    reply: {
      type: "string" as const,
      description: "The conversational response to the user",
    },
    sentiment: {
      type: "number" as const,
      description: "Sentiment score from -1.0 (negative) to 1.0 (positive)",
    },
    actions: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          task: { type: "string" as const },
          priority: {
            type: "string" as const,
            enum: ["critical", "high", "medium", "low"],
          },
        },
        required: ["task"] as const,
        additionalProperties: false,
      },
      description: "Action items extracted from the conversation",
    },
    coachingQuestions: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "Reflective questions to help the user think deeper",
    },
    alignmentNote: {
      type: "string" as const,
      description:
        "Brief note on how the user's thinking aligns with or diverges from their stated goals",
    },
  },
  required: ["reply"] as const,
  additionalProperties: false,
};

async function main() {
  try {
    const result = await generateStructuredJSON<{ reply: string }>({
      system: "You are a helpful assistant. Return JSON that matches the schema.",
      prompt: "User: I need help prioritizing my roadmap for next week.",
      schema: AI_RESPONSE_SCHEMA,
      maxTokens: 256,
    });

    console.log("Smoke test passed.");
    console.log("Reply:", result.result.reply);
    console.log("Usage:", {
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    });
  } catch (error) {
    const unknownError = error as
      | {
          status?: number;
          type?: string;
          error?: unknown;
          message?: string;
          name?: string;
        }
      | undefined;

    console.error("Smoke test failed.");
    console.error("name:", unknownError?.name ?? "unknown");
    console.error("message:", unknownError?.message ?? "unknown");
    console.error("status:", unknownError?.status ?? "unknown");
    console.error("type:", unknownError?.type ?? "unknown");
    console.error("error payload:", unknownError?.error ?? "unknown");
    process.exit(1);
  }
}

void main();
