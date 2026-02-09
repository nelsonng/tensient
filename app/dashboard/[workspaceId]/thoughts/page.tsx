import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, desc } from "drizzle-orm";
import { captures, users, workspaces } from "@/lib/db/schema";
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

function sourceLabel(source: string): string {
  if (source === "voice") return "VOICE";
  if (source === "slack") return "SLACK";
  return "WEB";
}

export default async function ThoughtsPage({
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

  const allCaptures = await db
    .select({
      id: captures.id,
      content: captures.content,
      source: captures.source,
      audioUrl: captures.audioUrl,
      processedAt: captures.processedAt,
      createdAt: captures.createdAt,
      userId: captures.userId,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
    })
    .from(captures)
    .innerJoin(users, eq(captures.userId, users.id))
    .where(eq(captures.workspaceId, workspaceId))
    .orderBy(desc(captures.createdAt))
    .limit(50);

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
          <MonoLabel className="mb-2 block text-primary">THOUGHTS</MonoLabel>
          <h1 className="font-display text-2xl font-bold uppercase tracking-tight">
            All Thoughts
          </h1>
          <p className="font-body text-base text-muted mt-2">
            Raw, unfiltered inputs from your team. Every thought is preserved.
          </p>
        </div>
        <SlantedButton href={`/dashboard/${workspaceId}/capture`}>
          + THOUGHT
        </SlantedButton>
      </div>

      <div className="font-mono text-xs text-muted mb-6">
        {allCaptures.length} THOUGHT{allCaptures.length !== 1 ? "S" : ""}
      </div>

      {allCaptures.length === 0 ? (
        <PanelCard className="text-center py-12">
          <p className="font-body text-base text-muted mb-4">
            No thoughts yet. Share what&apos;s on your mind.
          </p>
          <SlantedButton href={`/dashboard/${workspaceId}/capture`}>
            + THOUGHT
          </SlantedButton>
        </PanelCard>
      ) : (
        <div className="space-y-3">
          {allCaptures.map((capture) => {
            const name = [capture.firstName, capture.lastName]
              .filter(Boolean)
              .join(" ") || capture.email;
            return (
              <PanelCard key={capture.id} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="font-body text-sm font-medium text-foreground">
                      {name}
                    </span>
                    <span className="font-mono text-xs text-muted">
                      {timeAgo(capture.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted">
                      {sourceLabel(capture.source)}
                    </span>
                    {capture.processedAt && (
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" title="Processed" />
                    )}
                  </div>
                </div>
                <p className="font-body text-base text-foreground leading-relaxed line-clamp-4">
                  {capture.content}
                </p>
              </PanelCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
