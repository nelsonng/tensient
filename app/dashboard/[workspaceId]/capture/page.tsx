import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { workspaces, protocols } from "@/lib/db/schema";
import { getWorkspaceMembership } from "@/lib/auth/workspace-access";
import { CaptureClient } from "./capture-client";

const DEFAULT_PLACEHOLDER =
  "What's on your mind? What's blocking you? What did you ship? Just ramble.";

export default async function CapturePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const { workspaceId } = await params;

  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) redirect("/dashboard");

  // Fetch workspace + active protocol for placeholder text
  let placeholder = DEFAULT_PLACEHOLDER;

  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (workspace?.activeProtocolId) {
    const [protocol] = await db
      .select()
      .from(protocols)
      .where(eq(protocols.id, workspace.activeProtocolId))
      .limit(1);

    const schemaDef = protocol?.schemaDef as { exampleInput?: string } | null;
    if (schemaDef?.exampleInput) {
      placeholder = schemaDef.exampleInput;
    }
  }

  return <CaptureClient workspaceId={workspaceId} placeholder={placeholder} />;
}
