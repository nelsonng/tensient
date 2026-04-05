"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface SlackChannel {
  id: string;
  name: string;
}

interface SlackSectionProps {
  workspaceId: string;
  connected: boolean;
  slackTeamName?: string;
  slackChannelId?: string;
  slackChannelName?: string;
  connectedAt?: string;
}

export function SlackSection({
  workspaceId,
  connected: initialConnected,
  slackTeamName,
  slackChannelId: initialChannelId,
  slackChannelName: initialChannelName,
  connectedAt,
}: SlackSectionProps) {
  const router = useRouter();
  const [connected, setConnected] = useState(initialConnected);
  const [channelId, setChannelId] = useState(initialChannelId ?? "");
  const [channelName, setChannelName] = useState(initialChannelName ?? "");
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  async function loadChannels() {
    setLoadingChannels(true);
    try {
      const res = await fetch(
        `/api/slack/connection/channels?workspaceId=${workspaceId}`
      );
      if (res.ok) {
        const data = await res.json();
        setChannels(data.channels ?? []);
      }
    } finally {
      setLoadingChannels(false);
    }
  }

  async function saveChannel(newChannelId: string) {
    const selected = channels.find((c) => c.id === newChannelId);
    if (!selected) return;
    setSaving(true);
    try {
      await fetch(`/api/slack/connection?workspaceId=${workspaceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: selected.id, channelName: selected.name }),
      });
      setChannelId(selected.id);
      setChannelName(selected.name);
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    if (!confirm("Disconnect Slack? New feedback will no longer be posted to your channel.")) return;
    setDisconnecting(true);
    try {
      await fetch(`/api/slack/connection?workspaceId=${workspaceId}`, {
        method: "DELETE",
      });
      setConnected(false);
      router.refresh();
    } finally {
      setDisconnecting(false);
    }
  }

  if (!connected) {
    return (
      <div className="flex items-center justify-between">
        <div>
          <p className="font-body text-sm text-foreground">Not connected</p>
          <p className="font-mono text-xs text-muted mt-0.5">
            Connect Slack to receive feedback notifications and triage from your channel.
          </p>
        </div>
        <a
          href={`/api/slack/install?workspaceId=${workspaceId}`}
          className="inline-flex items-center gap-2 rounded border border-primary/30 bg-primary/5 px-4 py-2 font-mono text-xs tracking-wider text-primary hover:bg-primary/15 transition-colors"
        >
          <SlackIcon />
          ADD TO SLACK
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <SlackIcon className="w-5 h-5 text-foreground flex-shrink-0" />
          <div>
            <p className="font-body text-sm text-foreground font-medium">
              {slackTeamName}
            </p>
            <p className="font-mono text-xs text-success mt-0.5">Connected</p>
            {connectedAt && (
              <p className="font-mono text-[10px] text-muted mt-0.5">
                Since {new Date(connectedAt).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void disconnect()}
          disabled={disconnecting}
          className="font-mono text-[11px] uppercase tracking-wider text-destructive hover:text-destructive/80 disabled:opacity-40 cursor-pointer"
        >
          {disconnecting ? "DISCONNECTING…" : "DISCONNECT"}
        </button>
      </div>

      {/* Channel selector */}
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted mb-2">
          Posting to channel
        </p>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-primary">#{channelName}</span>
          {channels.length === 0 ? (
            <button
              type="button"
              onClick={() => void loadChannels()}
              disabled={loadingChannels}
              className="font-mono text-[10px] text-muted hover:text-foreground transition-colors cursor-pointer disabled:opacity-40"
            >
              {loadingChannels ? "LOADING…" : "CHANGE CHANNEL"}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <select
                value={channelId}
                onChange={(e) => void saveChannel(e.target.value)}
                disabled={saving}
                className="rounded border border-border bg-background px-2 py-1 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
              >
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.name}
                  </option>
                ))}
              </select>
              {saving && (
                <span className="font-mono text-[10px] text-muted">Saving…</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Info callout */}
      <div className="rounded border border-border bg-background px-3 py-2">
        <p className="font-mono text-[10px] text-muted leading-relaxed">
          New feedback submissions will be posted to <span className="text-foreground">#{channelName}</span>.
          Use the status/priority dropdowns in each message to triage inline.
          Thread replies sync back to Tensient automatically.
        </p>
      </div>
    </div>
  );
}

function SlackIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
    </svg>
  );
}
