import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { trackEvent } from "@/lib/platform-events";
import { logger } from "@/lib/logger";

type RouteHandler<TContext = unknown> = (
  request: Request,
  context: TContext
) => Response | Promise<Response>;

function getRoutePath(request: Request): string {
  try {
    return new URL(request.url).pathname;
  } catch {
    return request.url;
  }
}

export function withErrorTracking<TContext = unknown>(
  userGoal: string,
  handler: RouteHandler<TContext>
): RouteHandler<TContext> {
  return async (request: Request, context: TContext) => {
    try {
      const response = await handler(request, context);
      if (response.status >= 500) {
        const session = await auth().catch(() => null);
        const routePath = getRoutePath(request);

        logger.error("API route returned server error", {
          userGoal,
          method: request.method,
          route: routePath,
          status: response.status,
        });

        trackEvent("api_error", {
          userId: session?.user?.id,
          metadata: {
            userGoal,
            method: request.method,
            route: routePath,
            status: response.status,
          },
        });
      }

      return response;
    } catch (error) {
      const session = await auth().catch(() => null);
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      const routePath = getRoutePath(request);

      logger.error("API route failed", {
        userGoal,
        method: request.method,
        route: routePath,
        error: message,
      });

      trackEvent("api_error", {
        userId: session?.user?.id,
        metadata: {
          userGoal,
          method: request.method,
          route: routePath,
          error: message,
          stack,
        },
      });

      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}
