import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, desc } from "drizzle-orm";
import { actions, users, canons, workspaces } from "@/lib/db/schema";
import { ActionsClient } from "./actions-client";

const sqlFn = neon(process.env.DATABASE_URL!);
const db = drizzle(sqlFn);

export default async function ActionsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const { workspaceId } = await params;

  const [workspace] = await db
    .select({ id: workspaces.id, name: workspaces.name })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!workspace) redirect("/dashboard");

  const allActions = await db
    .select({
      id: actions.id,
      title: actions.title,
      description: actions.description,
      status: actions.status,
      priority: actions.priority,
      goalId: actions.goalId,
      goalAlignmentScore: actions.goalAlignmentScore,
      coachAttribution: actions.coachAttribution,
      userId: actions.userId,
      createdAt: actions.createdAt,
      updatedAt: actions.updatedAt,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
    })
    .from(actions)
    .innerJoin(users, eq(actions.userId, users.id))
    .where(eq(actions.workspaceId, workspaceId))
    .orderBy(desc(actions.createdAt))
    .limit(200);

  // Get goals for goal-linkage display
  const allGoals = await db
    .select({ id: canons.id, content: canons.content })
    .from(canons)
    .where(eq(canons.workspaceId, workspaceId))
    .orderBy(desc(canons.createdAt));

  return (
    <ActionsClient
      workspaceId={workspaceId}
      actions={allActions.map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        status: a.status,
        priority: a.priority,
        goalId: a.goalId,
        goalAlignmentScore: a.goalAlignmentScore,
        coachAttribution: a.coachAttribution,
        userName:
          [a.firstName, a.lastName].filter(Boolean).join(" ") || a.email,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      }))}
      goals={allGoals.map((g) => ({
        id: g.id,
        content: g.content.slice(0, 120) + (g.content.length > 120 ? "..." : ""),
      }))}
    />
  );
}
