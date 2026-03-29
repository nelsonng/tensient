import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { feedbackSubmissions } from "@/lib/db/schema";
import { resolveApiKey } from "@/lib/auth/mcp-auth";
import { getRequestGeo } from "@/lib/request-geo";
import { trackEvent } from "@/lib/platform-events";
import { withErrorTracking } from "@/lib/api-handler";
import { nanoid } from "@/lib/utils";
import { sql } from "drizzle-orm";

const FEEDBACK_ALLOWED_ORIGINS = (process.env.FEEDBACK_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const FEEDBACK_RATE_LIMIT_PER_MINUTE = Number(
  process.env.FEEDBACK_RATE_LIMIT_PER_MINUTE ?? 60
);
const FEEDBACK_IP_RATE_LIMIT_PER_MINUTE = 10;

function getCorsHeaders(origin: string | null): HeadersInit {
  if (!origin) return {};
  if (
    FEEDBACK_ALLOWED_ORIGINS.length === 0 ||
    FEEDBACK_ALLOWED_ORIGINS.includes(origin) ||
    FEEDBACK_ALLOWED_ORIGINS.includes("*")
  ) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "Authorization, Content-Type, X-API-Key",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    };
  }
  return {};
}

function extractApiKeyFromRequest(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const [scheme, token] = authHeader.split(" ");
    if (scheme === "Bearer" && token) return token.trim();
  }
  const xApiKey = request.headers.get("x-api-key");
  if (xApiKey) return xApiKey.trim();
  return null;
}

async function isApiKeyRateLimited(apiKeyId: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT COUNT(*)::int AS count
    FROM platform_events
    WHERE type = 'feedback_submitted'
      AND metadata->>'apiKeyId' = ${apiKeyId}
      AND created_at > NOW() - INTERVAL '60 seconds'
  `);
  const count = Number(result.rows[0]?.count ?? 0);
  return count >= FEEDBACK_RATE_LIMIT_PER_MINUTE;
}

async function isIpRateLimited(ip: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT COUNT(*)::int AS count
    FROM platform_events
    WHERE type = 'feedback_submitted'
      AND metadata->>'ip' = ${ip}
      AND created_at > NOW() - INTERVAL '60 seconds'
  `);
  const count = Number(result.rows[0]?.count ?? 0);
  return count >= FEEDBACK_IP_RATE_LIMIT_PER_MINUTE;
}

async function optionsHandler(request: Request) {
  const origin = request.headers.get("origin");
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(origin),
  });
}

