import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";
import {
  generateApiKey,
  userCanAccessWorkspace,
} from "@/lib/auth/mcp-auth";
import { trackEvent } from "@/lib/platform-events";

// GET /api/user/api-keys?workspaceId=...
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const workspaceId = url.searchParams.get("workspaceId");
  const whereClause = workspaceId
    ? and(
        eq(apiKeys.userId, session.user.id),
        eq(apiKeys.workspaceId, workspaceId)
      )
    : eq(apiKeys.userId, session.user.id);

  const rows = await db
    .select({
      id: apiKeys.id,
      workspaceId: apiKeys.workspaceId,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      lastUsedAt: apiKeys.lastUsedAt,
      createdAt: apiKeys.createdAt,
      revokedAt: apiKeys.revokedAt,
    })
    .from(apiKeys)
    .where(whereClause)
    .orderBy(desc(apiKeys.createdAt));

  return NextResponse.json(rows);
}

// POST /api/user/api-keys
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const workspaceId = body?.workspaceId as string | undefined;
  const name = body?.name as string | undefined;
  const rotateFromId = body?.rotateFromId as string | undefined;

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  const hasAccess = await userCanAccessWorkspace(session.user.id, workspaceId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const normalizedName = name?.trim() || "MCP Key";
  const { rawKey, keyHash, keyPrefix } = generateApiKey();

  const [created] = await db
    .insert(apiKeys)
    .values({
      userId: session.user.id,
      workspaceId,
      name: normalizedName,
      keyPrefix,
      keyHash,
    })
    .returning({
      id: apiKeys.id,
      workspaceId: apiKeys.workspaceId,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      createdAt: apiKeys.createdAt,
    });

  trackEvent("api_key_created", {
    userId: session.user.id,
    workspaceId,
    metadata: {
      apiKeyId: created.id,
      keyPrefix: created.keyPrefix,
      name: created.name,
    },
  });

  if (rotateFromId) {
    const [revoked] = await db
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(apiKeys.id, rotateFromId),
          eq(apiKeys.userId, session.user.id),
          eq(apiKeys.workspaceId, workspaceId)
        )
      )
      .returning({ id: apiKeys.id });

    if (revoked) {
      trackEvent("api_key_revoked", {
        userId: session.user.id,
        workspaceId,
        metadata: { apiKeyId: revoked.id, reason: "rotation" },
      });
    }
  }

  return NextResponse.json(
    {
      ...created,
      key: rawKey,
      warning: "Store this API key now. It will not be shown again.",
    },
    { status: 201 }
  );
}

// DELETE /api/user/api-keys
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const keyId = body?.id as string | undefined;
  if (!keyId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const [updated] = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, session.user.id)))
    .returning({ id: apiKeys.id, revokedAt: apiKeys.revokedAt });

  if (!updated) {
    return NextResponse.json({ error: "Key not found" }, { status: 404 });
  }

  trackEvent("api_key_revoked", {
    userId: session.user.id,
    metadata: { apiKeyId: updated.id },
  });

  return NextResponse.json(updated);
}
