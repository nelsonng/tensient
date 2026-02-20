import { db } from "@/lib/db";
import { messages, brainDocuments, protocols, conversations } from "@/lib/db/schema";
import { eq, and, asc, desc, isNull, sql } from "drizzle-orm";
import {
  generateStructuredJSON,
  generateEmbedding,
  calculateCostCents,
} from "@/lib/ai";
import { extractTextFromFile } from "@/lib/extract-text";
import { logger } from "@/lib/logger";

// ── Types ──────────────────────────────────────────────────────────────

interface MessageRow {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  audioUrl: string | null;
  attachments: unknown;
  metadata: unknown;
  coachIds: unknown;
  createdAt: Date;
}

interface ProcessResult {
  assistantMessage: MessageRow;
  usage: {
    inputTokens: number;
    outputTokens: number;
    estimatedCostCents: number;
  };
}

interface ProcessInput {
  conversationId: string;
  workspaceId: string;
  userId: string;
  userMessage: MessageRow;
  coachIds: string[];
}

interface Attachment {
  url: string;
  filename: string;
  contentType: string;
  sizeBytes?: number;
}

interface AIResponse {
  reply: string;
  sentiment?: number;
  actions?: Array<{ task: string; priority?: string }>;
  coachingQuestions?: string[];
  alignmentNote?: string;
}

// ── Schema for structured AI response ──────────────────────────────────

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
          priority: { type: "string" as const, enum: ["critical", "high", "medium", "low"] },
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
      description: "Brief note on how the user's thinking aligns with or diverges from their stated goals",
    },
  },
  required: ["reply"] as const,
  additionalProperties: false,
};

// ── Main Processing Function ───────────────────────────────────────────

export async function processConversationMessage(
  input: ProcessInput
): Promise<ProcessResult> {
  const { conversationId, workspaceId, userId, userMessage, coachIds } = input;

  // 1. Fetch conversation history (excluding the just-inserted user message)
  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt));

  // 2. Fetch relevant Brain documents (personal, by embedding similarity)
  const brainContext = await fetchRelevantDocuments(
    workspaceId,
    userId,
    "personal",
    userMessage.content
  );

  // 3. Fetch relevant Canon documents (workspace-shared, by embedding similarity)
  const canonContext = await fetchRelevantDocuments(
    workspaceId,
    null,
    "workspace",
    userMessage.content
  );

  // 4. Fetch selected coaches' system prompts
  const coachPrompts = await fetchCoachPrompts(coachIds);

  // 5. Extract text from any attachments on the current message
  const attachmentTexts = await extractAttachmentTexts(
    userMessage.attachments as Attachment[] | null
  );

  // 6. Compose the system prompt
  const systemPrompt = composeSystemPrompt(
    brainContext,
    canonContext,
    coachPrompts,
    attachmentTexts
  );

  // 7. Compose message history for context
  const conversationMessages = history.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // 8. Call Claude via structured JSON
  const prompt = conversationMessages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");

  const { result, inputTokens, outputTokens } =
    await generateStructuredJSON<AIResponse>({
      system: systemPrompt,
      prompt,
      schema: AI_RESPONSE_SCHEMA,
      maxTokens: 4096,
    });

  // 9. Insert assistant message
  const metadata: Record<string, unknown> = {};
  if (result.sentiment !== undefined) metadata.sentiment = result.sentiment;
  if (result.actions?.length) metadata.actions = result.actions;
  if (result.coachingQuestions?.length) metadata.coachingQuestions = result.coachingQuestions;
  if (result.alignmentNote) metadata.alignmentNote = result.alignmentNote;

  const [assistantMessage] = await db
    .insert(messages)
    .values({
      conversationId,
      role: "assistant",
      content: result.reply,
      metadata: Object.keys(metadata).length > 0 ? metadata : null,
      coachIds: coachIds.length > 0 ? coachIds : null,
    })
    .returning();

  // 10. Fire-and-forget: generate conversation title after first AI response
  const messageCount = history.length;
  if (messageCount <= 2) {
    generateConversationTitle(conversationId, userMessage.content, result.reply).catch(
      (err) => logger.error("Title generation failed", { error: String(err) })
    );
  }

  return {
    assistantMessage: assistantMessage as MessageRow,
    usage: {
      inputTokens,
      outputTokens,
      estimatedCostCents: calculateCostCents(inputTokens, outputTokens),
    },
  };
}

// ── Helper: Fetch relevant documents by embedding similarity ───────────

