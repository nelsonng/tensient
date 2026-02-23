"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MonoLabel } from "@/components/mono-label";
import { PanelCard } from "@/components/panel-card";
import { SlantedButton } from "@/components/slanted-button";

// ── Types ─────────────────────────────────────────────────────────────

interface UserData {
  id: string;
  email: string;
  emailVerified: string | null;
  firstName: string | null;
  lastName: string | null;
  tier: string;
  createdAt: string;
}

interface WorkspaceData {
  id: string;
  name: string;
  joinCode: string;
}

interface MemberData {
  membershipId: string;
  userId: string;
  role: string;
  tractionScore: number;
  joinedAt: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

interface SettingsClientProps {
  workspaceId: string;
  initialTab: string;
  user: UserData;
  workspace: WorkspaceData;
  members: MemberData[];
  currentUserRole: string;
}

// ── Tabs ──────────────────────────────────────────────────────────────

const TABS = [
  { id: "profile", label: "PROFILE" },
  { id: "security", label: "SECURITY" },
  { id: "workspace", label: "WORKSPACE" },
  { id: "members", label: "MEMBERS" },
  { id: "developer", label: "DEVELOPER" },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ── Main Component ────────────────────────────────────────────────────

export function SettingsClient({
  workspaceId,
  initialTab,
  user,
  workspace,
  members: initialMembers,
  currentUserRole,
}: SettingsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get("tab") || initialTab) as TabId;

  const setTab = (tab: TabId) => {
    router.push(`/dashboard/${workspaceId}/settings?tab=${tab}`, {
      scroll: false,
    });
  };

  return (
    <div className="mx-auto max-w-[800px] px-6 pb-24">
      <div className="mb-8">
        <MonoLabel className="mb-2 block text-primary">SETTINGS</MonoLabel>
        <h1 className="font-display text-2xl font-bold uppercase tracking-tight">
          Settings
        </h1>
      </div>

      {/* Tab Bar */}
      <nav className="flex items-center gap-1 mb-8 border-b border-border pb-3">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTab(tab.id)}
            className={`px-3 py-1.5 font-mono text-xs tracking-wider transition-colors cursor-pointer ${
              activeTab === tab.id
                ? "text-primary border-b-2 border-primary"
                : "text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Tab Content */}
      {activeTab === "profile" && <ProfileTab user={user} />}
      {activeTab === "security" && <SecurityTab user={user} />}
      {activeTab === "workspace" && (
        <WorkspaceTab
          workspace={workspace}
          workspaceId={workspaceId}
          isOwner={currentUserRole === "owner"}
        />
      )}
      {activeTab === "members" && (
        <MembersTab
          members={initialMembers}
          workspace={workspace}
          workspaceId={workspaceId}
          currentUserId={user.id}
          isOwner={currentUserRole === "owner"}
        />
      )}
      {activeTab === "developer" && (
        <DeveloperTab workspaceId={workspaceId} />
      )}
    </div>
  );
}

interface ApiKeyRow {
  id: string;
  workspaceId: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

function DeveloperTab({ workspaceId }: { workspaceId: string }) {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState("My Cursor Key");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadKeys = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/user/api-keys?workspaceId=${workspaceId}`);
      if (!res.ok) {
        setMessage("Failed to load API keys");
        return;
      }
      const data = (await res.json()) as ApiKeyRow[];
      setKeys(data);
    } catch {
      setMessage("Network error while loading API keys");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  async function handleCreate() {
    setCreating(true);
    setMessage(null);
    try {
      const res = await fetch("/api/user/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          name: newKeyName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Failed to create key");
        return;
      }

      setRevealedKey(data.key);
      setNewKeyName("My Cursor Key");
      await loadKeys();
    } catch {
      setMessage("Network error while creating API key");
    } finally {
      setCreating(false);
    }
  }

