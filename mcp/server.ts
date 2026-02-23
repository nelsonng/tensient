import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { eq, and, desc, asc, isNull, sql, gte, lte, ilike, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { generateEmbedding, calculateCostCents } from "@/lib/ai";
import { processSynthesis } from "@/lib/services/process-synthesis";
import { checkUsageAllowed, logUsage } from "@/lib/usage-guard";
import {
  signals,
  conversations,
  messages,
  brainDocuments,
  synthesisCommits,
} from "../lib/db/schema";

export function registerTools(
  server: McpServer,
  workspaceId: string,
  userId: string
) {
  const WORKSPACE_ID = workspaceId;
  const USER_ID = userId;

// ── Sensors (Read) ──────────────────────────────────────────────────────

server.tool(
  "list_signals",
  "List all signals in the workspace. Signals are extracted insights from conversations with AI-assigned priorities.",
  {
    conversationId: z
      .string()
      .uuid()
      .optional()
      .describe("Filter by conversation ID"),
    status: z
      .enum(["open", "resolved", "dismissed"])
      .optional()
      .describe("Filter by signal status"),
    priority: z
      .enum(["critical", "high", "medium", "low"])
      .optional()
      .describe("Filter by AI priority"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(200)
      .default(50)
      .describe("Max results (default 50)"),
    since: z
      .string()
      .datetime()
      .optional()
      .describe("Only signals created at or after this ISO timestamp"),
    before: z
      .string()
      .datetime()
      .optional()
      .describe("Only signals created at or before this ISO timestamp"),
    humanPriority: z
      .enum(["critical", "high", "medium", "low"])
      .optional()
      .describe("Filter by human-assigned priority"),
    search: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe("Case-insensitive keyword match on signal content"),
  },
  async ({
    conversationId,
    status,
    priority,
    limit,
    since,
    before,
    humanPriority,
    search,
  }) => {
    const conditions = [eq(signals.workspaceId, WORKSPACE_ID)];
    if (conversationId) conditions.push(eq(signals.conversationId, conversationId));
    if (status) conditions.push(eq(signals.status, status));
    if (priority) conditions.push(eq(signals.aiPriority, priority));
    if (humanPriority) conditions.push(eq(signals.humanPriority, humanPriority));
    if (since) conditions.push(gte(signals.createdAt, new Date(since)));
    if (before) conditions.push(lte(signals.createdAt, new Date(before)));
    if (search) conditions.push(ilike(signals.content, `%${search}%`));

    const rows = await db
      .select({
        id: signals.id,
        content: signals.content,
        status: signals.status,
        aiPriority: signals.aiPriority,
        humanPriority: signals.humanPriority,
        reviewedAt: signals.reviewedAt,
        source: signals.source,
        createdAt: signals.createdAt,
        conversationId: signals.conversationId,
        conversationTitle: conversations.title,
      })
      .from(signals)
      .innerJoin(conversations, eq(conversations.id, signals.conversationId))
      .where(and(...conditions))
      .orderBy(desc(signals.createdAt))
      .limit(limit);

    return {
      content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }],
    };
  }
);

server.tool(
  "list_synthesis_documents",
  "Get current synthesis world-model documents. These are the living knowledge artifacts that synthesis produces from signals.",
  {},
  async () => {
    const docs = await db
      .select({
        id: brainDocuments.id,
        title: brainDocuments.title,
        content: brainDocuments.content,
        createdAt: brainDocuments.createdAt,
        updatedAt: brainDocuments.updatedAt,
      })
      .from(brainDocuments)
      .where(
        and(
          eq(brainDocuments.workspaceId, WORKSPACE_ID),
          eq(brainDocuments.scope, "synthesis"),
          isNull(brainDocuments.userId)
        )
      )
      .orderBy(desc(brainDocuments.updatedAt));

    return {
      content: [{ type: "text" as const, text: JSON.stringify(docs, null, 2) }],
    };
  }
);

server.tool(
  "get_synthesis_history",
  "Get synthesis commit history — the DAG of world-model changes over time.",
  {
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20)
      .describe("Max commits (default 20)"),
  },
  async ({ limit }) => {
    const rows = await db
      .select({
        id: synthesisCommits.id,
        parentId: synthesisCommits.parentId,
        summary: synthesisCommits.summary,
        trigger: synthesisCommits.trigger,
        signalCount: synthesisCommits.signalCount,
        createdAt: synthesisCommits.createdAt,
      })
      .from(synthesisCommits)
      .where(eq(synthesisCommits.workspaceId, WORKSPACE_ID))
      .orderBy(desc(synthesisCommits.createdAt))
      .limit(limit);

    return {
      content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }],
    };
  }
);

