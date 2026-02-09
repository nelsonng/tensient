import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { actions } from "@/lib/db/schema";

const sqlFn = neon(process.env.DATABASE_URL!);
const db = drizzle(sqlFn);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await params;
  const { title, description, priority, goalId } = await request.json();

  if (!title || title.trim().length < 2) {
    return NextResponse.json(
      { error: "Action title must be at least 2 characters" },
      { status: 400 }
    );
  }

  const [action] = await db
    .insert(actions)
    .values({
      workspaceId,
      userId: session.user.id,
      title: title.trim(),
      description: description?.trim() || null,
      priority: priority || "medium",
      goalId: goalId || null,
      status: "open",
    })
    .returning();

  return NextResponse.json(action);
}