async function postHandler(request: Request) {
  const origin = request.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Auth
  const rawKey = extractApiKeyFromRequest(request);
  if (!rawKey) {
    return NextResponse.json(
      { error: "Missing API key. Use Authorization: Bearer tns_... or X-API-Key header." },
      { status: 401, headers: corsHeaders }
    );
  }

  const resolved = await resolveApiKey(rawKey);
  if (!resolved) {
    return NextResponse.json(
      { error: "Invalid or revoked API key." },
      { status: 401, headers: corsHeaders }
    );
  }

  // Rate limiting — per API key
  const keyLimited = await isApiKeyRateLimited(resolved.apiKeyId);
  if (keyLimited) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Max 60 submissions per minute per API key." },
      { status: 429, headers: corsHeaders }
    );
  }

  // Rate limiting — per IP
  const geo = getRequestGeo(request);
  if (geo.ip) {
    const ipLimited = await isIpRateLimited(geo.ip);
    if (ipLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Max 10 submissions per minute per IP." },
        { status: 429, headers: corsHeaders }
      );
    }
  }

  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400, headers: corsHeaders }
    );
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Request body must be a JSON object." },
      { status: 400, headers: corsHeaders }
    );
  }

  const {
    category,
    subject,
    description,
    submitter,
    context,
    customContext,
    tags,
  } = body as Record<string, unknown>;

  // Validate required fields
  const validCategories = ["bug_report", "feature_request", "help_request", "urgent_issue"];
  if (!category || !validCategories.includes(category as string)) {
    return NextResponse.json(
      { error: `category must be one of: ${validCategories.join(", ")}` },
      { status: 400, headers: corsHeaders }
    );
  }
  if (!subject || typeof subject !== "string" || !subject.trim()) {
    return NextResponse.json(
      { error: "subject is required." },
      { status: 400, headers: corsHeaders }
    );
  }
  if (subject.length > 200) {
    return NextResponse.json(
      { error: "subject must be 200 characters or fewer." },
      { status: 400, headers: corsHeaders }
    );
  }
  if (!description || typeof description !== "string" || !description.trim()) {
    return NextResponse.json(
      { error: "description is required." },
      { status: 400, headers: corsHeaders }
    );
  }
  if (description.length > 10000) {
    return NextResponse.json(
      { error: "description must be 10,000 characters or fewer." },
      { status: 400, headers: corsHeaders }
    );
  }

  // Extract submitter fields
  const sub = (submitter && typeof submitter === "object" ? submitter : {}) as Record<string, unknown>;
  const ctx = (context && typeof context === "object" ? context : {}) as Record<string, unknown>;

  const trackingId = `fb_${nanoid(12)}`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://tensient.com";

  const [row] = await db
    .insert(feedbackSubmissions)
    .values({
      workspaceId: resolved.workspaceId,
      apiKeyId: resolved.apiKeyId,
      trackingId,
      category: category as "bug_report" | "feature_request" | "help_request" | "urgent_issue",
      subject: subject.trim(),
      description: description.trim(),

      // Submitter
      submitterType: (sub.type === "ai_agent" ? "ai_agent" : "human") as "human" | "ai_agent",
      submitterEmail: typeof sub.email === "string" ? sub.email : null,
      submitterName: typeof sub.name === "string" ? sub.name : null,
      submitterExternalId: typeof sub.externalId === "string" ? sub.externalId : null,
      submitterIsAuthenticated:
        typeof sub.isAuthenticated === "boolean" ? sub.isAuthenticated : null,
      submitterMeta:
        sub.agentId || sub.agentContext
          ? { agentId: sub.agentId, agentContext: sub.agentContext }
          : null,

      // Page context from client
      currentUrl: typeof ctx.url === "string" ? ctx.url : null,
      referrerUrl: typeof ctx.referrer === "string" ? ctx.referrer : null,
      pageTitle: typeof ctx.pageTitle === "string" ? ctx.pageTitle : null,
      userAgent:
        typeof ctx.userAgent === "string"
          ? ctx.userAgent
          : request.headers.get("user-agent"),
      locale: typeof ctx.locale === "string" ? ctx.locale : null,
      timezone: typeof ctx.timezone === "string" ? ctx.timezone : null,

      // Server-captured geo
      ipAddress: geo.ip,
      geoCity: geo.city,
      geoRegion: geo.region,
      geoCountry: geo.country,

      // Rich context blobs
      browserInfo:
        ctx.browser || ctx.os
          ? { ...(ctx.browser as object ?? {}), os: ctx.os }
          : null,
      screenInfo: ctx.screen ?? null,
      hardwareInfo: ctx.hardware ?? null,
      networkInfo: ctx.network ?? null,
      performanceData: ctx.performance ?? null,
      consoleErrors: Array.isArray(ctx.errors) ? ctx.errors : null,
      deviceFingerprint: ctx.fingerprint ?? null,
      customContext: customContext && typeof customContext === "object" ? customContext : null,
      tags: Array.isArray(tags) ? (tags as string[]).filter((t) => typeof t === "string") : null,
    })
    .returning({
      id: feedbackSubmissions.id,
      trackingId: feedbackSubmissions.trackingId,
      status: feedbackSubmissions.status,
      createdAt: feedbackSubmissions.createdAt,
    });

  trackEvent("feedback_submitted", {
    workspaceId: resolved.workspaceId,
    metadata: {
      apiKeyId: resolved.apiKeyId,
      feedbackId: row.id,
      category,
      ip: geo.ip,
    },
  });

  return NextResponse.json(
    {
      id: row.id,
      trackingId: row.trackingId,
      trackingUrl: `${appUrl}/feedback/track/${row.trackingId}`,
      status: row.status,
      createdAt: row.createdAt,
    },
    { status: 201, headers: corsHeaders }
  );
}

export const OPTIONS = withErrorTracking(
  "Handle feedback ingest preflight",
  optionsHandler
);
export const POST = withErrorTracking("Ingest feedback submission", postHandler);
