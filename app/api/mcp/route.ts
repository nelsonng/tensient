import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { registerTools } from "@/mcp/tools";
import { resolveApiKey } from "@/lib/auth/mcp-auth";
import { isApiKeyRateLimited } from "@/lib/auth/mcp-rate-limit";
import { trackEvent } from "@/lib/platform-events";

const MCP_ALLOWED_ORIGINS = (process.env.MCP_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

function getCorsHeaders(origin: string | null): HeadersInit {
  if (!origin || MCP_ALLOWED_ORIGINS.length === 0) {
    return {};
  }
  if (MCP_ALLOWED_ORIGINS.includes(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "Authorization, Content-Type, MCP-Protocol-Version",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    };
  }
  return {};
}

function extractBearerToken(header: string | null): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token.trim();
}

function getCalledToolName(parsedBody: unknown): string | null {
  const message = Array.isArray(parsedBody) ? parsedBody[0] : parsedBody;
  if (!message || typeof message !== "object") return null;
  const method = (message as { method?: unknown }).method;
  if (method !== "tools/call") return null;
  const params = (message as { params?: { name?: unknown } }).params;
  return typeof params?.name === "string" ? params.name : null;
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(origin),
  });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (
    origin &&
    MCP_ALLOWED_ORIGINS.length > 0 &&
    !MCP_ALLOWED_ORIGINS.includes(origin)
  ) {
    return new Response("Origin not allowed", {
      status: 403,
      headers: getCorsHeaders(origin),
    });
  }

  const authHeader = request.headers.get("authorization");
  const token = extractBearerToken(authHeader);
  if (!token) {
    trackEvent("mcp_auth_failed", {
      metadata: { reason: "missing_bearer_token" },
    });
    return new Response("Unauthorized", {
      status: 401,
      headers: getCorsHeaders(origin),
    });
  }

  const resolved = await resolveApiKey(token);
  if (!resolved) {
    trackEvent("mcp_auth_failed", {
      metadata: { reason: "invalid_or_revoked_key", keyPrefix: token.slice(0, 8) },
    });
    return new Response("Unauthorized", {
      status: 401,
      headers: getCorsHeaders(origin),
    });
  }

  const parsedBody =
    request.method === "POST"
      ? await request
          .clone()
          .json()
          .catch(() => undefined)
      : undefined;

  const toolName = getCalledToolName(parsedBody);
  if (toolName) {
    const maxCallsPerMinute = Number(process.env.MCP_KEY_RATE_LIMIT_PER_MINUTE ?? 100);
    const isRateLimited = await isApiKeyRateLimited(
      resolved.apiKeyId,
      maxCallsPerMinute
    );
    if (isRateLimited) {
      return new Response("Too Many Requests", {
        status: 429,
        headers: getCorsHeaders(origin),
      });
    }
  }

  trackEvent("mcp_connection", {
    userId: resolved.userId,
    workspaceId: resolved.workspaceId,
    metadata: { apiKeyId: resolved.apiKeyId },
  });

  const server = new McpServer({
    name: "tensient",
    version: "0.1.0",
  });
  registerTools(server, resolved.workspaceId, resolved.userId);

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);
  const startedAt = Date.now();
  const response = await transport.handleRequest(request, { parsedBody });
  const durationMs = Date.now() - startedAt;
  await server.close();

  if (toolName) {
    trackEvent("mcp_tool_called", {
      userId: resolved.userId,
      workspaceId: resolved.workspaceId,
      metadata: {
        apiKeyId: resolved.apiKeyId,
        toolName,
        durationMs,
      },
    });
  }

  const headers = new Headers(response.headers);
  const corsHeaders = getCorsHeaders(origin);
  Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}
