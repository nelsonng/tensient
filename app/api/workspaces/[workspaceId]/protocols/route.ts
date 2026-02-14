import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { protocols } from "@/lib/db/schema";
import { eq, or } from "drizzle-orm";
import { getWorkspaceMembership } from "@/lib/auth/workspace-access";

type Params = { params: Promise<{ workspaceId: string }> };

// GET /api/workspaces/[id]/protocols -- List all available coaches
export async function GET(_request: Request, { params }: Params) {
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
    .from(protocols)
    .where(
      or(
        eq(protocols.ownerType, "system"),
        eq(protocols.ownerId, workspaceId),
        eq(protocols.ownerId, session.user.id)
      )
    );

  return NextResponse.json(rows);
}

// POST /api/workspaces/[id]/protocols -- Create custom coach (or fork a system coach)
export async function POST(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await params;
  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { name, description, systemPrompt, category, parentId } = body;

  if (!name || !systemPrompt) {
    return NextResponse.json(
      { error: "Name and system prompt are required" },
      { status: 400 }
    );
  }

  const [coach] = await db
    .insert(protocols)
    .values({
      name,
      description: description || null,
      systemPrompt,
      category: category || null,
      ownerType: "user",
      ownerId: session.user.id,
      createdBy: session.user.id,
      isPublic: false,
      parentId: parentId || null,
      version: 1,
    })
    .returning();

  return NextResponse.json(coach, { status: 201 });
}
