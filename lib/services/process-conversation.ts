import { db } from "@/lib/db";
import { messages, brainDocuments, conversations, signals } from "@/lib/db/schema";
import { eq, and, asc, desc, isNull, sql } from "drizzle-orm";
import {
  generateStructuredJSON,
  generateEmbedding,
  calculateCostCents,
} from "@/lib/ai";
import { extractTextFromFile } from "@/lib/extract-text";
import { logger } from "@/lib/logger";
import { trackEvent } from "@/lib/platform-events";

// ── Types ──────────────────────────────────────────────────────────────

interface MessageRow {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  audioUrl: string | null;
  attachments: unknown;
  metadata: unknown;
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
  actions?: Array<{
    task: string;
    priority?: "critical" | "high" | "medium" | "low";
  }>;
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
  const { conversationId, workspaceId, userId, userMessage } = input;

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

  // 4. Extract text from any attachments on the current message
  const synthesisContext = await fetchRelevantDocuments(
    workspaceId,
    null,
    "synthesis",
    userMessage.content
  );

  // 4. Extract text from any attachments on the current message
  const attachmentTexts = await extractAttachmentTexts(
    userMessage.attachments as Attachment[] | null
  );

  // 5. Compose the system prompt
  const systemPrompt = composeSystemPrompt(
    brainContext,
    canonContext,
    synthesisContext,
    attachmentTexts
  );

  // 6. Compose message history for context
  const conversationMessages = history.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // 7. Call Claude via structured JSON
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

  // 8. Insert assistant message
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
    })
    .returning();

  if (result.actions?.length) {
    void persistSignals({
      workspaceId,
      userId,
      conversationId,
      messageId: assistantMessage.id,
      actions: result.actions,
    });
  }

  // 9. Fire-and-forget: generate conversation title after first AI response
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

async function persistSignals(input: {
  workspaceId: string;
  userId: string;
  conversationId: string;
  messageId: string;
  actions: Array<{ task: string; priority?: "critical" | "high" | "medium" | "low" }>;
}) {
  const { workspaceId, userId, conversationId, messageId, actions } = input;

  try {
    for (const action of actions) {
      const task = action.task?.trim();
      if (!task) continue;

      const [signal] = await db
        .insert(signals)
        .values({
          workspaceId,
          userId,
          conversationId,
          messageId,
          content: task,
          aiPriority: action.priority ?? null,
        })
        .returning({ id: signals.id, content: signals.content });

      if (signal?.id) {
        try {
          const embedding = await generateEmbedding(task.slice(0, 2000));
          await db
            .update(signals)
            .set({ embedding })
            .where(eq(signals.id, signal.id));
        } catch (embeddingError) {
          logger.error("Signal embedding generation failed", {
            signalId: signal.id,
            error: String(embeddingError),
          });
        }
      }
    }

    trackEvent("signal_extracted", {
      userId,
      workspaceId,
      metadata: { conversationId, count: actions.length },
    });
  } catch (error) {
    logger.error("Signal extraction persistence failed", {
      workspaceId,
      conversationId,
      error: String(error),
    });
  }
}

// ── Helper: Fetch relevant documents by embedding similarity ───────────

async function fetchRelevantDocuments(
  workspaceId: string,
  userId: string | null,
  scope: "personal" | "workspace" | "synthesis",
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
        id: brainDocuments.id,
        parentDocumentId: brainDocuments.parentDocumentId,
        title: brainDocuments.title,
        content: brainDocuments.content,
        similarity: sql<number>`1 - (${brainDocuments.embedding} <=> ${embeddingStr}::vector)`,
      })
      .from(brainDocuments)
      .where(and(...conditions))
      .orderBy(desc(sql`1 - (${brainDocuments.embedding} <=> ${embeddingStr}::vector)`))
      .limit(Math.max(limit * 5, limit));

    const deduped: Array<{ title: string; content: string }> = [];
    const seenParentIds = new Set<string>();
    for (const doc of docs) {
      if (!doc.content || doc.similarity <= 0.3) continue;
      const parentId = doc.parentDocumentId ?? doc.id;
      if (seenParentIds.has(parentId)) continue;
      seenParentIds.add(parentId);
      deduped.push({ title: doc.title, content: doc.content });
      if (deduped.length >= limit) break;
    }

    return deduped;
  } catch (error) {
    logger.error("Failed to fetch relevant documents", { error: String(error), scope });
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
  synthesisDocs: Array<{ title: string; content: string }>,
  attachmentTexts: string[]
): string {
  const MAX_CONTEXT_DOC_CHARS = 4_000;
  const MAX_TOTAL_CONTEXT_CHARS = 40_000;
  let totalContextChars = 0;
  const truncateContextDoc = (content: string) => {
    const remaining = MAX_TOTAL_CONTEXT_CHARS - totalContextChars;
    const cap = Math.min(MAX_CONTEXT_DOC_CHARS, remaining);
    if (cap <= 0) return "[Omitted: context budget exhausted]";
    const truncated = content.length <= cap ? content : content.slice(0, cap) +
      `\n\n[Truncated: showing ${(cap / 1024).toFixed(1)}KB of ${(content.length / 1024).toFixed(1)}KB]`;
    totalContextChars += truncated.length;
    return truncated;
  };

  const parts: string[] = [
    "You are Tensient, an AI assistant for enterprise leaders. You help users think clearly, make decisions, and take action.",
    "Respond conversationally but substantively. Be direct, insightful, and actionable.",
    "When relevant, extract action items, ask reflective coaching questions, and note alignment with the user's stated goals.",
    "You can reference the user's personal context library (My Context) and shared workspace knowledge (Workspace Context).",
    "If no relevant context was retrieved for this message, do not claim these systems do not exist. Instead, acknowledge that no relevant documents were matched and suggest checking whether uploaded files have extractable text content.",
  ];

  if (brainDocs.length > 0) {
    parts.push("\n## My Context (user's private context)");
    for (const doc of brainDocs) {
      parts.push(`### ${doc.title}\n${truncateContextDoc(doc.content)}`);
    }
  } else {
    parts.push("\n## My Context (user's private context)\nNo relevant documents matched this message.");
  }

  if (canonDocs.length > 0) {
    parts.push("\n## Workspace Context (shared workspace knowledge)");
    for (const doc of canonDocs) {
      parts.push(`### ${doc.title}\n${truncateContextDoc(doc.content)}`);
    }
  } else {
    parts.push("\n## Workspace Context (shared workspace knowledge)\nNo relevant documents matched this message.");
  }

  if (synthesisDocs.length > 0) {
    parts.push("\n## Synthesis (workspace world model)");
    for (const doc of synthesisDocs) {
      parts.push(`### ${doc.title}\n${truncateContextDoc(doc.content)}`);
    }
  }

  if (attachmentTexts.length > 0) {
    const MAX_ATTACHMENT_CHARS = 100_000;
    parts.push("\n## Attached Files");
    let totalChars = 0;
    for (const text of attachmentTexts) {
      const remaining = MAX_ATTACHMENT_CHARS - totalChars;
      if (remaining <= 0) {
        parts.push("[Additional attachments omitted due to size limits]");
        break;
      }
      if (text.length <= remaining) {
        parts.push(text);
        totalChars += text.length;
      } else {
        parts.push(
          text.slice(0, remaining) +
            `\n\n[Attachment truncated: showing first ${(remaining / 1024).toFixed(0)}KB of ${(text.length / 1024).toFixed(0)}KB]`
        );
        totalChars += remaining;
      }
    }
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
        additionalProperties: false,
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
