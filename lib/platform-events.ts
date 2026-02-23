import { db } from "@/lib/db";
import { platformEvents } from "@/lib/db/schema";
import { logger } from "@/lib/logger";

type PlatformEventType =
  | "sign_up_started"
  | "sign_up_completed"
  | "sign_up_failed"
  | "sign_in_success"
  | "sign_in_failed"
  | "onboarding_started"
  | "onboarding_completed"
  | "transcription_started"
  | "transcription_completed"
  | "transcription_failed"
  | "conversation_created"
  | "message_sent"
  | "brain_document_created"
  | "canon_document_created"
  | "workspace_joined"
  | "workspace_created"
  | "signal_extracted"
  | "synthesis_completed"
  | "usage_blocked"
  | "api_error"
  | "client_error"
  | "mcp_connection"
  | "mcp_tool_called"
  | "mcp_auth_failed"
  | "api_key_created"
  | "api_key_revoked";

interface TrackEventParams {
  userId?: string;
  workspaceId?: string;
  organizationId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Fire-and-forget event tracking for platform observability.
 * Never throws -- errors are logged but don't affect the caller.
 */
export function trackEvent(
  type: PlatformEventType,
  params: TrackEventParams = {}
) {
  // Fire and forget -- don't await
  db.insert(platformEvents)
    .values({
      type,
      userId: params.userId || null,
      workspaceId: params.workspaceId || null,
      organizationId: params.organizationId || null,
      metadata: params.metadata || null,
    })
    .then(() => {
      // Successfully tracked
    })
    .catch((error) => {
      logger.error("Failed to track platform event", {
        type,
        error: error instanceof Error ? error.message : String(error),
      });
    });
}

/**
 * Await-able version for cases where you want to ensure the event is tracked
 * before proceeding (e.g., sign-up completion).
 */
export async function trackEventSync(
  type: PlatformEventType,
  params: TrackEventParams = {}
) {
  try {
    await db.insert(platformEvents).values({
      type,
      userId: params.userId || null,
      workspaceId: params.workspaceId || null,
      organizationId: params.organizationId || null,
      metadata: params.metadata || null,
    });
  } catch (error) {
    logger.error("Failed to track platform event (sync)", {
      type,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
