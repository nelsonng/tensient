import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { protocols } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getWorkspaceMembership } from "@/lib/auth/workspace-access";
import { CoachEditorClient } from "./coach-editor-client";

export default async function CoachEditorPage({
  params,
}: {
  params: Promise<{ workspaceId: string; coachId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const { workspaceId, coachId } = await params;

  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) redirect("/dashboard");

  const [coach] = await db
    .select()
    .from(protocols)
    .where(eq(protocols.id, coachId))
    .limit(1);

  if (!coach) redirect(`/dashboard/${workspaceId}/coaches`);

  const isEditable = coach.createdBy === session.user.id;

  return (
    <CoachEditorClient
      workspaceId={workspaceId}
      coach={{
        id: coach.id,
        name: coach.name,
        description: coach.description,
        systemPrompt: coach.systemPrompt,
        category: coach.category,
        ownerType: coach.ownerType,
        parentId: coach.parentId,
      }}
      isEditable={isEditable}
    />
  );
}