server.tool(
  "list_brain_documents",
  "Get personal brain documents — the user's private knowledge base.",
  {
    search: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe("Case-insensitive keyword match on title + content"),
    since: z
      .string()
      .datetime()
      .optional()
      .describe("Only documents created at or after this ISO timestamp"),
    before: z
      .string()
      .datetime()
      .optional()
      .describe("Only documents created at or before this ISO timestamp"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(200)
      .default(50)
      .describe("Max results (default 50)"),
  },
  async ({ search, since, before, limit }) => {
    const conditions = [
      eq(brainDocuments.workspaceId, WORKSPACE_ID),
      eq(brainDocuments.userId, USER_ID),
      eq(brainDocuments.scope, "personal"),
    ];
    if (since) conditions.push(gte(brainDocuments.createdAt, new Date(since)));
    if (before) conditions.push(lte(brainDocuments.createdAt, new Date(before)));
    if (search) {
      conditions.push(
        or(
          ilike(brainDocuments.title, `%${search}%`),
          ilike(brainDocuments.content, `%${search}%`)
        )!
      );
    }

    const docs = await db
      .select({
        id: brainDocuments.id,
        title: brainDocuments.title,
        content: brainDocuments.content,
        fileName: brainDocuments.fileName,
        createdAt: brainDocuments.createdAt,
        updatedAt: brainDocuments.updatedAt,
      })
      .from(brainDocuments)
      .where(and(...conditions))
      .orderBy(desc(brainDocuments.updatedAt))
      .limit(limit);

    return {
      content: [{ type: "text" as const, text: JSON.stringify(docs, null, 2) }],
    };
  }
);

server.tool(
  "list_canon_documents",
  "Get shared workspace canon documents — the team's shared knowledge base.",
  {
    search: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe("Case-insensitive keyword match on title + content"),
    since: z
      .string()
      .datetime()
      .optional()
      .describe("Only documents created at or after this ISO timestamp"),
    before: z
      .string()
      .datetime()
      .optional()
      .describe("Only documents created at or before this ISO timestamp"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(200)
      .default(50)
      .describe("Max results (default 50)"),
  },
  async ({ search, since, before, limit }) => {
    const conditions = [
      eq(brainDocuments.workspaceId, WORKSPACE_ID),
      eq(brainDocuments.scope, "workspace"),
      isNull(brainDocuments.userId),
    ];
    if (since) conditions.push(gte(brainDocuments.createdAt, new Date(since)));
    if (before) conditions.push(lte(brainDocuments.createdAt, new Date(before)));
    if (search) {
      conditions.push(
        or(
          ilike(brainDocuments.title, `%${search}%`),
          ilike(brainDocuments.content, `%${search}%`)
        )!
      );
    }

    const docs = await db
      .select({
        id: brainDocuments.id,
        title: brainDocuments.title,
        content: brainDocuments.content,
        fileName: brainDocuments.fileName,
        createdAt: brainDocuments.createdAt,
        updatedAt: brainDocuments.updatedAt,
      })
      .from(brainDocuments)
      .where(and(...conditions))
      .orderBy(desc(brainDocuments.updatedAt))
      .limit(limit);

    return {
      content: [{ type: "text" as const, text: JSON.stringify(docs, null, 2) }],
    };
  }
);

server.tool(
  "list_conversations",
  "Get recent conversations with their titles.",
  {
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20)
      .describe("Max results (default 20)"),
  },
  async ({ limit }) => {
    const rows = await db
      .select({
        id: conversations.id,
        title: conversations.title,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
      })
      .from(conversations)
      .where(eq(conversations.workspaceId, WORKSPACE_ID))
      .orderBy(desc(conversations.updatedAt))
      .limit(limit);

    return {
      content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }],
    };
  }
);

