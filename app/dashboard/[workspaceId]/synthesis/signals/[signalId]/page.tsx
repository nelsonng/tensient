import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { conversations, memberships, signals } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export default async function SignalDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string; signalId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const { workspaceId, signalId } = await params;

  const [membership] = await db
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, session.user.id),
        eq(memberships.workspaceId, workspaceId)
      )
    )
    .limit(1);

  if (!membership) redirect("/sign-in");

  const [signal] = await db
    .select({
      id: signals.id,
      content: signals.content,
      aiPriority: signals.aiPriority,
      humanPriority: signals.humanPriority,
      reviewedAt: signals.reviewedAt,
      source: signals.source,
      createdAt: signals.createdAt,
      conversationId: signals.conversationId,
      conversationTitle: conversations.title,
    })
    .from(signals)
    .innerJoin(conversations, eq(conversations.id, signals.conversationId))
    .where(and(eq(signals.id, signalId), eq(signals.workspaceId, workspaceId)))
    .limit(1);

  if (!signal) {
    redirect(`/dashboard/${workspaceId}/synthesis/signals`);
  }

  return (
    <div className="mx-auto max-w-[900px] px-6">
      <div className="mb-6">
        <Link
          href={`/dashboard/${workspaceId}/synthesis/signals`}
          className="font-mono text-xs uppercase tracking-wider text-muted hover:text-foreground"
        >
          ← Back to Signals
        </Link>
      </div>

      <div className="rounded-lg border border-border bg-panel p-6">
        <h1 className="font-display text-xl font-bold tracking-tight text-foreground">
          Signal
        </h1>
        <p className="mt-1 font-mono text-xs text-muted">
          Created{" "}
          {signal.createdAt.toLocaleString([], {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>

        <p className="mt-5 whitespace-pre-wrap text-sm text-foreground">{signal.content}</p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
              Source
            </p>
            <p className="mt-1 font-mono text-xs text-primary">
              {signal.source.toUpperCase()}
            </p>
            <Link
              href={`/dashboard/${workspaceId}/conversations/${signal.conversationId}`}
              className="mt-1 block text-sm text-primary hover:text-primary/80"
            >
              {signal.conversationTitle || "Untitled conversation"}
            </Link>
          </div>

          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted">AI</p>
            <p className="mt-1 font-mono text-sm text-warning">
              {signal.aiPriority ? signal.aiPriority.toUpperCase() : "--"}
            </p>
          </div>

          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted">You</p>
            <p className="mt-1 font-mono text-sm text-primary">
              {signal.humanPriority ? signal.humanPriority.toUpperCase() : "--"}
            </p>
          </div>

          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
              Reviewed
            </p>
            <p className="mt-1 font-mono text-sm text-muted">
              {signal.reviewedAt ? signal.reviewedAt.toLocaleString() : "Not reviewed"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
