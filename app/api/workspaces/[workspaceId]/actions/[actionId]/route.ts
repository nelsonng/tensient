import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, and } from "drizzle-orm";
import { actions } from "@/lib/db/schema";

const sqlFn = neon(process.env.DATABASE_URL!);
const db = drizzle(sqlFn);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; actionId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId, actionId } = await params;
  const body = await request.json();

  // Build update object from allowed fields
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.status !== undefined) updates.status = body.status;
  if (body.priority !== undefined) updates.priority = body.priority;
  if (body.goalId !== undefined) updates.goalId = body.goalId || null;
  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;

  const [updated] = await db
    .update(actions)
    .set(updates)
    .where(
      and(
        eq(actions.id, actionId),
        eq(actions.workspaceId, workspaceId)
      )
    )
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Action not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string; actionId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId, actionId } = await params;

  const [deleted] = await db
    .delete(actions)
    .where(
      and(
        eq(actions.id, actionId),
        eq(actions.workspaceId, workspaceId)
      )
    )
    .returning({ id: actions.id });

  if (!deleted) {
    return NextResponse.json({ error: "Action not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
