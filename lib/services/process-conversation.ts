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

interface RetrievalSource {
  title: string;
  scope: "personal" | "workspace" | "synthesis";
  method: "vector" | "keyword";
}

interface ProcessResult {
  assistantMessage: MessageRow;
  usage: {
    inputTokens: number;
    outputTokens: number;
    estimatedCostCents: number;
  };
  sources: RetrievalSource[];
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

  // 2. Fetch relevant documents with sources tracking
  const brainMerged = await fetchAndMergeDocuments(
    workspaceId,
    userId,
    "personal",
    userMessage.content
  );

  const canonMerged = await fetchAndMergeDocuments(
    workspaceId,
    null,
    "workspace",
    userMessage.content
  );

  const synthesisMerged = await fetchAndMergeDocuments(
    workspaceId,
    null,
    "synthesis",
    userMessage.content
  );

  // Collect all sources
  const allSources: RetrievalSource[] = [
    ...brainMerged.sources,
    ...canonMerged.sources,
    ...synthesisMerged.sources,
  ];

  // 3. Extract text from any attachments on the current message
  const attachmentTexts = await extractAttachmentTexts(
    userMessage.attachments as Attachment[] | null
  );

  // 4. Compose the system prompt
  const systemPrompt = composeSystemPrompt(
    brainMerged.docs,
    canonMerged.docs,
    synthesisMerged.docs,
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
  if (allSources.length > 0) metadata.sources = allSources;

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
    sources: allSources,
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
      .limit(Math.max(limit * 10, limit));

    const deduped: Array<{ title: string; content: string; similarity?: number }> = [];
    const parentCounts = new Map<string, number>();
    const MAX_CHUNKS_PER_PARENT = 3;
    
    for (const doc of docs) {
      if (!doc.content || doc.similarity <= 0.3) continue;
      const parentId = doc.parentDocumentId ?? doc.id;
      const count = parentCounts.get(parentId) ?? 0;
      if (count >= MAX_CHUNKS_PER_PARENT) continue;
      parentCounts.set(parentId, count + 1);
      deduped.push({ title: doc.title, content: doc.content, similarity: doc.similarity });
      if (deduped.length >= limit) break;
    }

    logger.info("retrieval_complete", {
      scope,
      method: "vector",
      query: queryText.slice(0, 100),
      candidateCount: docs.length,
      resultCount: deduped.length,
      results: deduped.map(d => ({ title: d.title, similarity: d.similarity })),
    });

    return deduped;
  } catch (error) {
    logger.error("Failed to fetch relevant documents", { error: String(error), scope });
    return [];
  }
}

// ── Helper: Fetch documents by keyword/substring search ───────────────────

