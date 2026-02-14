import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { protocols } from "@/lib/db/schema";
import { eq, or } from "drizzle-orm";
import { getWorkspaceMembership } from "@/lib/auth/workspace-access";
import { CoachesListClient } from "./coaches-list-client";

export default async function CoachesPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const { workspaceId } = await params;

  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) redirect("/dashboard");

  const allCoaches = await db
    .select({
      id: protocols.id,
      name: protocols.name,
      description: protocols.description,
      category: protocols.category,
      ownerType: protocols.ownerType,
      ownerId: protocols.ownerId,
      createdBy: protocols.createdBy,
      isPublic: protocols.isPublic,
      parentId: protocols.parentId,
      version: protocols.version,
      systemPrompt: protocols.systemPrompt,
    })
    .from(protocols)
    .where(
      or(
        eq(protocols.ownerType, "system"),
        eq(protocols.ownerId, workspaceId),
        eq(protocols.ownerId, session.user.id)
      )
    );

  return (
    <CoachesListClient
      workspaceId={workspaceId}
      currentUserId={session.user.id}
      coaches={allCoaches}
    />
  );
}