server.tool(
  "get_conversation_messages",
  "Get all messages in a specific conversation, including AI metadata (sentiment, actions, coaching questions).",
  {
    conversationId: z.string().uuid().describe("Conversation ID"),
  },
  async ({ conversationId }) => {
    const [conversation] = await db
      .select({
        id: conversations.id,
        title: conversations.title,
        createdAt: conversations.createdAt,
      })
      .from(conversations)
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.workspaceId, WORKSPACE_ID)
        )
      )
      .limit(1);

    if (!conversation) {
      return {
        content: [{ type: "text" as const, text: "Conversation not found" }],
        isError: true,
      };
    }

    const msgs = await db
      .select({
        id: messages.id,
        role: messages.role,
        content: messages.content,
        metadata: messages.metadata,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt));

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ conversation, messages: msgs }, null, 2),
        },
      ],
    };
  }
);

// ── Actuators (Write) ───────────────────────────────────────────────────

server.tool(
  "create_signal",
  "Create a new signal (e.g., an insight from codebase analysis). Must link to an existing conversation and message.",
  {
    content: z.string().min(1).describe("Signal content text"),
    conversationId: z
      .string()
      .uuid()
      .describe("Conversation this signal relates to"),
    messageId: z
      .string()
      .uuid()
      .describe("Message this signal was extracted from"),
    aiPriority: z
      .enum(["critical", "high", "medium", "low"])
      .optional()
      .describe("Priority level"),
  },
  async ({ content, conversationId, messageId, aiPriority }) => {
    const [conversation] = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.workspaceId, WORKSPACE_ID)
        )
      )
      .limit(1);

    if (!conversation) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Conversation not found in this workspace",
          },
        ],
        isError: true,
      };
    }

    const [message] = await db
      .select({ id: messages.id })
      .from(messages)
      .where(
        and(
          eq(messages.id, messageId),
          eq(messages.conversationId, conversationId)
        )
      )
      .limit(1);

    if (!message) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Message not found in the specified conversation",
          },
        ],
        isError: true,
      };
    }

    const embedding = await generateEmbedding(content.slice(0, 2000));

    const [row] = await db
      .insert(signals)
      .values({
        workspaceId: WORKSPACE_ID,
        userId: USER_ID,
        conversationId,
        messageId,
        content: content.trim(),
        embedding,
        aiPriority: aiPriority ?? null,
        humanPriority: null,
        reviewedAt: null,
        source: "mcp",
      })
      .returning();

    return {
      content: [{ type: "text" as const, text: JSON.stringify(row, null, 2) }],
    };
  }
);

server.tool(
  "update_signal",
  "Update a signal's human priority, status, or review state.",
  {
    signalId: z.string().uuid().describe("Signal ID to update"),
    humanPriority: z
      .enum(["critical", "high", "medium", "low"])
      .nullable()
      .optional()
      .describe("Human-assigned priority (null to clear)"),
    status: z
      .enum(["open", "resolved", "dismissed"])
      .optional()
      .describe("Signal status"),
  },
  async ({ signalId, humanPriority, status }) => {
    if (humanPriority === undefined && status === undefined) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Provide at least one field to update: humanPriority or status",
          },
        ],
        isError: true,
      };
    }

    const updates: {
      humanPriority?: "critical" | "high" | "medium" | "low" | null;
      reviewedAt?: Date | null;
      status?: "open" | "resolved" | "dismissed";
    } = {};
    if (humanPriority !== undefined) {
      updates.humanPriority = humanPriority ?? null;
      updates.reviewedAt = humanPriority ? new Date() : null;
    }
    if (status !== undefined) {
      updates.status = status;
    }

    const [row] = await db
      .update(signals)
      .set(updates)
      .where(
        and(eq(signals.id, signalId), eq(signals.workspaceId, WORKSPACE_ID))
      )
      .returning();

    if (!row) {
      return {
        content: [{ type: "text" as const, text: "Signal not found" }],
        isError: true,
      };
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify(row, null, 2) }],
    };
  }
);

server.tool(
  "create_brain_document",
  "Add a personal knowledge document to the brain (e.g., derived from code exploration).",
  {
    title: z.string().min(1).describe("Document title"),
    content: z.string().describe("Document content (markdown)"),
  },
  async ({ title, content }) => {
    const embedding = content
      ? await generateEmbedding(content.slice(0, 8000))
      : null;

    const [doc] = await db
      .insert(brainDocuments)
      .values({
        workspaceId: WORKSPACE_ID,
        userId: USER_ID,
        scope: "personal",
        title,
        content: content || null,
        fileUrl: null,
        fileType: null,
        fileName: null,
        embedding,
      })
      .returning();

    return {
      content: [{ type: "text" as const, text: JSON.stringify(doc, null, 2) }],
    };
  }
);

