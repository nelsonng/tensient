import { and, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  brainDocuments,
  signals,
  synthesisCommits,
  synthesisCommitSignals,
  synthesisDocumentVersions,
} from "@/lib/db/schema";
import { calculateCostCents, generateEmbedding, generateStructuredJSON } from "@/lib/ai";
import { logger } from "@/lib/logger";
import { trackEvent } from "@/lib/platform-events";

type SynthesisTrigger = "conversation_end" | "manual" | "scheduled";
type SignalPriority = "critical" | "high" | "medium" | "low";

interface SynthesisResult {
  commitId: string | null;
  summary: string;
  operations: Array<{
    action: "create" | "modify" | "delete";
    documentId?: string;
    title: string;
    content: string;
    reasoning?: string;
  }>;
  priorityRecommendations: Array<{
    signalId: string;
    recommended: SignalPriority;
  }>;
  processedSignalCount: number;
  usage: {
    inputTokens: number;
    outputTokens: number;
    estimatedCostCents: number;
  } | null;
}

interface SynthesisOutput {
  operations: Array<{
    action: "create" | "modify" | "delete";
    documentId?: string;
    title: string;
    content: string;
    reasoning?: string;
  }>;
  commitSummary: string;
  priorityRecommendations: Array<{
    signalId: string;
    recommended: SignalPriority;
  }>;
}

const SYNTHESIS_SCHEMA = {
  type: "object",
  properties: {
    operations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["create", "modify", "delete"],
          },
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
          recommended: {
            type: "string",
            enum: ["critical", "high", "medium", "low"],
          },
        },
        required: ["signalId", "recommended"],
        additionalProperties: false,
      },
    },
  },
  required: ["operations", "commitSummary", "priorityRecommendations"],
  additionalProperties: false,
} as const;

