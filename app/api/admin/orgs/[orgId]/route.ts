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

  // Collect capture IDs (needed for artifacts)
  let captureIds: string[] = [];
  if (wsIds.length > 0) {
    const orgCaptures = await db
      .select({ id: captures.id })
      .from(captures)
      .where(inArray(captures.workspaceId, wsIds));
    captureIds = orgCaptures.map((c) => c.id);
  }

  // Execute cascade in a transaction
  const deleted = { users: userIds.length, workspaces: wsIds.length, captures: captureIds.length };

  await db.transaction(async (tx) => {
    // 1. Null out workspace active_protocol_id to avoid FK issues
    if (wsIds.length > 0) {
      await tx
        .update(workspaces)
        .set({ activeProtocolId: null })
        .where(inArray(workspaces.id, wsIds));
    }

    // 2. Delete actions (reference artifacts, captures, users, workspaces, canons)
    if (wsIds.length > 0) {
      await tx.delete(actions).where(inArray(actions.workspaceId, wsIds));
    }

    // 3. Delete artifacts (reference captures, canons)
    if (captureIds.length > 0) {
      await tx.delete(artifacts).where(inArray(artifacts.captureId, captureIds));
    }

    // 4. Delete captures
    if (wsIds.length > 0) {
      await tx.delete(captures).where(inArray(captures.workspaceId, wsIds));
    }

    // 5. Delete canons
    if (wsIds.length > 0) {
      await tx.delete(canons).where(inArray(canons.workspaceId, wsIds));
    }

    // 6. Delete digests
    if (wsIds.length > 0) {
      await tx.delete(digests).where(inArray(digests.workspaceId, wsIds));
    }

    // 7. Delete usage logs (by user or workspace)
    if (userIds.length > 0) {
      await tx.delete(usageLogs).where(inArray(usageLogs.userId, userIds));
    }

    // 8. Delete platform events (by org, user, or workspace)
    await tx.delete(platformEvents).where(eq(platformEvents.organizationId, orgId));
    if (userIds.length > 0) {
      await tx.delete(platformEvents).where(inArray(platformEvents.userId, userIds));
    }
    if (wsIds.length > 0) {
      await tx.delete(platformEvents).where(inArray(platformEvents.workspaceId, wsIds));
    }

    // 9. Delete memberships
    if (wsIds.length > 0) {
      await tx.delete(memberships).where(inArray(memberships.workspaceId, wsIds));
    }

    // 10. Delete token tables for org users (cascade would handle this, but explicit is safer)
    if (userIds.length > 0) {
      await tx.delete(passwordResetTokens).where(inArray(passwordResetTokens.userId, userIds));
      await tx.delete(emailVerificationTokens).where(inArray(emailVerificationTokens.userId, userIds));
    }

    // 11. Delete workspaces
    if (wsIds.length > 0) {
      await tx.delete(workspaces).where(inArray(workspaces.id, wsIds));
    }

    // 12. Handle protocols: null parent refs, then delete org/workspace-owned protocols
    // Collect protocol IDs owned by this org or its workspaces
    const ownedProtocolIds: string[] = [];

    const orgProtocols = await tx
      .select({ id: protocols.id })
      .from(protocols)
      .where(and(eq(protocols.ownerType, "organization"), eq(protocols.ownerId, orgId)));
    ownedProtocolIds.push(...orgProtocols.map((p) => p.id));

    if (wsIds.length > 0) {
      const wsProtocols = await tx
        .select({ id: protocols.id })
        .from(protocols)
        .where(and(eq(protocols.ownerType, "workspace"), inArray(protocols.ownerId, wsIds)));
      ownedProtocolIds.push(...wsProtocols.map((p) => p.id));
    }

    // Null parent references that point to protocols we're about to delete
    if (ownedProtocolIds.length > 0) {
      await tx
        .update(protocols)
        .set({ parentId: null })
        .where(inArray(protocols.parentId, ownedProtocolIds));

      // Delete the owned protocols
      await tx.delete(protocols).where(inArray(protocols.id, ownedProtocolIds));
    }

    // 13. Null created_by on protocols created by org users
    if (userIds.length > 0) {
      await tx
        .update(protocols)
        .set({ createdBy: null })
        .where(inArray(protocols.createdBy, userIds));
    }

    // 14. Delete users
    if (userIds.length > 0) {
      await tx.delete(users).where(inArray(users.id, userIds));
    }

    // 15. Delete the organization
    await tx.delete(organizations).where(eq(organizations.id, orgId));
  });

  return NextResponse.json({
    success: true,
    action: "deleted",
    org: org.name,
    deleted,
  });
}
