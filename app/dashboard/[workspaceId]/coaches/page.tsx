import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { protocols, workspaces } from "@/lib/db/schema";
import Link from "next/link";
import { PanelCard } from "@/components/panel-card";
import { MonoLabel } from "@/components/mono-label";

const sqlFn = neon(process.env.DATABASE_URL!);
const db = drizzle(sqlFn);

export default async function CoachesPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const { workspaceId } = await params;

  const [workspace] = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      activeProtocolId: workspaces.activeProtocolId,
    })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!workspace) redirect("/dashboard");

  // Get all available protocols (system + workspace)
  const allProtocols = await db
    .select({
      id: protocols.id,
      name: protocols.name,
      description: protocols.description,
      category: protocols.category,
      ownerType: protocols.ownerType,
      isPublic: protocols.isPublic,
      usageCount: protocols.usageCount,
      version: protocols.version,
    })
    .from(protocols)
    .where(eq(protocols.isPublic, true));

  return (
    <div className="mx-auto max-w-[1000px] px-6 pt-8 pb-24">
      <Link
        href={`/dashboard/${workspaceId}`}
        className="font-mono text-xs text-muted hover:text-primary mb-6 block"
      >
        &larr; BACK TO HOME
      </Link>

      <div className="mb-8">
        <MonoLabel className="mb-2 block text-primary">COACHES</MonoLabel>
        <h1 className="font-display text-2xl font-bold uppercase tracking-tight">
          Coaching Styles
        </h1>
        <p className="font-body text-base text-muted mt-2">
          Coaches determine how your thoughts are analyzed. Different coaches produce
          different synthesis styles, coaching tones, and scoring priorities.
        </p>
      </div>

      <div className="font-mono text-xs text-muted mb-6">
        {allProtocols.length} COACH{allProtocols.length !== 1 ? "ES" : ""}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {allProtocols.map((protocol) => {
          const isActive = workspace.activeProtocolId === protocol.id;
          return (
            <PanelCard
              key={protocol.id}
              className={isActive ? "border-primary/50" : ""}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-display text-base font-bold uppercase text-foreground">
                  {protocol.name}
                </span>
                {isActive && (
                  <span className="font-mono text-xs text-primary border border-primary/30 rounded px-2 py-0.5">
                    ACTIVE
                  </span>
                )}
              </div>

              {protocol.description && (
                <p className="font-body text-sm text-muted leading-relaxed mb-3">
                  {protocol.description}
                </p>
              )}

              <div className="flex items-center gap-4">
                {protocol.category && (
                  <span className="font-mono text-xs text-muted">
                    {protocol.category.toUpperCase()}
                  </span>
                )}
                <span className="font-mono text-xs text-muted">
                  V{protocol.version}
                </span>
                <span className="font-mono text-xs text-muted">
                  {protocol.usageCount} USES
                </span>
              </div>
            </PanelCard>
          );
        })}
      </div>
    </div>
  );
}
