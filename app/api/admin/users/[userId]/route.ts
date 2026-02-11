import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  users,
  memberships,
  captures,
  artifacts,
  actions,
  usageLogs,
  platformEvents,
  protocols,
} from "@/lib/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { requireSuperAdminAPI } from "@/lib/auth/require-super-admin";

// PATCH /api/admin/users/[userId] -- update user fields
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await requireSuperAdminAPI();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;
  const body = await request.json();

  // Validate allowed fields
  const allowedFields: Record<string, unknown> = {};

  if (typeof body.firstName === "string") {
    allowedFields.firstName = body.firstName.trim() || null;
  }
  if (typeof body.lastName === "string") {
    allowedFields.lastName = body.lastName.trim() || null;
  }
  if (
    typeof body.tier === "string" &&
    ["trial", "active", "suspended"].includes(body.tier)
  ) {
    allowedFields.tier = body.tier;
  }
  if (typeof body.isSuperAdmin === "boolean") {
    // Prevent removing your own super admin status
    if (userId === session.user.id && !body.isSuperAdmin) {
      return NextResponse.json(
        { error: "Cannot remove your own super admin status" },
        { status: 400 }
      );
    }
    allowedFields.isSuperAdmin = body.isSuperAdmin;
  }

  if (Object.keys(allowedFields).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  // Check user exists
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId));

  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Apply update
  await db
    .update(users)
    .set({ ...allowedFields, updatedAt: new Date() })
    .where(eq(users.id, userId));

  return NextResponse.json({ success: true });
}

// DELETE /api/admin/users/[userId]
// ?action=suspend (default) -- sets tier to "suspended"
// ?action=delete -- hard delete with full cascade
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await requireSuperAdminAPI();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") || "suspend";

  // Prevent self-deletion
  if (userId === session.user.id) {
    return NextResponse.json(
      { error: "Cannot delete yourself" },
      { status: 400 }
    );
  }

  // Check user exists
  const [existing] = await db
    .select({ id: users.id, email: users.email, tier: users.tier })
    .from(users)
    .where(eq(users.id, userId));

  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (action === "delete") {
    // Hard delete: cascade through all referencing tables
    // 1. Get all capture IDs for this user (needed for artifacts + actions)
    const userCaptures = await db
      .select({ id: captures.id })
      .from(captures)
      .where(eq(captures.userId, userId));
    const captureIds = userCaptures.map((c) => c.id);

    // 2. Delete artifacts and actions that reference user's captures
    if (captureIds.length > 0) {
      await db
        .delete(actions)
        .where(inArray(actions.artifactId, 
          db.select({ id: artifacts.id }).from(artifacts).where(inArray(artifacts.captureId, captureIds))
        ));
      await db.delete(artifacts).where(inArray(artifacts.captureId, captureIds));
    }

    // 3. Delete actions created by this user (not linked to artifacts)
    await db.delete(actions).where(eq(actions.userId, userId));

    // 4. Delete captures, usage logs, platform events, memberships
    await db.delete(captures).where(eq(captures.userId, userId));
    await db.delete(usageLogs).where(eq(usageLogs.userId, userId));
    await db.delete(platformEvents).where(eq(platformEvents.userId, userId));
    await db.delete(memberships).where(eq(memberships.userId, userId));

    // 5. Nullify protocol ownership
    await db
      .update(protocols)
      .set({ createdBy: null })
      .where(eq(protocols.createdBy, userId));

    // 6. Delete the user
    await db.delete(users).where(eq(users.id, userId));

    return NextResponse.json({
      success: true,
      action: "deleted",
      email: existing.email,
    });
  }

  // Default: suspend
  if (existing.tier === "suspended") {
    return NextResponse.json(
      { error: "User is already suspended" },
      { status: 400 }
    );
  }

  await db
    .update(users)
    .set({ tier: "suspended", updatedAt: new Date() })
    .where(eq(users.id, userId));

  return NextResponse.json({ success: true, action: "suspended" });
}