server.tool(
  "create_canon_document",
  "Add a shared workspace knowledge document to the canon.",
  {
    title: z.string().min(1).describe("Document title"),
    content: z.string().describe("Document content (markdown)"),
  },
  async ({ title, content }) => {
    const embedding = content
      ? await generateEmbedding(content.slice(0, 8000))
      : null;

    const [doc] = await db
      .insert(brainDocuments)
      .values({
        workspaceId: WORKSPACE_ID,
        userId: null,
        scope: "workspace",
        title,
        content: content || null,
        fileUrl: null,
        fileType: null,
        fileName: null,
        embedding,
      })
      .returning();

    return {
      content: [{ type: "text" as const, text: JSON.stringify(doc, null, 2) }],
    };
  }
);

server.tool(
  "update_brain_document",
  "Update an existing brain, canon, or synthesis document's title and/or content. Regenerates embedding on content change.",
  {
    documentId: z.string().uuid().describe("Document ID to update"),
    title: z.string().optional().describe("New title"),
    content: z.string().optional().describe("New content (markdown)"),
  },
  async ({ documentId, title, content }) => {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (title !== undefined) updates.title = title;
    if (content !== undefined) {
      updates.content = content;
      updates.embedding = content
        ? await generateEmbedding(content.slice(0, 8000))
        : null;
    }

    const [updated] = await db
      .update(brainDocuments)
      .set(updates)
      .where(
        and(
          eq(brainDocuments.id, documentId),
          eq(brainDocuments.workspaceId, WORKSPACE_ID)
        )
      )
      .returning();

    if (!updated) {
      return {
        content: [{ type: "text" as const, text: "Document not found" }],
        isError: true,
      };
    }

    return {
      content: [
        { type: "text" as const, text: JSON.stringify(updated, null, 2) },
      ],
    };
  }
);

// ── Semantic Search ──────────────────────────────────────────────────────

