import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
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

// DELETE /api/admin/users/[userId] -- suspend user (soft delete)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await requireSuperAdminAPI();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;

  // Prevent self-suspension
  if (userId === session.user.id) {
    return NextResponse.json(
      { error: "Cannot suspend yourself" },
      { status: 400 }
    );
  }

  // Check user exists
  const [existing] = await db
    .select({ id: users.id, tier: users.tier })
    .from(users)
    .where(eq(users.id, userId));

  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (existing.tier === "suspended") {
    return NextResponse.json(
      { error: "User is already suspended" },
      { status: 400 }
    );
  }

  // Set tier to suspended
  await db
    .update(users)
    .set({ tier: "suspended", updatedAt: new Date() })
    .where(eq(users.id, userId));

  return NextResponse.json({ success: true, action: "suspended" });
}
