import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  users,
  memberships,
  conversations,
  messages,
  brainDocuments,
  usageLogs,
  platformEvents,
  protocols,
  passwordResetTokens,
  emailVerificationTokens,
} from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { requireSuperAdminAPI } from "@/lib/auth/require-super-admin";
import { withErrorTracking } from "@/lib/api-handler";

// PATCH /api/admin/users/[userId] -- update user fields
async function patchHandler(
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
async function deleteHandler(
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
    // 1. Get all conversation IDs for this user (needed for messages)
    const userConvos = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.userId, userId));
    const convoIds = userConvos.map((c) => c.id);

    // 2. Delete messages that belong to user's conversations
    if (convoIds.length > 0) {
      await db.delete(messages).where(inArray(messages.conversationId, convoIds));
    }

    // 3. Delete conversations, brain documents, usage logs, platform events, memberships
    await db.delete(conversations).where(eq(conversations.userId, userId));
    await db.delete(brainDocuments).where(eq(brainDocuments.userId, userId));
    await db.delete(usageLogs).where(eq(usageLogs.userId, userId));
    await db.delete(platformEvents).where(eq(platformEvents.userId, userId));
    await db.delete(memberships).where(eq(memberships.userId, userId));

    // 4. Delete token tables (cascade would handle, but explicit is safer)
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
    await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, userId));

    // 5. Handle protocols: nullify created_by + delete user-owned protocols
    await db
      .update(protocols)
      .set({ createdBy: null })
      .where(eq(protocols.createdBy, userId));
    await db
      .delete(protocols)
      .where(and(eq(protocols.ownerType, "user"), eq(protocols.ownerId, userId)));

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

export const PATCH = withErrorTracking("Update user account", patchHandler);
export const DELETE = withErrorTracking("Suspend or delete user account", deleteHandler);