  async function handleRotate(keyId: string, name: string) {
    setCreating(true);
    setMessage(null);
    try {
      const res = await fetch("/api/user/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          name,
          rotateFromId: keyId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Failed to rotate key");
        return;
      }
      setRevealedKey(data.key);
      await loadKeys();
    } catch {
      setMessage("Network error while rotating API key");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    const confirmed = window.confirm("Revoke this API key?");
    if (!confirmed) return;
    setRevokingId(id);
    setMessage(null);
    try {
      const res = await fetch("/api/user/api-keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Failed to revoke key");
        return;
      }
      await loadKeys();
    } catch {
      setMessage("Network error while revoking key");
    } finally {
      setRevokingId(null);
    }
  }

  async function copyKey() {
    if (!revealedKey) return;
    try {
      await navigator.clipboard.writeText(revealedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setMessage("Failed to copy key");
    }
  }

  return (
    <div className="space-y-6">
      <PanelCard>
        <MonoLabel className="text-primary mb-4 block">API KEYS</MonoLabel>
        <p className="font-body text-sm text-muted mb-4">
          Generate keys for MCP clients. A key is shown once and then hidden forever.
        </p>
        <a
          href="/docs"
          className="inline-block font-mono text-xs text-primary hover:text-primary/80 transition-colors mb-4"
        >
          READ MCP DOCS →
        </a>
        <p className="font-mono text-xs text-muted mb-4">Workspace ID: {workspaceId}</p>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key name"
            className="w-full bg-background border border-border rounded px-3 py-2 font-body text-base text-foreground focus:border-primary focus:outline-none transition-colors"
          />
          <SlantedButton onClick={handleCreate} disabled={creating}>
            {creating ? "GENERATING..." : "GENERATE NEW KEY"}
          </SlantedButton>
        </div>

        {message && <p className="font-mono text-sm text-destructive mt-3">{message}</p>}
      </PanelCard>

      {revealedKey && (
        <PanelCard>
          <MonoLabel className="text-warning mb-3 block">KEY REVEAL</MonoLabel>
          <p className="font-body text-sm text-muted mb-3">
            This key will not be shown again. Copy and store it now.
          </p>
          <code className="block w-full overflow-x-auto bg-border/30 px-3 py-2 rounded font-mono text-xs text-foreground">
            {revealedKey}
          </code>
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={copyKey}
              className="font-mono text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer"
            >
              {copied ? "COPIED" : "COPY KEY"}
            </button>
            <button
              onClick={() => setRevealedKey(null)}
              className="font-mono text-xs text-muted hover:text-foreground transition-colors cursor-pointer"
            >
              DISMISS
            </button>
          </div>
        </PanelCard>
      )}

      <PanelCard>
        <MonoLabel className="text-primary mb-4 block">
          ACTIVE + REVOKED KEYS ({keys.length})
        </MonoLabel>
        {loading ? (
          <p className="font-mono text-sm text-muted">Loading keys...</p>
        ) : keys.length === 0 ? (
          <p className="font-mono text-sm text-muted">No API keys yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {keys.map((key) => {
              const isRevoked = Boolean(key.revokedAt);
              return (
                <div key={key.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-body text-base text-foreground">{key.name}</span>
                      <span className="font-mono text-xs text-primary bg-primary/10 px-2 py-0.5 rounded">
                        {key.keyPrefix}...
                      </span>
                      {isRevoked && (
                        <span className="font-mono text-[10px] text-destructive">
                          REVOKED
                        </span>
                      )}
                    </div>
                    <p className="font-mono text-xs text-muted mt-1">
                      Created{" "}
                      {new Date(key.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                      {" · "}
                      Last used{" "}
                      {key.lastUsedAt
                        ? new Date(key.lastUsedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "never"}
                    </p>
                  </div>

                  {!isRevoked && (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => void handleRotate(key.id, `${key.name} (rotated)`)}
                        disabled={creating}
                        className="font-mono text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        ROTATE
                      </button>
                      <button
                        onClick={() => void handleRevoke(key.id)}
                        disabled={revokingId === key.id}
                        className="font-mono text-xs text-destructive hover:text-destructive/80 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {revokingId === key.id ? "REVOKING..." : "REVOKE"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </PanelCard>
    </div>
  );
}

// ── Profile Tab ───────────────────────────────────────────────────────

function ProfileTab({ user }: { user: UserData }) {
  const [firstName, setFirstName] = useState(user.firstName || "");
  const [lastName, setLastName] = useState(user.lastName || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName }),
      });

      if (!res.ok) {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to save" });
        return;
      }

      setMessage({
        type: "success",
        text: "Profile updated. Name change will appear after your next sign-in.",
      });
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PanelCard>
        <MonoLabel className="text-primary mb-4 block">
          PERSONAL INFORMATION
        </MonoLabel>

        <div className="space-y-4">
          <div>
            <label className="font-mono text-sm text-muted block mb-1">
              FIRST NAME
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full bg-background border border-border rounded px-3 py-2 font-body text-base text-foreground focus:border-primary focus:outline-none transition-colors"
              placeholder="First name"
            />
          </div>
          <div>
            <label className="font-mono text-sm text-muted block mb-1">
              LAST NAME
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full bg-background border border-border rounded px-3 py-2 font-body text-base text-foreground focus:border-primary focus:outline-none transition-colors"
              placeholder="Last name"
            />
          </div>

          {message && (
            <p
              className={`font-mono text-sm ${
                message.type === "success" ? "text-primary" : "text-destructive"
              }`}
            >
              {message.text}
            </p>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-primary text-background font-mono text-sm font-bold uppercase tracking-wider hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {saving ? "SAVING..." : "SAVE CHANGES"}
          </button>
        </div>
      </PanelCard>

      <PanelCard>
        <MonoLabel className="text-primary mb-4 block">ACCOUNT</MonoLabel>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm text-muted">EMAIL</span>
            <span className="font-body text-base text-foreground">
              {user.email}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm text-muted">TIER</span>
            <span className="font-mono text-xs text-primary uppercase">
              {user.tier}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm text-muted">MEMBER SINCE</span>
            <span className="font-body text-base text-foreground">
              {new Date(user.createdAt).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
        </div>
      </PanelCard>
    </div>
  );
}

// ── Security Tab ──────────────────────────────────────────────────────

function SecurityTab({ user }: { user: UserData }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Resend verification
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const handleChangePassword = async () => {
    setMessage(null);

    if (newPassword.length < 8) {
      setMessage({
        type: "error",
        text: "New password must be at least 8 characters",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "Passwords do not match" });
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/user/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!res.ok) {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to change password" });
        return;
      }

      setMessage({ type: "success", text: "Password changed successfully" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setSaving(false);
    }
  };

  const handleResendVerification = async () => {
    setResending(true);
    setResendMessage(null);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
      });
      if (res.ok) {
        setResendMessage("Verification email sent");
      } else {
        const data = await res.json();
        setResendMessage(data.error || "Failed to send");
      }
    } catch {
      setResendMessage("Network error");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="space-y-6">
      <PanelCard>
        <MonoLabel className="text-primary mb-4 block">
          CHANGE PASSWORD
        </MonoLabel>

        <div className="space-y-4">
          <div>
            <label className="font-mono text-sm text-muted block mb-1">
              CURRENT PASSWORD
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full bg-background border border-border rounded px-3 py-2 font-body text-base text-foreground focus:border-primary focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="font-mono text-sm text-muted block mb-1">
              NEW PASSWORD
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-background border border-border rounded px-3 py-2 font-body text-base text-foreground focus:border-primary focus:outline-none transition-colors"
              placeholder="Minimum 8 characters"
            />
          </div>
          <div>
            <label className="font-mono text-sm text-muted block mb-1">
              CONFIRM NEW PASSWORD
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-background border border-border rounded px-3 py-2 font-body text-base text-foreground focus:border-primary focus:outline-none transition-colors"
            />
          </div>

          {message && (
            <p
              className={`font-mono text-sm ${
                message.type === "success" ? "text-primary" : "text-destructive"
              }`}
            >
              {message.text}
            </p>
          )}

          <button
            onClick={handleChangePassword}
            disabled={saving || !currentPassword || !newPassword || !confirmPassword}
            className="px-4 py-2 bg-primary text-background font-mono text-sm font-bold uppercase tracking-wider hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {saving ? "UPDATING..." : "CHANGE PASSWORD"}
          </button>
        </div>
      </PanelCard>

      <PanelCard>
        <MonoLabel className="text-primary mb-4 block">
          EMAIL VERIFICATION
        </MonoLabel>
        <div className="flex items-center justify-between">
          <div>
            <span className="font-body text-base text-foreground">
              {user.email}
            </span>
            <span
              className={`ml-3 font-mono text-xs ${
                user.emailVerified ? "text-primary" : "text-warning"
              }`}
            >
              {user.emailVerified ? "VERIFIED" : "NOT VERIFIED"}
            </span>
          </div>
          {!user.emailVerified && (
            <button
              onClick={handleResendVerification}
              disabled={resending}
              className="font-mono text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer disabled:opacity-50"
            >
              {resending ? "SENDING..." : "RESEND VERIFICATION"}
            </button>
          )}
        </div>
        {resendMessage && (
          <p className="font-mono text-sm text-muted mt-2">{resendMessage}</p>
        )}
      </PanelCard>
    </div>
  );
}

// ── Workspace Tab ─────────────────────────────────────────────────────

function WorkspaceTab({
  workspace,
  workspaceId,
  isOwner,
}: {
  workspace: WorkspaceData;
  workspaceId: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(workspace.name);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/settings`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to save" });
        return;
      }

      setMessage({ type: "success", text: "Workspace name updated" });
      router.refresh();
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setSaving(false);
    }
  };

  const joinUrl = `https://tensient.com/join?code=${workspace.joinCode}`;

  const copyJoinLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: do nothing
    }
  };

  return (
    <div className="space-y-6">
      <PanelCard>
        <MonoLabel className="text-primary mb-4 block">
          WORKSPACE NAME
        </MonoLabel>

        <div className="space-y-4">
          <div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isOwner}
              className="w-full bg-background border border-border rounded px-3 py-2 font-body text-base text-foreground focus:border-primary focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Workspace name"
            />
            {!isOwner && (
              <p className="font-mono text-xs text-muted mt-1">
                Only workspace owners can rename the workspace.
              </p>
            )}
          </div>

          {message && (
            <p
              className={`font-mono text-sm ${
                message.type === "success" ? "text-primary" : "text-destructive"
              }`}
            >
              {message.text}
            </p>
          )}

          {isOwner && (
            <button
              onClick={handleSave}
              disabled={saving || !name.trim() || name.trim() === workspace.name}
              className="px-4 py-2 bg-primary text-background font-mono text-sm font-bold uppercase tracking-wider hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {saving ? "SAVING..." : "SAVE"}
            </button>
          )}
        </div>
      </PanelCard>

      <PanelCard>
        <MonoLabel className="text-primary mb-4 block">INVITE LINK</MonoLabel>
        <p className="font-body text-base text-muted mb-3">
          Share this link with team members so they can join your workspace.
        </p>
        <div className="flex items-center gap-3">
          <code className="font-mono text-sm text-foreground bg-border/30 px-4 py-2 rounded break-all">
            {joinUrl}
          </code>
          <button
            onClick={copyJoinLink}
            className="font-mono text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer shrink-0"
          >
            {copied ? "COPIED" : "COPY"}
          </button>
        </div>
      </PanelCard>
    </div>
  );
}

// ── Members Tab ───────────────────────────────────────────────────────

function MembersTab({
  members: initialMembers,
  workspace,
  workspaceId,
  currentUserId,
  isOwner,
}: {
  members: MemberData[];
  workspace: WorkspaceData;
  workspaceId: string;
  currentUserId: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const memberName = (m: MemberData) =>
    [m.firstName, m.lastName].filter(Boolean).join(" ") || m.email;

  const handleRoleChange = async (membershipId: string, newRole: string) => {
    setActionLoading(membershipId);
    setError(null);

    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/members/${membershipId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: newRole }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to update role");
        return;
      }

      // Update local state
      setMembers((prev) =>
        prev.map((m) =>
          m.membershipId === membershipId ? { ...m, role: newRole } : m
        )
      );
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemove = async (membershipId: string) => {
    setActionLoading(membershipId);
    setError(null);

    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/members/${membershipId}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to remove member");
        return;
      }

      // Update local state
      setMembers((prev) => prev.filter((m) => m.membershipId !== membershipId));
      setConfirmRemove(null);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setActionLoading(null);
    }
  };

  const joinUrl = `https://tensient.com/join?code=${workspace.joinCode}`;

  const copyJoinLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: do nothing
    }
  };

  const getAlignmentColor = (score: number) => {
    const pct = Math.round(score * 100);
    if (pct >= 80) return "text-primary";
    if (pct >= 50) return "text-warning";
    return "text-destructive";
  };

  return (
    <div className="space-y-6">
      {/* Invite */}
      <PanelCard>
        <MonoLabel className="text-primary mb-3 block">
          INVITE MEMBERS
        </MonoLabel>
        <p className="font-body text-base text-muted mb-3">
          Share this link so team members can join this workspace.
        </p>
        <div className="flex items-center gap-3">
          <code className="font-mono text-sm text-foreground bg-border/30 px-4 py-2 rounded break-all">
            {joinUrl}
          </code>
          <button
            onClick={copyJoinLink}
            className="font-mono text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer shrink-0"
          >
            {copied ? "COPIED" : "COPY"}
          </button>
        </div>
      </PanelCard>

      {/* Member List */}
      <PanelCard>
        <div className="flex items-center justify-between mb-4">
          <MonoLabel className="text-primary">
            MEMBERS ({members.length})
          </MonoLabel>
        </div>

        {error && (
          <p className="font-mono text-sm text-destructive mb-3">{error}</p>
        )}

        <div className="divide-y divide-border">
          {members.map((member) => {
            const isCurrentUser = member.userId === currentUserId;
            const isRemoving = confirmRemove === member.membershipId;

            return (
              <div
                key={member.membershipId}
                className="flex items-center justify-between py-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-body text-base text-foreground truncate">
                      {memberName(member)}
                    </span>
                    {isCurrentUser && (
                      <span className="font-mono text-xs text-muted">(you)</span>
                    )}
                    <span
                      className={`font-mono text-xs px-1.5 py-0.5 rounded ${
                        member.role === "owner"
                          ? "bg-primary/20 text-primary"
                          : member.role === "observer"
                            ? "bg-border/30 text-muted"
                            : "bg-border/30 text-foreground"
                      }`}
                    >
                      {member.role.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="font-mono text-xs text-muted">
                      {member.email}
                    </span>
                    {member.tractionScore > 0 && (
                      <span
                        className={`font-mono text-xs ${getAlignmentColor(
                          member.tractionScore
                        )}`}
                      >
                        {Math.round(member.tractionScore * 100)}% ALIGNMENT
                      </span>
                    )}
                  </div>
                </div>

                {/* Owner actions */}
                {isOwner && !isCurrentUser && (
                  <div className="flex items-center gap-2 ml-4">
                    {actionLoading === member.membershipId ? (
                      <span className="font-mono text-xs text-muted">...</span>
                    ) : isRemoving ? (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-destructive">
                          Remove?
                        </span>
                        <button
                          onClick={() => handleRemove(member.membershipId)}
                          className="font-mono text-xs text-destructive hover:text-destructive/80 transition-colors cursor-pointer"
                        >
                          YES
                        </button>
                        <button
                          onClick={() => setConfirmRemove(null)}
                          className="font-mono text-xs text-muted hover:text-foreground transition-colors cursor-pointer"
                        >
                          NO
                        </button>
                      </div>
                    ) : (
                      <>
                        <select
                          value={member.role}
                          onChange={(e) =>
                            handleRoleChange(
                              member.membershipId,
                              e.target.value
                            )
                          }
                          className="bg-background border border-border rounded px-2 py-1 font-mono text-xs text-foreground focus:border-primary focus:outline-none transition-colors cursor-pointer"
                        >
                          <option value="owner">OWNER</option>
                          <option value="member">MEMBER</option>
                          <option value="observer">OBSERVER</option>
                        </select>
                        <button
                          onClick={() =>
                            setConfirmRemove(member.membershipId)
                          }
                          className="font-mono text-xs text-destructive hover:text-destructive/80 transition-colors cursor-pointer"
                        >
                          REMOVE
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </PanelCard>
    </div>
  );
}
