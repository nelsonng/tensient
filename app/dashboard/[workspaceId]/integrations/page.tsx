import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getWorkspaceMembership } from "@/lib/auth/workspace-access";
import { apiKeys, platformEvents } from "@/lib/db/schema";
import { MonoLabel } from "@/components/mono-label";

export default async function IntegrationsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const { workspaceId } = await params;
  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) redirect("/dashboard");

  const keys = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      lastUsedAt: apiKeys.lastUsedAt,
      revokedAt: apiKeys.revokedAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.workspaceId, workspaceId))
    .orderBy(desc(apiKeys.createdAt));

  const events = await db
    .select({
      id: platformEvents.id,
      type: platformEvents.type,
      metadata: platformEvents.metadata,
      createdAt: platformEvents.createdAt,
    })
    .from(platformEvents)
    .where(
      and(
        eq(platformEvents.workspaceId, workspaceId),
        inArray(platformEvents.type, [
          "mcp_connection",
          "mcp_tool_called",
          "mcp_auth_failed",
          "api_key_created",
          "api_key_revoked",
        ])
      )
    )
    .orderBy(desc(platformEvents.createdAt))
    .limit(100);

  const activeKeys = keys.filter((key) => key.revokedAt === null).length;
  const [toolCallsTodayRow] = await db
    .select({ count: count() })
    .from(platformEvents)
    .where(
      and(
        eq(platformEvents.workspaceId, workspaceId),
        eq(platformEvents.type, "mcp_tool_called"),
        sql`${platformEvents.createdAt} > NOW() - INTERVAL '24 hours'`
      )
    );
  const toolCallsToday = toolCallsTodayRow.count;

  return (
    <div className="mx-auto max-w-[1000px] px-6 pb-24">
      <div className="mb-8">
        <MonoLabel className="mb-2 block text-primary">INTEGRATIONS</MonoLabel>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Agent Activity
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Metric label="Active API Keys" value={String(activeKeys)} />
        <Metric label="MCP Events (last 100)" value={String(events.length)} />
        <Metric label="Tool Calls (24h)" value={String(toolCallsToday)} />
      </div>

      <section className="rounded-lg border border-border bg-panel p-4 mb-6">
        <MonoLabel className="text-primary mb-3 block">CONNECTED AGENTS</MonoLabel>
        {keys.length === 0 ? (
          <p className="font-mono text-sm text-muted">No API keys for this workspace yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {keys.map((key) => (
              <div key={key.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-body text-sm text-foreground">{key.name}</p>
                  <p className="font-mono text-xs text-muted mt-1">
                    {key.keyPrefix}... · last seen{" "}
                    {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : "never"}
                  </p>
                </div>
                <span
                  className={`font-mono text-[10px] uppercase ${
                    key.revokedAt ? "text-destructive" : "text-primary"
                  }`}
                >
                  {key.revokedAt ? "Revoked" : "Active"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-panel p-4">
        <MonoLabel className="text-primary mb-3 block">ACTIVITY FEED</MonoLabel>
        {events.length === 0 ? (
          <p className="font-mono text-sm text-muted">No MCP activity yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {events.map((event) => (
              <div key={event.id} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-xs text-foreground uppercase tracking-wide">
                    {event.type.replaceAll("_", " ")}
                  </p>
                  <p className="font-mono text-[10px] text-muted">
                    {event.createdAt.toLocaleString()}
                  </p>
                </div>
                {event.metadata != null ? (
                  <pre className="mt-2 overflow-x-auto font-mono text-[10px] text-muted">
                    {JSON.stringify(event.metadata, null, 2)}
                  </pre>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-panel p-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted mb-2">
        {label}
      </p>
      <p className="font-display text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}