export async function processSynthesis(input: {
  workspaceId: string;
  userId: string;
  trigger: SynthesisTrigger;
}): Promise<SynthesisResult> {
  const { workspaceId, userId, trigger } = input;

  const allSignals = await db
    .select({
      id: signals.id,
      content: signals.content,
      aiPriority: signals.aiPriority,
      createdAt: signals.createdAt,
    })
    .from(signals)
    .where(
      and(
        eq(signals.workspaceId, workspaceId),
        ne(signals.status, "dismissed")
      )
    )
    .orderBy(desc(signals.createdAt));

  if (allSignals.length === 0) {
    return {
      commitId: null,
      summary: "No signals to process.",
      operations: [],
      priorityRecommendations: [],
      processedSignalCount: 0,
      usage: null,
    };
  }

  const linkedSignals = await db
    .select({ signalId: synthesisCommitSignals.signalId })
    .from(synthesisCommitSignals);

  const processedIds = new Set(linkedSignals.map((row) => row.signalId));
  const pendingSignals = allSignals.filter((row) => !processedIds.has(row.id));

  if (pendingSignals.length === 0) {
    return {
      commitId: null,
      summary: "No new signals to process.",
      operations: [],
      priorityRecommendations: [],
      processedSignalCount: 0,
      usage: null,
    };
  }

  const currentDocs = await db
    .select({
      id: brainDocuments.id,
      title: brainDocuments.title,
      content: brainDocuments.content,
    })
    .from(brainDocuments)
    .where(
      and(
        eq(brainDocuments.workspaceId, workspaceId),
        eq(brainDocuments.scope, "synthesis"),
        isNull(brainDocuments.userId)
      )
    );

  const [headCommit] = await db
    .select()
    .from(synthesisCommits)
    .where(eq(synthesisCommits.workspaceId, workspaceId))
    .orderBy(desc(synthesisCommits.createdAt))
    .limit(1);

  const prompt = [
    "Current synthesis documents:",
    currentDocs.length
      ? JSON.stringify(
          currentDocs.map((doc) => ({
            id: doc.id,
            title: doc.title,
            content: doc.content ?? "",
          })),
          null,
          2
        )
      : "[]",
    "",
    "New signals to process:",
    JSON.stringify(
      pendingSignals.map((signal) => ({
        id: signal.id,
        content: signal.content,
        aiPriority: signal.aiPriority,
      })),
      null,
      2
    ),
  ].join("\n");

  const { result, inputTokens, outputTokens } =
    await generateStructuredJSON<SynthesisOutput>({
      system:
        "You maintain a workspace synthesis document set. Update documents based on new signals. Keep output concise and actionable.",
      prompt,
      schema: SYNTHESIS_SCHEMA,
      maxTokens: 4096,
    });

  const documentMap = new Map(currentDocs.map((doc) => [doc.id, doc]));
  const changedDocumentVersions: Array<{
    documentId: string;
    title: string;
    content: string;
    changeType: "created" | "modified" | "deleted";
  }> = [];

  for (const op of result.operations) {
    if (op.action === "create") {
      const embedding = op.content
        ? await generateEmbedding(op.content.slice(0, 8000))
        : null;
      const [created] = await db
        .insert(brainDocuments)
        .values({
          workspaceId,
          userId: null,
          scope: "synthesis",
          title: op.title,
          content: op.content,
          embedding,
        })
        .returning({ id: brainDocuments.id, title: brainDocuments.title, content: brainDocuments.content });

      changedDocumentVersions.push({
        documentId: created.id,
        title: created.title,
        content: created.content ?? "",
        changeType: "created",
      });
      continue;
    }

    if (op.action === "modify" && op.documentId && documentMap.has(op.documentId)) {
      const embedding = op.content
        ? await generateEmbedding(op.content.slice(0, 8000))
        : null;
      const [updated] = await db
        .update(brainDocuments)
        .set({
          title: op.title,
          content: op.content,
          embedding,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(brainDocuments.id, op.documentId),
            eq(brainDocuments.workspaceId, workspaceId),
            eq(brainDocuments.scope, "synthesis"),
            isNull(brainDocuments.userId)
          )
        )
        .returning({
          id: brainDocuments.id,
          title: brainDocuments.title,
          content: brainDocuments.content,
        });

      if (updated) {
        changedDocumentVersions.push({
          documentId: updated.id,
          title: updated.title,
          content: updated.content ?? "",
          changeType: "modified",
        });
      }
      continue;
    }

    if (op.action === "delete" && op.documentId && documentMap.has(op.documentId)) {
      const existing = documentMap.get(op.documentId);
      const [deleted] = await db
        .delete(brainDocuments)
        .where(
          and(
            eq(brainDocuments.id, op.documentId),
            eq(brainDocuments.workspaceId, workspaceId),
            eq(brainDocuments.scope, "synthesis"),
            isNull(brainDocuments.userId)
          )
        )
        .returning({ id: brainDocuments.id });

      if (deleted && existing) {
        changedDocumentVersions.push({
          documentId: existing.id,
          title: existing.title,
          content: existing.content ?? "",
          changeType: "deleted",
        });
      }
    }
  }

  const [commit] = await db
    .insert(synthesisCommits)
    .values({
      workspaceId,
      parentId: headCommit?.id ?? null,
      summary: result.commitSummary,
      trigger,
      signalCount: pendingSignals.length,
    })
    .returning({ id: synthesisCommits.id, summary: synthesisCommits.summary });

  if (changedDocumentVersions.length > 0) {
    await db.insert(synthesisDocumentVersions).values(
      changedDocumentVersions.map((version) => ({
        documentId: version.documentId,
        commitId: commit.id,
        title: version.title,
        content: version.content,
        changeType: version.changeType,
      }))
    );
  }

  await db.insert(synthesisCommitSignals).values(
    pendingSignals.map((signal) => ({
      commitId: commit.id,
      signalId: signal.id,
    }))
  );

  const validSignalIds = new Set(pendingSignals.map((signal) => signal.id));
  const updates = result.priorityRecommendations.filter((rec) =>
    validSignalIds.has(rec.signalId)
  );
  for (const rec of updates) {
    await db
      .update(signals)
      .set({ aiPriority: rec.recommended })
      .where(eq(signals.id, rec.signalId));
  }

  trackEvent("synthesis_completed", {
    userId,
    workspaceId,
    metadata: {
      commitId: commit.id,
      signalCount: pendingSignals.length,
      operationCount: result.operations.length,
    },
  });

  return {
    commitId: commit.id,
    summary: commit.summary,
    operations: result.operations,
    priorityRecommendations: updates,
    processedSignalCount: pendingSignals.length,
    usage: {
      inputTokens,
      outputTokens,
      estimatedCostCents: calculateCostCents(inputTokens, outputTokens),
    },
  };
}

export async function getUnprocessedSignalCount(workspaceId: string): Promise<number> {
  try {
    const all = await db
      .select({ id: signals.id })
      .from(signals)
      .where(
        and(
          eq(signals.workspaceId, workspaceId),
          ne(signals.status, "dismissed")
        )
      );
    if (all.length === 0) return 0;

    const linked = await db
      .select({ signalId: synthesisCommitSignals.signalId })
      .from(synthesisCommitSignals)
      .where(inArray(synthesisCommitSignals.signalId, all.map((row) => row.id)));

    const linkedSet = new Set(linked.map((row) => row.signalId));
    return all.filter((row) => !linkedSet.has(row.id)).length;
  } catch (error) {
    logger.error("Failed to count unprocessed signals", {
      workspaceId,
      error: String(error),
    });
    return 0;
  }
}
