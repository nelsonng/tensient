import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { trackEvent } from "@/lib/platform-events";
import { logger } from "@/lib/logger";
import { withErrorTracking } from "@/lib/api-handler";

/**
 * Client-side error ingestion endpoint.
 * Accepts error reports from error boundaries and global listeners,
 * then tracks them as "client_error" platform events.
 *
 * Does not require auth -- errors can happen pre-login.
 * Always returns 200 to avoid cascading failures on the client.
 */
async function postHandler(request: Request) {
  try {
    const body = await request.json();
    const { message, stack, digest, route, componentStack, source } = body as {
      message?: string;
      stack?: string;
      digest?: string;
      route?: string;
      componentStack?: string;
      source?: string;
    };

    // Best-effort session lookup for userId/workspaceId
    let userId: string | undefined;
    let workspaceId: string | undefined;
    try {
      const session = await auth();
      userId = session?.user?.id ?? undefined;
      // Extract workspaceId from route if available (e.g. /dashboard/uuid/...)
      if (route) {
        const match = route.match(
          /\/dashboard\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/
        );
        if (match) workspaceId = match[1];
      }
    } catch {
      // Auth lookup failed -- proceed without user context
    }

    trackEvent("client_error", {
      userId,
      workspaceId,
      metadata: {
        error: message || "Unknown client error",
        stack: stack?.slice(0, 2000), // Cap stack trace size
        digest,
        route: route || "unknown",
        componentStack: componentStack?.slice(0, 1000),
        source: source || "error-boundary",
      },
    });
  } catch (error) {
    logger.error("Failed to process client error report", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Always 200 -- never fail the client
  return NextResponse.json({ ok: true });
}

export const POST = withErrorTracking("Report client error", postHandler);