server.tool(
  "search_similar",
  "Semantic search across signals and documents using vector similarity. Returns the most relevant items to a natural language query.",
  {
    query: z.string().min(1).describe("Natural language search query"),
    scope: z
      .enum(["signals", "brain", "canon", "synthesis", "all"])
      .default("all")
      .describe("What to search: signals, brain docs, canon docs, synthesis docs, or all"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(10)
      .describe("Max results (default 10)"),
  },
  async ({ query, scope, limit }) => {
    const queryEmbedding = await generateEmbedding(query);
    const embeddingStr = `[${queryEmbedding.join(",")}]`;
    const results: Array<{ type: string; id: string; title?: string; content: string; similarity: number }> = [];

    if (scope === "signals" || scope === "all") {
      const rows = await db.execute(sql`
        SELECT id, content, 1 - (embedding <=> ${embeddingStr}::vector) as similarity
        FROM signals
        WHERE workspace_id = ${WORKSPACE_ID} AND embedding IS NOT NULL
        ORDER BY embedding <=> ${embeddingStr}::vector
        LIMIT ${limit}
      `);
      for (const row of rows.rows) {
        results.push({
          type: "signal",
          id: String(row.id),
          content: String(row.content),
          similarity: Number(row.similarity),
        });
      }
    }

    if (scope === "brain" || scope === "all") {
      const rows = await db.execute(sql`
        SELECT id, title, content, 1 - (embedding <=> ${embeddingStr}::vector) as similarity
        FROM brain_documents
        WHERE workspace_id = ${WORKSPACE_ID} AND user_id = ${USER_ID}
          AND scope = 'personal' AND embedding IS NOT NULL
        ORDER BY embedding <=> ${embeddingStr}::vector
        LIMIT ${limit}
      `);
      for (const row of rows.rows) {
        results.push({
          type: "brain",
          id: String(row.id),
          title: String(row.title),
          content: String(row.content),
          similarity: Number(row.similarity),
        });
      }
    }

    if (scope === "canon" || scope === "all") {
      const rows = await db.execute(sql`
        SELECT id, title, content, 1 - (embedding <=> ${embeddingStr}::vector) as similarity
        FROM brain_documents
        WHERE workspace_id = ${WORKSPACE_ID} AND user_id IS NULL
          AND scope = 'workspace' AND embedding IS NOT NULL
        ORDER BY embedding <=> ${embeddingStr}::vector
        LIMIT ${limit}
      `);
      for (const row of rows.rows) {
        results.push({
          type: "canon",
          id: String(row.id),
          title: String(row.title),
          content: String(row.content),
          similarity: Number(row.similarity),
        });
      }
    }

    if (scope === "synthesis" || scope === "all") {
      const rows = await db.execute(sql`
        SELECT id, title, content, 1 - (embedding <=> ${embeddingStr}::vector) as similarity
        FROM brain_documents
        WHERE workspace_id = ${WORKSPACE_ID} AND user_id IS NULL
          AND scope = 'synthesis' AND embedding IS NOT NULL
        ORDER BY embedding <=> ${embeddingStr}::vector
        LIMIT ${limit}
      `);
      for (const row of rows.rows) {
        results.push({
          type: "synthesis",
          id: String(row.id),
          title: String(row.title),
          content: String(row.content),
          similarity: Number(row.similarity),
        });
      }
    }

    // Sort all results by similarity descending and take top N
    results.sort((a, b) => b.similarity - a.similarity);
    const topResults = results.slice(0, limit);

    return {
      content: [{ type: "text" as const, text: JSON.stringify(topResults, null, 2) }],
    };
  }
);

// ── Run Synthesis ────────────────────────────────────────────────────────

server.tool(
  "run_synthesis",
  "Trigger synthesis: processes unprocessed signals against current synthesis documents to update the workspace world-model. Requires ANTHROPIC_API_KEY. Returns the commit summary and operations performed.",
  {},
  async () => {
    if (!process.env.ANTHROPIC_API_KEY) {
      return {
        content: [{ type: "text" as const, text: "Missing ANTHROPIC_API_KEY env var. Synthesis requires Claude API access." }],
        isError: true,
      };
    }

    const usageCheck = await checkUsageAllowed(USER_ID);
    if (!usageCheck.allowed) {
      return {
        content: [
          {
            type: "text" as const,
            text: usageCheck.reason ?? "Usage limit reached",
          },
        ],
        isError: true,
      };
    }

    const synthesisResult = await processSynthesis({
      workspaceId: WORKSPACE_ID,
      userId: USER_ID,
      trigger: "manual",
    });

    if (synthesisResult.usage) {
      await logUsage({
        userId: USER_ID,
        workspaceId: WORKSPACE_ID,
        operation: "mcp_synthesis",
        inputTokens: synthesisResult.usage.inputTokens,
        outputTokens: synthesisResult.usage.outputTokens,
        estimatedCostCents: calculateCostCents(
          synthesisResult.usage.inputTokens,
          synthesisResult.usage.outputTokens
        ),
      });
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              commitId: synthesisResult.commitId,
              summary: synthesisResult.summary,
              processedSignals: synthesisResult.processedSignalCount,
              operations: synthesisResult.operations.map((op) => ({
                action: op.action,
                title: op.title,
                reasoning: op.reasoning,
              })),
              priorityRecommendations:
                synthesisResult.priorityRecommendations,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ── Delete Tools ─────────────────────────────────────────────────────────

server.tool(
  "delete_signal",
  "Delete a signal by ID. This is permanent.",
  {
    signalId: z.string().uuid().describe("Signal ID to delete"),
  },
  async ({ signalId }) => {
    const [deleted] = await db
      .delete(signals)
      .where(and(eq(signals.id, signalId), eq(signals.workspaceId, WORKSPACE_ID)))
      .returning({ id: signals.id, content: signals.content });

    if (!deleted) {
      return { content: [{ type: "text" as const, text: "Signal not found" }], isError: true };
    }

    return { content: [{ type: "text" as const, text: JSON.stringify({ deleted: deleted.id, content: deleted.content }) }] };
  }
);

server.tool(
  "delete_document",
  "Delete a brain, canon, or synthesis document by ID. This is permanent.",
  {
    documentId: z.string().uuid().describe("Document ID to delete"),
  },
  async ({ documentId }) => {
    const [deleted] = await db
      .delete(brainDocuments)
      .where(and(eq(brainDocuments.id, documentId), eq(brainDocuments.workspaceId, WORKSPACE_ID)))
      .returning({ id: brainDocuments.id, title: brainDocuments.title, scope: brainDocuments.scope });

    if (!deleted) {
      return { content: [{ type: "text" as const, text: "Document not found" }], isError: true };
    }

    return { content: [{ type: "text" as const, text: JSON.stringify({ deleted: deleted.id, title: deleted.title, scope: deleted.scope }) }] };
  }
);
}

