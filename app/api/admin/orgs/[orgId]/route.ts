import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  organizations,
  users,
  workspaces,
  memberships,
  canons,
  captures,
  artifacts,
  actions,
  digests,
  usageLogs,
  platformEvents,
  protocols,
  passwordResetTokens,
  emailVerificationTokens,
} from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { requireSuperAdminAPI } from "@/lib/auth/require-super-admin";

// DELETE /api/admin/orgs/[orgId] -- nuke an entire org and all its data
// Note: neon-http driver does not support transactions, so we run deletes
// sequentially in FK-safe order. If a step fails midway, the org row still
// exists and the operation can be retried safely.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await requireSuperAdminAPI();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orgId } = await params;

  // Verify org exists
  const [org] = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, orgId));

  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Self-protection: refuse if the calling admin belongs to this org
  const [selfUser] = await db
    .select({ orgId: users.organizationId })
    .from(users)
    .where(eq(users.id, session.user.id));

  if (selfUser?.orgId === orgId) {
    return NextResponse.json(
      { error: "Cannot delete your own organization" },
      { status: 400 }
    );
  }

  // Collect IDs for cascade
  const orgWorkspaces = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.organizationId, orgId));
  const wsIds = orgWorkspaces.map((w) => w.id);

  const orgUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.organizationId, orgId));
  const userIds = orgUsers.map((u) => u.id);

  let captureIds: string[] = [];
  if (wsIds.length > 0) {
    const orgCaptures = await db
      .select({ id: captures.id })
      .from(captures)
      .where(inArray(captures.workspaceId, wsIds));
    captureIds = orgCaptures.map((c) => c.id);
  }

  const deleted = { users: userIds.length, workspaces: wsIds.length, captures: captureIds.length };

  try {
    // 1. Null out workspace active_protocol_id to avoid FK issues
    if (wsIds.length > 0) {
      await db
        .update(workspaces)
        .set({ activeProtocolId: null })
        .where(inArray(workspaces.id, wsIds));
    }

    // 2. Delete actions (references artifacts, captures, users, workspaces, canons)
    if (wsIds.length > 0) {
      await db.delete(actions).where(inArray(actions.workspaceId, wsIds));
    }

    // 3. Delete artifacts (references captures, canons)
    if (captureIds.length > 0) {
      await db.delete(artifacts).where(inArray(artifacts.captureId, captureIds));
    }

    // 4. Delete captures
    if (wsIds.length > 0) {
      await db.delete(captures).where(inArray(captures.workspaceId, wsIds));
    }

    // 5. Delete canons
    if (wsIds.length > 0) {
      await db.delete(canons).where(inArray(canons.workspaceId, wsIds));
    }

    // 6. Delete digests
    if (wsIds.length > 0) {
      await db.delete(digests).where(inArray(digests.workspaceId, wsIds));
    }

    // 7. Delete usage logs
    if (userIds.length > 0) {
      await db.delete(usageLogs).where(inArray(usageLogs.userId, userIds));
    }

    // 8. Delete platform events (can reference org, user, or workspace)
    await db.delete(platformEvents).where(eq(platformEvents.organizationId, orgId));
    if (userIds.length > 0) {
      await db.delete(platformEvents).where(inArray(platformEvents.userId, userIds));
    }
    if (wsIds.length > 0) {
      await db.delete(platformEvents).where(inArray(platformEvents.workspaceId, wsIds));
    }

    // 9. Delete memberships
    if (wsIds.length > 0) {
      await db.delete(memberships).where(inArray(memberships.workspaceId, wsIds));
    }

    // 10. Delete token tables for org users
    if (userIds.length > 0) {
      await db.delete(passwordResetTokens).where(inArray(passwordResetTokens.userId, userIds));
      await db.delete(emailVerificationTokens).where(inArray(emailVerificationTokens.userId, userIds));
    }

    // 11. Delete workspaces
    if (wsIds.length > 0) {
      await db.delete(workspaces).where(inArray(workspaces.id, wsIds));
    }

    // 12. Handle protocols: null parent refs, then delete org/workspace-owned
    const ownedProtocolIds: string[] = [];

    const orgProtocols = await db
      .select({ id: protocols.id })
      .from(protocols)
      .where(and(eq(protocols.ownerType, "organization"), eq(protocols.ownerId, orgId)));
    ownedProtocolIds.push(...orgProtocols.map((p) => p.id));

    if (wsIds.length > 0) {
      const wsProtocols = await db
        .select({ id: protocols.id })
        .from(protocols)
        .where(and(eq(protocols.ownerType, "workspace"), inArray(protocols.ownerId, wsIds)));
      ownedProtocolIds.push(...wsProtocols.map((p) => p.id));
    }

    if (ownedProtocolIds.length > 0) {
      await db
        .update(protocols)
        .set({ parentId: null })
        .where(inArray(protocols.parentId, ownedProtocolIds));

      await db.delete(protocols).where(inArray(protocols.id, ownedProtocolIds));
    }

    // 13. Null created_by on protocols created by org users
    if (userIds.length > 0) {
      await db
        .update(protocols)
        .set({ createdBy: null })
        .where(inArray(protocols.createdBy, userIds));
    }

    // 14. Delete users
    if (userIds.length > 0) {
      await db.delete(users).where(inArray(users.id, userIds));
    }

    // 15. Delete the organization
    await db.delete(organizations).where(eq(organizations.id, orgId));
  } catch (e) {
    console.error("Org nuke failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to delete organization" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    action: "deleted",
    org: org.name,
    deleted,
  });
}
