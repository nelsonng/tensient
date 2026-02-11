import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { artifacts, captures, users, workspaces } from "@/lib/db/schema";
import { getWorkspaceMembership } from "@/lib/auth/workspace-access";
import { PanelCard } from "@/components/panel-card";
import { MonoLabel } from "@/components/mono-label";

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getAlignmentColor(score: number): string {
  if (score >= 0.8) return "text-primary";
  if (score >= 0.5) return "text-warning";
  return "text-destructive";
}

export default async function SynthesisPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const { workspaceId } = await params;

  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) redirect("/dashboard");

  const [workspace] = await db
    .select({ id: workspaces.id, name: workspaces.name })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!workspace) redirect("/dashboard");

  const allArtifacts = await db
    .select({
      id: artifacts.id,
      content: artifacts.content,
      driftScore: artifacts.driftScore,
      sentimentScore: artifacts.sentimentScore,
      feedback: artifacts.feedback,
      createdAt: artifacts.createdAt,
      userId: captures.userId,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
    })
    .from(artifacts)
    .innerJoin(captures, eq(artifacts.captureId, captures.id))
    .innerJoin(users, eq(captures.userId, users.id))
    .where(eq(captures.workspaceId, workspaceId))
    .orderBy(desc(artifacts.createdAt))
    .limit(50);

  return (
    <div className="mx-auto max-w-[1000px] px-6 pb-24">
      <div className="mb-8">
        <MonoLabel className="mb-2 block text-primary">SYNTHESIS</MonoLabel>
        <h1 className="font-display text-2xl font-bold uppercase tracking-tight">
          All Synthesis
        </h1>
        <p className="font-body text-base text-muted mt-2">
          AI-processed outputs from every thought. Alignment scored, coaching delivered.
        </p>
      </div>

      <div className="font-mono text-xs text-muted mb-6">
        {allArtifacts.length} SYNTHES{allArtifacts.length !== 1 ? "ES" : "IS"}
      </div>

      {allArtifacts.length === 0 ? (
        <PanelCard className="text-center py-12">
          <p className="font-body text-base text-muted">
            No synthesis yet. Share a thought and the AI will do the rest.
          </p>
        </PanelCard>
      ) : (
        <div className="space-y-4">
          {allArtifacts.map((artifact) => {
            const name = [artifact.firstName, artifact.lastName]
              .filter(Boolean)
              .join(" ") || artifact.email;
            const alignmentScore = 1 - (artifact.driftScore ?? 0);

            return (
              <PanelCard key={artifact.id}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-body text-sm font-medium text-foreground">
                      {name}
                    </span>
                    <span className="font-mono text-xs text-muted">
                      {timeAgo(artifact.createdAt)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span
                      className={`font-mono text-xl font-bold ${getAlignmentColor(alignmentScore)}`}
                    >
                      {Math.round(alignmentScore * 100)}%
                    </span>
                    <MonoLabel className="block text-xs">ALIGNMENT</MonoLabel>
                  </div>
                </div>

                {/* Synthesized content */}
                <p className="font-body text-base leading-relaxed text-foreground mb-3">
                  {artifact.content}
                </p>

                {/* Coaching feedback */}
                {artifact.feedback && (
                  <div className="border-t border-border pt-3 mt-3">
                    <MonoLabel className="mb-1 block text-xs text-muted">COACHING</MonoLabel>
                    <p className="font-body text-sm text-muted leading-relaxed">
                      {artifact.feedback}
                    </p>
                  </div>
                )}
              </PanelCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
