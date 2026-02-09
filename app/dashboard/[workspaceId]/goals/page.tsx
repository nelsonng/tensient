import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, desc } from "drizzle-orm";
import { canons, workspaces } from "@/lib/db/schema";
import Link from "next/link";
import { PanelCard } from "@/components/panel-card";
import { MonoLabel } from "@/components/mono-label";
import { SlantedButton } from "@/components/slanted-button";

const sqlFn = neon(process.env.DATABASE_URL!);
const db = drizzle(sqlFn);

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function GoalsPage({
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

  const allCanons = await db
    .select({
      id: canons.id,
      content: canons.content,
      rawInput: canons.rawInput,
      createdAt: canons.createdAt,
    })
    .from(canons)
    .where(eq(canons.workspaceId, workspaceId))
    .orderBy(desc(canons.createdAt));

  return (
    <div className="mx-auto max-w-[1000px] px-6 pt-8 pb-24">
      <Link
        href={`/dashboard/${workspaceId}`}
        className="font-mono text-xs text-muted hover:text-primary mb-6 block"
      >
        &larr; BACK TO HOME
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <MonoLabel className="mb-2 block text-primary">GOALS</MonoLabel>
          <h1 className="font-display text-2xl font-bold uppercase tracking-tight">
            Team Goals
          </h1>
          <p className="font-body text-base text-muted mt-2">
            Your strategic direction. Each version captures a moment in time.
          </p>
        </div>
        <SlantedButton href={`/dashboard/${workspaceId}/strategy`}>
          + SET GOALS
        </SlantedButton>
      </div>

      {allCanons.length === 0 ? (
        <PanelCard className="text-center py-12">
          <p className="font-body text-base text-muted mb-4">
            No goals set yet. Set your first goals to define your team&apos;s direction.
          </p>
          <SlantedButton href={`/dashboard/${workspaceId}/strategy`}>
            SET GOALS
          </SlantedButton>
        </PanelCard>
      ) : (
        <div className="space-y-4">
          {allCanons.map((canon, i) => (
            <PanelCard key={canon.id}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <MonoLabel className={i === 0 ? "text-primary" : "text-muted"}>
                    {i === 0 ? "CURRENT" : `V${allCanons.length - i}`}
                  </MonoLabel>
                  <span className="font-mono text-xs text-muted">
                    {timeAgo(canon.createdAt)}
                  </span>
                </div>
              </div>
              <p className="font-body text-base leading-relaxed text-foreground whitespace-pre-wrap">
                {canon.content}
              </p>
              {canon.rawInput && (
                <details className="mt-4">
                  <summary className="font-mono text-xs text-muted cursor-pointer hover:text-foreground transition-colors">
                    SHOW RAW INPUT
                  </summary>
                  <p className="font-body text-sm text-muted mt-2 leading-relaxed whitespace-pre-wrap border-l-2 border-border pl-4">
                    {canon.rawInput}
                  </p>
                </details>
              )}
            </PanelCard>
          ))}
        </div>
      )}
    </div>
  );
}
