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

  function getRegisteredToolCount(): number {
    const registeredTools = (
      server as unknown as { _registeredTools?: Record<string, unknown> }
    )._registeredTools;
    return registeredTools ? Object.keys(registeredTools).length : 0;
  }

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
      .leftJoin(conversations, eq(conversations.id, signals.conversationId))
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
  "start_session",
  "Get full orientation for an agent session. Returns synthesis docs, open signals, recent session logs, and world-model counts in a single response.",
  {
    include_signals: z
      .boolean()
      .default(true)
      .optional()
      .describe("Include open signal summaries"),
    include_synthesis: z
      .boolean()
      .default(true)
      .optional()
      .describe("Include synthesis document contents"),
    include_history: z
      .boolean()
      .default(true)
      .optional()
      .describe("Include recent session log entries"),
    max_signals: z
      .number()
      .int()
      .min(0)
      .max(50)
      .default(20)
      .optional()
      .describe("Maximum open signals to include"),
  },
  async ({
    include_signals = true,
    include_synthesis = true,
    include_history = true,
    max_signals = 20,
  }) => {
    const [signalStatsRows, lastSynthesisRow, totalDocRows] = await Promise.all([
      db
        .select({
          status: signals.status,
          count: sql<number>`count(*)`,
        })
        .from(signals)
        .where(eq(signals.workspaceId, WORKSPACE_ID))
        .groupBy(signals.status),
      db
        .select({
          createdAt: synthesisCommits.createdAt,
        })
        .from(synthesisCommits)
        .where(eq(synthesisCommits.workspaceId, WORKSPACE_ID))
        .orderBy(desc(synthesisCommits.createdAt))
        .limit(1),
      db
        .select({
          count: sql<number>`count(*)`,
        })
        .from(brainDocuments)
        .where(eq(brainDocuments.workspaceId, WORKSPACE_ID)),
    ]);

    const signalCounts = signalStatsRows.reduce(
      (acc, row) => {
        acc[row.status] = Number(row.count);
        return acc;
      },
      { open: 0, resolved: 0, dismissed: 0 } as Record<
        "open" | "resolved" | "dismissed",
        number
      >
    );

    const [synthesisDocuments, openSignals, recentSessionLogs] = await Promise.all([
      include_synthesis
        ? db
            .select({
              id: brainDocuments.id,
              title: brainDocuments.title,
              content: brainDocuments.content,
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
            .orderBy(desc(brainDocuments.updatedAt))
        : Promise.resolve([]),
      include_signals && max_signals > 0
        ? db
            .select({
              id: signals.id,
              content: signals.content,
              aiPriority: signals.aiPriority,
              humanPriority: signals.humanPriority,
              createdAt: signals.createdAt,
              conversationId: signals.conversationId,
              conversationTitle: conversations.title,
            })
            .from(signals)
            .leftJoin(conversations, eq(conversations.id, signals.conversationId))
            .where(
              and(
                eq(signals.workspaceId, WORKSPACE_ID),
                eq(signals.status, "open")
              )
            )
            .orderBy(desc(signals.createdAt))
            .limit(max_signals)
        : Promise.resolve([]),
      include_history
        ? db
            .select({
              id: brainDocuments.id,
              title: brainDocuments.title,
              content: brainDocuments.content,
              updatedAt: brainDocuments.updatedAt,
            })
            .from(brainDocuments)
            .where(
              and(
                eq(brainDocuments.workspaceId, WORKSPACE_ID),
                eq(brainDocuments.scope, "workspace"),
                isNull(brainDocuments.userId),
                ilike(brainDocuments.title, "Session Log:%")
              )
            )
            .orderBy(desc(brainDocuments.updatedAt))
            .limit(5)
        : Promise.resolve([]),
    ]);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              snapshot: {
                signalCounts,
                totalDocuments: Number(totalDocRows[0]?.count ?? 0),
                lastSynthesisAt: lastSynthesisRow[0]?.createdAt ?? null,
                registeredToolCount: getRegisteredToolCount(),
              },
              synthesisDocuments,
              openSignals,
              recentSessionLogs,
            },
            null,
            2
          ),
        },
      ],
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
  "Create a new signal (e.g., an insight from codebase analysis). Conversation/message linkage is optional.",
  {
    content: z.string().min(1).describe("Signal content text"),
    conversationId: z
      .string()
      .uuid()
      .optional()
      .describe("Conversation this signal relates to"),
    messageId: z
      .string()
      .uuid()
      .optional()
      .describe("Message this signal was extracted from"),
    aiPriority: z
      .enum(["critical", "high", "medium", "low"])
      .optional()
      .describe("Priority level"),
  },
  async ({ content, conversationId, messageId, aiPriority }) => {
    if ((conversationId && !messageId) || (!conversationId && messageId)) {
      return {
        content: [
          {
            type: "text" as const,
            text: "conversationId and messageId must both be provided together",
          },
        ],
        isError: true,
      };
    }

    if (conversationId && messageId) {
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
    }

    try {
      const embedding = await generateEmbedding(content.slice(0, 2000));

      const [row] = await db
        .insert(signals)
        .values({
          workspaceId: WORKSPACE_ID,
          userId: USER_ID,
          conversationId: conversationId ?? null,
          messageId: messageId ?? null,
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
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const cause = err instanceof Error && err.cause ? String(err.cause) : undefined;
      return {
        content: [
          {
            type: "text" as const,
            text: `Signal insert failed: ${cause ?? message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "end_session",
  "Record what happened in an agent session. Creates a session log and optional signals for decisions, debt, and observations.",
  {
    summary: z.string().min(1).describe("What was built or changed"),
    filesChanged: z
      .array(z.string())
      .optional()
      .describe("Key files modified in the session"),
    decisions: z
      .array(z.string())
      .optional()
      .describe("Architectural decisions made"),
    debtAdded: z
      .array(z.string())
      .optional()
      .describe("New technical debt introduced"),
    debtResolved: z
      .array(z.string())
      .optional()
      .describe("Technical debt items resolved"),
    observations: z
      .array(z.string())
      .optional()
      .describe("Additional insights or observations"),
  },
  async ({
    summary,
    filesChanged = [],
    decisions = [],
    debtAdded = [],
    debtResolved = [],
    observations = [],
  }) => {
    const now = new Date();
    const dateLabel = now.toISOString().slice(0, 10);
    const titleSnippet = summary.trim().slice(0, 80);
    const sessionTitle = `Session Log: ${dateLabel} -- ${titleSnippet}`;

    const sessionBody = [
      `# Session Log -- ${dateLabel}`,
      "",
      "## Summary",
      summary.trim(),
      "",
      "## Files Changed",
      ...(filesChanged.length > 0 ? filesChanged.map((f) => `- ${f}`) : ["- None provided"]),
      "",
      "## Decisions",
      ...(decisions.length > 0 ? decisions.map((d) => `- ${d}`) : ["- None provided"]),
      "",
      "## Technical Debt Added",
      ...(debtAdded.length > 0 ? debtAdded.map((d) => `- ${d}`) : ["- None provided"]),
      "",
      "## Technical Debt Resolved",
      ...(debtResolved.length > 0 ? debtResolved.map((d) => `- ${d}`) : ["- None provided"]),
      "",
      "## Observations",
      ...(observations.length > 0
        ? observations.map((o) => `- ${o}`)
        : ["- None provided"]),
    ].join("\n");

    try {
      const sessionEmbedding = await generateEmbedding(sessionBody.slice(0, 8000));
      const [sessionDoc] = await db
        .insert(brainDocuments)
        .values({
          workspaceId: WORKSPACE_ID,
          userId: null,
          scope: "workspace",
          title: sessionTitle,
          content: sessionBody,
          fileUrl: null,
          fileType: null,
          fileName: null,
          embedding: sessionEmbedding,
        })
        .returning({ id: brainDocuments.id, title: brainDocuments.title });

      const signalPayloads = [
        ...decisions.map((content) => ({ content, aiPriority: "medium" as const })),
        ...debtAdded.map((content) => ({ content, aiPriority: "high" as const })),
        ...debtResolved.map((content) => ({ content, aiPriority: "low" as const })),
        ...observations.map((content) => ({ content, aiPriority: null })),
      ].filter((item) => item.content.trim().length > 0);

      let createdSignals = 0;
      const signalErrors: string[] = [];
      for (const signalPayload of signalPayloads) {
        try {
          const embedding = await generateEmbedding(signalPayload.content.slice(0, 2000));
          await db.insert(signals).values({
            workspaceId: WORKSPACE_ID,
            userId: USER_ID,
            conversationId: null,
            messageId: null,
            content: signalPayload.content.trim(),
            embedding,
            aiPriority: signalPayload.aiPriority,
            humanPriority: null,
            reviewedAt: null,
            source: "mcp",
          });
          createdSignals += 1;
        } catch (signalErr) {
          const msg = signalErr instanceof Error ? signalErr.message : String(signalErr);
          const cause = signalErr instanceof Error && signalErr.cause ? String(signalErr.cause) : undefined;
          signalErrors.push(cause ?? msg);
        }
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                sessionDocumentId: sessionDoc.id,
                sessionDocumentTitle: sessionDoc.title,
                createdSignals,
                ...(signalErrors.length > 0 && { signalErrors }),
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const cause = err instanceof Error && err.cause ? String(err.cause) : undefined;
      return {
        content: [
          {
            type: "text" as const,
            text: `end_session failed: ${cause ?? message}`,
          },
        ],
        isError: true,
      };
    }
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

