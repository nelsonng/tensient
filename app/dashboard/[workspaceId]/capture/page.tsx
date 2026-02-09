import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { workspaces, protocols } from "@/lib/db/schema";
import { CaptureClient } from "./capture-client";

const DEFAULT_PLACEHOLDER =
  "Unload. What's on your mind? What's blocking you? What did you ship?";

const sqlFn = neon(process.env.DATABASE_URL!);
const db = drizzle(sqlFn);

export default async function CapturePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const { workspaceId } = await params;

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
