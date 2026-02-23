import { db } from "@/lib/db";
import { platformEvents, users } from "@/lib/db/schema";
import { desc, eq, sql, and, gte, or } from "drizzle-orm";
import Link from "next/link";

const ERROR_TYPES = [
  "api_error",
  "client_error",
  "sign_up_failed",
  "sign_in_failed",
  "transcription_failed",
  "usage_blocked",
] as const;

async function getErrorEvents(filter: string, days: number) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const conditions = [gte(platformEvents.createdAt, cutoff)];

  if (filter === "errors_only") {
    conditions.push(
      or(
        eq(platformEvents.type, "api_error"),
        eq(platformEvents.type, "client_error"),
        eq(platformEvents.type, "sign_up_failed"),
        eq(platformEvents.type, "sign_in_failed"),
        eq(platformEvents.type, "transcription_failed"),
        eq(platformEvents.type, "usage_blocked"),
      )!
    );
  }

  const events = await db
    .select({
      id: platformEvents.id,
      type: platformEvents.type,
      userId: platformEvents.userId,
      workspaceId: platformEvents.workspaceId,
      metadata: platformEvents.metadata,
      createdAt: platformEvents.createdAt,
      userEmail: users.email,
    })
    .from(platformEvents)
    .leftJoin(users, eq(platformEvents.userId, users.id))
    .where(and(...conditions))
    .orderBy(desc(platformEvents.createdAt))
    .limit(200);

  return events;
}

async function getErrorCounts() {
  const cutoff24h = new Date();
  cutoff24h.setDate(cutoff24h.getDate() - 1);

  const cutoff7d = new Date();
  cutoff7d.setDate(cutoff7d.getDate() - 7);

  const [errors24h] = await db
    .select({ count: sql<number>`count(*)` })
    .from(platformEvents)
    .where(
      and(
        gte(platformEvents.createdAt, cutoff24h),
        or(
          eq(platformEvents.type, "api_error"),
          eq(platformEvents.type, "client_error"),
          eq(platformEvents.type, "transcription_failed"),
          eq(platformEvents.type, "usage_blocked"),
        )
      )
    );

  const [errors7d] = await db
    .select({ count: sql<number>`count(*)` })
    .from(platformEvents)
    .where(
      and(
        gte(platformEvents.createdAt, cutoff7d),
        or(
          eq(platformEvents.type, "api_error"),
          eq(platformEvents.type, "client_error"),
          eq(platformEvents.type, "transcription_failed"),
          eq(platformEvents.type, "usage_blocked"),
        )
      )
    );

  const [totalEvents] = await db
    .select({ count: sql<number>`count(*)` })
    .from(platformEvents);

  return {
    errors24h: Number(errors24h.count),
    errors7d: Number(errors7d.count),
    totalEvents: Number(totalEvents.count),
  };
}

function isErrorType(type: string): boolean {
  return (ERROR_TYPES as readonly string[]).includes(type);
}

function getEventColor(type: string): string {
  if (type === "api_error" || type === "client_error") return "text-destructive";
  if (type === "transcription_failed") return "text-destructive";
  if (type === "usage_blocked") return "text-destructive";
  if (type === "sign_up_failed" || type === "sign_in_failed") return "text-warning";
  if (type.includes("completed") || type.includes("success")) return "text-success";
  if (type.includes("started")) return "text-info";
  return "text-muted";
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default async function ErrorsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; days?: string }>;
}) {
  const { filter = "errors_only", days = "7" } = await searchParams;
  const daysNum = parseInt(days) || 7;

  const [events, counts] = await Promise.all([
    getErrorEvents(filter, daysNum),
    getErrorCounts(),
  ]);

  return (
    <div className="max-w-[1100px]">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-xl font-bold tracking-wider text-foreground">
          Error Log
        </h1>
        <p className="font-mono text-xs text-muted mt-1">
          Every error, every failure -- marinate in user pain
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-panel border border-border rounded-lg p-4">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">ERRORS (24H)</p>
          <p className={`font-display text-2xl font-bold ${counts.errors24h > 0 ? "text-destructive" : "text-success"}`}>
            {counts.errors24h}
          </p>
        </div>
        <div className="bg-panel border border-border rounded-lg p-4">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">ERRORS (7D)</p>
          <p className={`font-display text-2xl font-bold ${counts.errors7d > 0 ? "text-warning" : "text-success"}`}>
            {counts.errors7d}
          </p>
        </div>
        <div className="bg-panel border border-border rounded-lg p-4">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">TOTAL EVENTS</p>
          <p className="font-display text-2xl font-bold text-foreground">
            {counts.totalEvents}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        <Link
          href={`/admin/errors?filter=errors_only&days=${days}`}
          className={`px-3 py-1.5 rounded font-mono text-xs tracking-wider transition-colors ${
            filter === "errors_only"
              ? "bg-destructive/20 text-destructive border border-destructive/30"
              : "bg-panel border border-border text-muted hover:text-foreground"
          }`}
        >
          ERRORS ONLY
        </Link>
        <Link
          href={`/admin/errors?filter=all&days=${days}`}
          className={`px-3 py-1.5 rounded font-mono text-xs tracking-wider transition-colors ${
            filter === "all"
              ? "bg-primary/10 text-primary border border-primary/20"
              : "bg-panel border border-border text-muted hover:text-foreground"
          }`}
        >
          ALL EVENTS
        </Link>
        <span className="border-l border-border mx-2" />
        {["1", "7", "30"].map((d) => (
          <Link
            key={d}
            href={`/admin/errors?filter=${filter}&days=${d}`}
            className={`px-3 py-1.5 rounded font-mono text-xs tracking-wider transition-colors ${
              days === d
                ? "bg-white/10 text-foreground border border-border"
                : "bg-panel border border-border text-muted hover:text-foreground"
            }`}
          >
            {d}D
          </Link>
        ))}
      </div>

      {/* Event Feed */}
      <div className="space-y-2">
        {events.length === 0 && (
          <div className="bg-panel border border-border rounded-lg p-8 text-center">
            <p className="font-mono text-sm text-muted">
              {filter === "errors_only" ? "No errors in this time period" : "No events in this time period"}
            </p>
          </div>
        )}
        {events.map((event) => (
          <div
            key={event.id}
            className={`bg-panel border rounded-lg p-4 ${
              isErrorType(event.type)
                ? "border-destructive/30"
                : "border-border"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`font-mono text-xs font-bold tracking-wider ${getEventColor(event.type)}`}>
                    {event.type.toUpperCase().replace(/_/g, " ")}
                  </span>
                  <span className="font-mono text-[10px] text-muted">
                    {timeAgo(event.createdAt)}
                  </span>
                </div>
                {event.userEmail && (
                  <p className="font-mono text-xs text-muted mb-1">
                    {event.userEmail}
                  </p>
                )}
                {event.metadata != null && (
                  <pre className="font-mono text-[11px] text-muted/70 mt-1 overflow-x-auto whitespace-pre-wrap break-all">
                    {JSON.stringify(event.metadata, null, 2)}
                  </pre>
                )}
              </div>
              {event.workspaceId && (
                <span className="font-mono text-[10px] text-muted shrink-0">
                  ws:{event.workspaceId.slice(0, 8)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
