import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { conversations } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { getWorkspaceMembership } from "@/lib/auth/workspace-access";

// GET /api/workspaces/[id]/conversations -- List conversations
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await params;
  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.workspaceId, workspaceId),
        eq(conversations.userId, session.user.id)
      )
    )
    .orderBy(desc(conversations.updatedAt));

  return NextResponse.json(rows);
}

// POST /api/workspaces/[id]/conversations -- Create conversation
export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await params;
  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const title = body.title || null; // AI will generate later if null

  const [conversation] = await db
    .insert(conversations)
    .values({
      workspaceId,
      userId: session.user.id,
      title,
    })
    .returning();

  return NextResponse.json(conversation, { status: 201 });
}