async function fetchDocumentsByKeyword(
  workspaceId: string,
  userId: string | null,
  scope: "personal" | "workspace" | "synthesis",
  queryText: string,
  limit = 5
): Promise<Array<{ title: string; content: string; matchedToken?: string }>> {
  try {
    // Extract searchable tokens: URLs, emails, quoted phrases, and bare numeric IDs
    const urlMatches = (queryText.match(/https?:\/\/\S+/g) || [])
      .map(u => u.replace(/["')\],;.]+$/, ''));
    const emailMatches = queryText.match(/\S+@\S+\.\S+/g) || [];
    const quotedMatches = queryText.match(/["']([^"']+)["']/g)
      ?.map(m => m.slice(1, -1)) || [];
    const numericIds = queryText.match(/\b\d{10,}\b/g) || [];
    
    const tokens = [...urlMatches, ...emailMatches, ...quotedMatches, ...numericIds]
      .filter(Boolean);
    
    if (!tokens.length) return [];
    
    const conditions = [
      eq(brainDocuments.workspaceId, workspaceId),
      eq(brainDocuments.scope, scope),
    ];

    if (userId) {
      conditions.push(eq(brainDocuments.userId, userId));
    } else {
      conditions.push(isNull(brainDocuments.userId));
    }

    const results: Array<{ id: string; title: string; content: string; matchedToken?: string }> = [];
    const seenIds = new Set<string>();

    // Search for each token
    for (const token of tokens.slice(0, 5)) {
      const matches = await db
        .select({
          id: brainDocuments.id,
          title: brainDocuments.title,
          content: brainDocuments.content,
        })
        .from(brainDocuments)
        .where(
          and(
            and(...conditions),
            sql`${brainDocuments.content} ILIKE ${'%' + token + '%'}`,
            sql`${brainDocuments.embedding} IS NOT NULL`
          )
        )
        .limit(10);

      for (const match of matches) {
        if (!seenIds.has(match.id) && match.content) {
          seenIds.add(match.id);
          results.push({ ...match, matchedToken: token } as { id: string; title: string; content: string; matchedToken?: string });
          if (results.length >= limit) break;
        }
      }

      if (results.length >= limit) break;
    }

    logger.info("retrieval_complete", {
      scope,
      method: "keyword",
      query: queryText.slice(0, 100),
      tokensExtracted: tokens.length,
      resultCount: results.length,
      results: results.map(d => ({ title: d.title, id: d.id })),
    });

    return results.map(({ title, content, matchedToken }) => ({ title, content, matchedToken }));
  } catch (error) {
    logger.error("Failed to fetch documents by keyword", { error: String(error), scope });
    return [];
  }
}

// ── Helper: Merge vector and keyword results ──────────────────────────────

interface MergedResults {
  docs: Array<{ title: string; content: string; matchedToken?: string }>;
  sources: RetrievalSource[];
}

async function fetchAndMergeDocuments(
  workspaceId: string,
  userId: string | null,
  scope: "personal" | "workspace" | "synthesis",
  queryText: string,
  limit = 5
): Promise<MergedResults> {
  // Fetch both in parallel
  const [vectorResults, keywordResults] = await Promise.all([
    fetchRelevantDocuments(workspaceId, userId, scope, queryText, limit),
    fetchDocumentsByKeyword(workspaceId, userId, scope, queryText, limit),
  ]);

  const docs: Array<{ title: string; content: string; matchedToken?: string }> = [];
  const sources: RetrievalSource[] = [];
  const seenTitles = new Set<string>();

  // Add keyword matches first (higher confidence)
  for (const result of keywordResults) {
    if (!seenTitles.has(result.title)) {
      docs.push(result);
      sources.push({ title: result.title, scope, method: "keyword" });
      seenTitles.add(result.title);
      if (docs.length >= limit) break;
    }
  }

  // Then add vector matches
  for (const result of vectorResults) {
    if (!seenTitles.has(result.title)) {
      docs.push(result);
      sources.push({ title: result.title, scope, method: "vector" });
      seenTitles.add(result.title);
      if (docs.length >= limit) break;
    }
  }

  return { docs, sources };
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
  brainDocs: Array<{ title: string; content: string; matchedToken?: string }>,
  canonDocs: Array<{ title: string; content: string; matchedToken?: string }>,
  synthesisDocs: Array<{ title: string; content: string; matchedToken?: string }>,
  attachmentTexts: string[]
): string {
  const MAX_TOTAL_CONTEXT_CHARS = 40_000;
  const totalDocs = brainDocs.length + canonDocs.length + synthesisDocs.length;
  
  // Dynamic per-doc cap: allocate total budget across matched docs
  let perDocCap = MAX_TOTAL_CONTEXT_CHARS;
  if (totalDocs > 0) {
    perDocCap = Math.floor(MAX_TOTAL_CONTEXT_CHARS / totalDocs);
    // Ensure minimum 4KB per doc if possible
    perDocCap = Math.max(perDocCap, 4_000);
  }
  
  let totalContextChars = 0;
  const truncateContextDoc = (content: string, matchedToken?: string) => {
    const remaining = MAX_TOTAL_CONTEXT_CHARS - totalContextChars;
    const cap = Math.min(perDocCap, remaining);
    if (cap <= 0) return "[Omitted: context budget exhausted]";
    if (content.length <= cap) {
      totalContextChars += content.length;
      return content;
    }

    // If we have a matched token, center the window on it
    let start = 0;
    if (matchedToken) {
      const idx = content.indexOf(matchedToken);
      if (idx >= 0) {
        start = Math.max(0, idx - Math.floor(cap / 2));
      }
    }
    const snippet = content.slice(start, start + cap);
    totalContextChars += snippet.length;
    const prefix = start > 0 ? `[...${(start/1024).toFixed(1)}KB skipped...]\n` : "";
    const suffix = (start + cap) < content.length
      ? `\n[...truncated, showing ${(cap/1024).toFixed(1)}KB around match]`
      : "";
    return prefix + snippet + suffix;
  };

  const parts: string[] = [
    "You are Tensient, an AI assistant for enterprise leaders. You help users think clearly, make decisions, and take action.",
    "Respond conversationally but substantively. Be direct, insightful, and actionable.",
    "When relevant, extract action items, ask reflective coaching questions, and note alignment with the user's stated goals.",
    "You can reference the user's personal context library (My Context) and shared workspace knowledge (Workspace Context).",
    "When citing information from context documents, mention the source document title.",
    "If no relevant context was retrieved for this message, say so explicitly. Suggest the user try including specific identifiers like URLs, email addresses, or exact names in their question to improve matching.",
  ];

  if (brainDocs.length > 0) {
    parts.push("\n## My Context (user's private context)");
    for (const doc of brainDocs) {
      parts.push(`### ${doc.title}\n${truncateContextDoc(doc.content, doc.matchedToken)}`);
    }
  } else {
    parts.push("\n## My Context (user's private context)\nNo relevant documents matched this message.");
  }

  if (canonDocs.length > 0) {
    parts.push("\n## Workspace Context (shared workspace knowledge)");
    for (const doc of canonDocs) {
      parts.push(`### ${doc.title}\n${truncateContextDoc(doc.content, doc.matchedToken)}`);
    }
  } else {
    parts.push("\n## Workspace Context (shared workspace knowledge)\nNo relevant documents matched this message.");
  }

  if (synthesisDocs.length > 0) {
    parts.push("\n## Synthesis (workspace world model)");
    for (const doc of synthesisDocs) {
      parts.push(`### ${doc.title}\n${truncateContextDoc(doc.content, doc.matchedToken)}`);
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
