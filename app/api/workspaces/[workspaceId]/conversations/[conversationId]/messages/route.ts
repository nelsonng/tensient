import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { conversations, messages } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getWorkspaceMembership } from "@/lib/auth/workspace-access";
import { checkUsageAllowed, logUsage } from "@/lib/usage-guard";
import { processConversationMessage } from "@/lib/services/process-conversation";
import { trackEvent } from "@/lib/platform-events";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ workspaceId: string; conversationId: string }> };

function buildFallbackTitle(content: string): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) return "Untitled conversation";
  return normalized.length <= 50 ? normalized : `${normalized.slice(0, 47)}...`;
}

// POST /api/workspaces/[id]/conversations/[cid]/messages -- Send message (triggers AI)
export async function POST(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId, conversationId } = await params;
  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify conversation ownership
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.workspaceId, workspaceId),
        eq(conversations.userId, session.user.id)
      )
    )
    .limit(1);

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  // Usage guard
  const usageCheck = await checkUsageAllowed(session.user.id);
  if (!usageCheck.allowed) {
    return NextResponse.json({ error: usageCheck.reason }, { status: 429 });
  }

  const body = await request.json();
  const { content, audioUrl, attachments } = body;

  if (!content || typeof content !== "string" || content.trim().length < 1) {
    return NextResponse.json(
      { error: "Message content is required" },
      { status: 400 }
    );
  }

  const trimmedContent = content.trim();

  try {
    // 1. Insert user message
    const [userMessage] = await db
      .insert(messages)
      .values({
        conversationId,
        role: "user",
        content: trimmedContent,
        audioUrl: audioUrl || null,
        attachments: attachments || null,
      })
      .returning();

    // 1b. Ensure conversation has a usable title immediately
    if (!conversation.title || conversation.title.trim().toLowerCase() === "untitled conversation") {
      await db
        .update(conversations)
        .set({
          title: buildFallbackTitle(trimmedContent),
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, conversationId));
    }

    // 2. Process via AI and get assistant response
    const { assistantMessage, usage } = await processConversationMessage({
      conversationId,
      workspaceId,
      userId: session.user.id,
      userMessage,
    });

    // 3. Log usage
    await logUsage({
      userId: session.user.id,
      workspaceId,
      operation: "conversation",
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      estimatedCostCents: usage.estimatedCostCents,
    });

    // 4. Update conversation timestamp
    await db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));

    trackEvent("message_sent", {
      userId: session.user.id,
      workspaceId,
      metadata: {
        conversationId,
        hasAudio: !!audioUrl,
        attachmentCount: attachments?.length || 0,
      },
    });

    return NextResponse.json({
      userMessage,
      assistantMessage,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Message processing failed";
    logger.error("Message processing failed", { error: message, conversationId });
    trackEvent("api_error", {
      userId: session.user.id,
      workspaceId,
      metadata: { route: "/api/workspaces/*/conversations/*/messages", error: message },
    });
    return NextResponse.json(
      { error: "Message processing failed" },
      { status: 500 }
    );
  }
}
