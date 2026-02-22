import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { eq, and, desc, asc, isNull, sql, inArray } from "drizzle-orm";
import { db } from "./db";
import { generateEmbedding } from "./embeddings";
import { generateStructuredJSON } from "./ai";
import {
  signals,
  conversations,
  messages,
  brainDocuments,
  synthesisCommits,
  synthesisDocumentVersions,
  synthesisCommitSignals,
} from "../lib/db/schema";

// ── Config ──────────────────────────────────────────────────────────────

const WORKSPACE_ID = process.env.TENSIENT_WORKSPACE_ID!;
const USER_ID = process.env.TENSIENT_USER_ID!;

if (!WORKSPACE_ID || !USER_ID) {
  console.error(
    "Missing required env vars: TENSIENT_WORKSPACE_ID, TENSIENT_USER_ID"
  );
  process.exit(1);
}

// ── Server ──────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "tensient",
  version: "0.1.0",
});

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
  },
  async ({ conversationId, priority, limit }) => {
    const conditions = [eq(signals.workspaceId, WORKSPACE_ID)];
    if (conversationId) conditions.push(eq(signals.conversationId, conversationId));
    if (priority) conditions.push(eq(signals.aiPriority, priority));

    const rows = await db
      .select({
        id: signals.id,
        content: signals.content,
        aiPriority: signals.aiPriority,
        humanPriority: signals.humanPriority,
        reviewedAt: signals.reviewedAt,
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
  {},
  async () => {
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
      .where(
        and(
          eq(brainDocuments.workspaceId, WORKSPACE_ID),
          eq(brainDocuments.userId, USER_ID),
          eq(brainDocuments.scope, "personal")
        )
      )
      .orderBy(desc(brainDocuments.updatedAt));

    return {
      content: [{ type: "text" as const, text: JSON.stringify(docs, null, 2) }],
    };
  }
);

server.tool(
  "list_canon_documents",
  "Get shared workspace canon documents — the team's shared knowledge base.",
  {},
  async () => {
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
      .where(
        and(
          eq(brainDocuments.workspaceId, WORKSPACE_ID),
          eq(brainDocuments.scope, "workspace"),
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
      })
      .returning();

    return {
      content: [{ type: "text" as const, text: JSON.stringify(row, null, 2) }],
    };
  }
);

server.tool(
  "update_signal",
  "Update a signal's human priority or mark it as reviewed.",
  {
    signalId: z.string().uuid().describe("Signal ID to update"),
    humanPriority: z
      .enum(["critical", "high", "medium", "low"])
      .nullable()
      .describe("Human-assigned priority (null to clear)"),
  },
  async ({ signalId, humanPriority }) => {
    const [row] = await db
      .update(signals)
      .set({
        humanPriority: humanPriority ?? null,
        reviewedAt: humanPriority ? new Date() : null,
      })
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

const SYNTHESIS_SCHEMA = {
  type: "object",
  properties: {
    operations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["create", "modify", "delete"] },
          documentId: { type: "string" },
          title: { type: "string" },
          content: { type: "string" },
          reasoning: { type: "string" },
        },
        required: ["action", "title", "content"],
        additionalProperties: false,
      },
    },
    commitSummary: { type: "string" },
    priorityRecommendations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          signalId: { type: "string" },
          recommended: { type: "string", enum: ["critical", "high", "medium", "low"] },
        },
        required: ["signalId", "recommended"],
        additionalProperties: false,
      },
    },
  },
  required: ["operations", "commitSummary", "priorityRecommendations"],
  additionalProperties: false,
} as const;

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

    // Get all signals
    const allSignals = await db
      .select({ id: signals.id, content: signals.content, aiPriority: signals.aiPriority, createdAt: signals.createdAt })
      .from(signals)
      .where(eq(signals.workspaceId, WORKSPACE_ID))
      .orderBy(desc(signals.createdAt));

    if (allSignals.length === 0) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ summary: "No signals to process.", operations: [] }) }] };
    }

    // Find unprocessed signals
    const linkedSignals = await db
      .select({ signalId: synthesisCommitSignals.signalId })
      .from(synthesisCommitSignals);
    const processedIds = new Set(linkedSignals.map((r) => r.signalId));
    const pendingSignals = allSignals.filter((s) => !processedIds.has(s.id));

    if (pendingSignals.length === 0) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ summary: "No new signals to process.", operations: [] }) }] };
    }

    // Get current synthesis documents
    const currentDocs = await db
      .select({ id: brainDocuments.id, title: brainDocuments.title, content: brainDocuments.content })
      .from(brainDocuments)
      .where(and(eq(brainDocuments.workspaceId, WORKSPACE_ID), eq(brainDocuments.scope, "synthesis"), isNull(brainDocuments.userId)));

    // Get head commit
    const [headCommit] = await db
      .select()
      .from(synthesisCommits)
      .where(eq(synthesisCommits.workspaceId, WORKSPACE_ID))
      .orderBy(desc(synthesisCommits.createdAt))
      .limit(1);

    // Call Claude for synthesis
    const prompt = [
      "Current synthesis documents:",
      currentDocs.length ? JSON.stringify(currentDocs.map((d) => ({ id: d.id, title: d.title, content: d.content ?? "" })), null, 2) : "[]",
      "",
      "New signals to process:",
      JSON.stringify(pendingSignals.map((s) => ({ id: s.id, content: s.content, aiPriority: s.aiPriority })), null, 2),
    ].join("\n");

    const { result } = await generateStructuredJSON<{
      operations: Array<{ action: "create" | "modify" | "delete"; documentId?: string; title: string; content: string; reasoning?: string }>;
      commitSummary: string;
      priorityRecommendations: Array<{ signalId: string; recommended: "critical" | "high" | "medium" | "low" }>;
    }>({
      system: "You maintain a workspace synthesis document set. Update documents based on new signals. Keep output concise and actionable.",
      prompt,
      schema: SYNTHESIS_SCHEMA,
      maxTokens: 4096,
    });

    // Apply operations
    const documentMap = new Map(currentDocs.map((d) => [d.id, d]));
    const changedVersions: Array<{ documentId: string; title: string; content: string; changeType: "created" | "modified" | "deleted" }> = [];

    for (const op of result.operations) {
      if (op.action === "create") {
        const embedding = op.content ? await generateEmbedding(op.content.slice(0, 8000)) : null;
        const [created] = await db
          .insert(brainDocuments)
          .values({ workspaceId: WORKSPACE_ID, userId: null, scope: "synthesis", title: op.title, content: op.content, embedding })
          .returning({ id: brainDocuments.id, title: brainDocuments.title, content: brainDocuments.content });
        changedVersions.push({ documentId: created.id, title: created.title, content: created.content ?? "", changeType: "created" });
      } else if (op.action === "modify" && op.documentId && documentMap.has(op.documentId)) {
        const embedding = op.content ? await generateEmbedding(op.content.slice(0, 8000)) : null;
        const [updated] = await db
          .update(brainDocuments)
          .set({ title: op.title, content: op.content, embedding, updatedAt: new Date() })
          .where(and(eq(brainDocuments.id, op.documentId), eq(brainDocuments.workspaceId, WORKSPACE_ID), eq(brainDocuments.scope, "synthesis"), isNull(brainDocuments.userId)))
          .returning({ id: brainDocuments.id, title: brainDocuments.title, content: brainDocuments.content });
        if (updated) changedVersions.push({ documentId: updated.id, title: updated.title, content: updated.content ?? "", changeType: "modified" });
      } else if (op.action === "delete" && op.documentId && documentMap.has(op.documentId)) {
        const existing = documentMap.get(op.documentId);
        const [deleted] = await db
          .delete(brainDocuments)
          .where(and(eq(brainDocuments.id, op.documentId), eq(brainDocuments.workspaceId, WORKSPACE_ID), eq(brainDocuments.scope, "synthesis"), isNull(brainDocuments.userId)))
          .returning({ id: brainDocuments.id });
        if (deleted && existing) changedVersions.push({ documentId: existing.id, title: existing.title, content: existing.content ?? "", changeType: "deleted" });
      }
    }

    // Create commit
    const [commit] = await db
      .insert(synthesisCommits)
      .values({ workspaceId: WORKSPACE_ID, parentId: headCommit?.id ?? null, summary: result.commitSummary, trigger: "manual", signalCount: pendingSignals.length })
      .returning({ id: synthesisCommits.id, summary: synthesisCommits.summary });

    // Record document versions
    if (changedVersions.length > 0) {
      await db.insert(synthesisDocumentVersions).values(
        changedVersions.map((v) => ({ documentId: v.documentId, commitId: commit.id, title: v.title, content: v.content, changeType: v.changeType }))
      );
    }

    // Link signals to commit
    await db.insert(synthesisCommitSignals).values(
      pendingSignals.map((s) => ({ commitId: commit.id, signalId: s.id }))
    );

    // Apply priority recommendations
    const validIds = new Set(pendingSignals.map((s) => s.id));
    for (const rec of result.priorityRecommendations.filter((r) => validIds.has(r.signalId))) {
      await db.update(signals).set({ aiPriority: rec.recommended }).where(eq(signals.id, rec.signalId));
    }

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          commitId: commit.id,
          summary: commit.summary,
          processedSignals: pendingSignals.length,
          operations: result.operations.map((op) => ({ action: op.action, title: op.title, reasoning: op.reasoning })),
          priorityRecommendations: result.priorityRecommendations,
        }, null, 2),
      }],
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

// ── Start ───────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Tensient MCP server failed to start:", err);
  process.exit(1);
});
