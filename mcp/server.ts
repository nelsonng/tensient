import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { eq, and, desc, asc, isNull, sql } from "drizzle-orm";
import { db } from "./db";
import { generateEmbedding } from "./embeddings";
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

// ── Start ───────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Tensient MCP server failed to start:", err);
  process.exit(1);
});
