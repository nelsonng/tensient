import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  synthesisCommits,
  synthesisCommitSignals,
} from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { getWorkspaceMembership } from "@/lib/auth/workspace-access";

type Params = { params: Promise<{ workspaceId: string }> };

// GET /api/workspaces/[workspaceId]/synthesis/commits
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
    .select({
      id: synthesisCommits.id,
      workspaceId: synthesisCommits.workspaceId,
      parentId: synthesisCommits.parentId,
      summary: synthesisCommits.summary,
      trigger: synthesisCommits.trigger,
      signalCount: synthesisCommits.signalCount,
      createdAt: synthesisCommits.createdAt,
      linkedSignals: sql<number>`count(${synthesisCommitSignals.id})`,
    })
    .from(synthesisCommits)
    .leftJoin(
      synthesisCommitSignals,
      eq(synthesisCommitSignals.commitId, synthesisCommits.id)
    )
    .where(eq(synthesisCommits.workspaceId, workspaceId))
    .groupBy(synthesisCommits.id)
    .orderBy(desc(synthesisCommits.createdAt));

  return NextResponse.json(rows);
}
