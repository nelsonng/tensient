import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, workspaces, memberships } from "@/lib/db/schema";
import { getWorkspaceMembership } from "@/lib/auth/workspace-access";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const { workspaceId } = await params;
  const { tab } = await searchParams;

  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) redirect("/dashboard");

  // Fetch current user
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      emailVerified: users.emailVerified,
      firstName: users.firstName,
      lastName: users.lastName,
      tier: users.tier,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user) redirect("/sign-in");

  // Fetch workspace
  const [workspace] = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      joinCode: workspaces.joinCode,
    })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!workspace) redirect("/dashboard");

  // Fetch members with user info
  const members = await db
    .select({
      membershipId: memberships.id,
      userId: memberships.userId,
      role: memberships.role,
      tractionScore: memberships.tractionScore,
      joinedAt: memberships.createdAt,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(eq(memberships.workspaceId, workspaceId));

  return (
    <SettingsClient
      workspaceId={workspaceId}
      initialTab={tab || "profile"}
      user={{
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified?.toISOString() ?? null,
        firstName: user.firstName,
        lastName: user.lastName,
        tier: user.tier,
        createdAt: user.createdAt.toISOString(),
      }}
      workspace={{
        id: workspace.id,
        name: workspace.name,
        joinCode: workspace.joinCode,
      }}
      members={members.map((m) => ({
        membershipId: m.membershipId,
        userId: m.userId,
        role: m.role,
        tractionScore: m.tractionScore,
        joinedAt: m.joinedAt.toISOString(),
        email: m.email,
        firstName: m.firstName,
        lastName: m.lastName,
      }))}
      currentUserRole={membership.role}
    />
  );
}
