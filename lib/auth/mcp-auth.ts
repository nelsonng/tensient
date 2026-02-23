import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiKeys, memberships } from "@/lib/db/schema";

export interface ResolvedApiKey {
  apiKeyId: string;
  userId: string;
  workspaceId: string;
}

export interface GeneratedApiKey {
  rawKey: string;
  keyPrefix: string;
  keyHash: string;
}

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

export function generateApiKey(): GeneratedApiKey {
  const rawKey = `tns_${randomBytes(24).toString("hex")}`;
  return {
    rawKey,
    keyPrefix: rawKey.slice(0, 8),
    keyHash: hashApiKey(rawKey),
  };
}

export async function resolveApiKey(
  keyString: string
): Promise<ResolvedApiKey | null> {
  const rawKey = keyString.trim();
  if (!rawKey.startsWith("tns_")) return null;

  const keyHash = hashApiKey(rawKey);
  const [row] = await db
    .select({
      id: apiKeys.id,
      userId: apiKeys.userId,
      workspaceId: apiKeys.workspaceId,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)))
    .limit(1);

  if (!row) return null;

  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, row.id));

  return {
    apiKeyId: row.id,
    userId: row.userId,
    workspaceId: row.workspaceId,
  };
}

export async function userCanAccessWorkspace(
  userId: string,
  workspaceId: string
): Promise<boolean> {
  const [membership] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(eq(memberships.userId, userId), eq(memberships.workspaceId, workspaceId))
    )
    .limit(1);
  return Boolean(membership);
}