async function fetchRelevantDocuments(
  workspaceId: string,
  userId: string | null,
  scope: "personal" | "workspace",
  queryText: string,
  limit = 5
): Promise<Array<{ title: string; content: string }>> {
  try {
    const queryEmbedding = await generateEmbedding(queryText.slice(0, 2000));
    const embeddingStr = `[${queryEmbedding.join(",")}]`;

    const conditions = [
      eq(brainDocuments.workspaceId, workspaceId),
      eq(brainDocuments.scope, scope),
    ];

    if (userId) {
      conditions.push(eq(brainDocuments.userId, userId));
    } else {
      conditions.push(isNull(brainDocuments.userId));
    }

    const docs = await db
      .select({
        title: brainDocuments.title,
        content: brainDocuments.content,
        similarity: sql<number>`1 - (${brainDocuments.embedding} <=> ${embeddingStr}::vector)`,
      })
      .from(brainDocuments)
      .where(and(...conditions))
      .orderBy(desc(sql`1 - (${brainDocuments.embedding} <=> ${embeddingStr}::vector)`))
      .limit(limit);

    return docs
      .filter((d) => d.content && d.similarity > 0.3)
      .map((d) => ({ title: d.title, content: d.content! }));
  } catch (error) {
    logger.error("Failed to fetch relevant documents", { error: String(error), scope });
    return [];
  }
}

// ── Helper: Fetch coach system prompts ─────────────────────────────────

async function fetchCoachPrompts(
  coachIds: string[]
): Promise<Array<{ name: string; prompt: string }>> {
  if (!coachIds.length) return [];

  try {
    const coaches = await db
      .select({ name: protocols.name, systemPrompt: protocols.systemPrompt })
      .from(protocols)
      .where(sql`${protocols.id} = ANY(${coachIds})`);

    return coaches.map((c) => ({ name: c.name, prompt: c.systemPrompt }));
  } catch (error) {
    logger.error("Failed to fetch coach prompts", { error: String(error) });
    return [];
  }
}

// ── Helper: Extract text from attachments ──────────────────────────────

async function extractAttachmentTexts(
  attachments: Attachment[] | null
): Promise<string[]> {
  if (!attachments?.length) return [];

  const texts: string[] = [];
  for (const att of attachments) {
    try {
      const text = await extractTextFromFile(att.url, att.contentType);
      if (text) {
        texts.push(`[File: ${att.filename}]\n${text}`);
      }
    } catch (error) {
      logger.error("Attachment text extraction failed", {
        filename: att.filename,
        error: String(error),
      });
    }
  }
  return texts;
}

// ── Helper: Compose system prompt ──────────────────────────────────────

function composeSystemPrompt(
  brainDocs: Array<{ title: string; content: string }>,
  canonDocs: Array<{ title: string; content: string }>,
  coaches: Array<{ name: string; prompt: string }>,
  attachmentTexts: string[]
): string {
  const parts: string[] = [
    "You are Tensient, an AI assistant for enterprise leaders. You help users think clearly, make decisions, and take action.",
    "Respond conversationally but substantively. Be direct, insightful, and actionable.",
    "When relevant, extract action items, ask reflective coaching questions, and note alignment with the user's stated goals.",
  ];

  if (brainDocs.length > 0) {
    parts.push("\n## Personal Brain (user's private context)");
    for (const doc of brainDocs) {
      parts.push(`### ${doc.title}\n${doc.content.slice(0, 2000)}`);
    }
  }

  if (canonDocs.length > 0) {
    parts.push("\n## Canon (shared workspace knowledge)");
    for (const doc of canonDocs) {
      parts.push(`### ${doc.title}\n${doc.content.slice(0, 2000)}`);
    }
  }

  if (coaches.length > 0) {
    parts.push("\n## Active Coaching Lenses");
    parts.push(
      "Apply the following coaching perspectives when analyzing the user's input:"
    );
    for (const coach of coaches) {
      parts.push(`### ${coach.name}\n${coach.prompt}`);
    }
  }

  if (attachmentTexts.length > 0) {
    parts.push("\n## Attached Files");
    parts.push(attachmentTexts.join("\n\n"));
  }

  return parts.join("\n\n");
}

// ── Helper: Generate conversation title ────────────────────────────────

async function generateConversationTitle(
  conversationId: string,
  userContent: string,
  assistantReply: string
): Promise<void> {
  try {
    const { result } = await generateStructuredJSON<{ title: string }>({
      system: "Generate a short, descriptive title (3-7 words) for this conversation. No quotes or punctuation at the end.",
      prompt: `User said: "${userContent.slice(0, 500)}"\n\nAssistant replied: "${assistantReply.slice(0, 500)}"`,
      schema: {
        type: "object",
        properties: {
          title: { type: "string", description: "A short conversation title, 3-7 words" },
        },
        required: ["title"],
      },
      maxTokens: 100,
    });

    if (result.title) {
      await db
        .update(conversations)
        .set({ title: result.title, updatedAt: new Date() })
        .where(eq(conversations.id, conversationId));
    }
  } catch (error) {
    logger.error("Conversation title generation failed", {
      conversationId,
      error: String(error),
    });
  }
}
