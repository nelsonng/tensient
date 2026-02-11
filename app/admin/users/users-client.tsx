"use client";

import { useState, useMemo } from "react";
import type { UserRow } from "./page";

type SortKey = keyof Pick<
  UserRow,
  | "email"
  | "domain"
  | "tier"
  | "createdAt"
  | "lastSignIn"
  | "captureCount"
  | "daysActive"
  | "aiSpendCents"
  | "workspaceCount"
>;

type SortDir = "asc" | "desc";

function timeAgo(date: Date | string | null): string {
  if (!date) return "never";
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 0) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function daysSince(date: Date | string | null): number {
  if (!date) return Infinity;
  const d = typeof date === "string" ? new Date(date) : date;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function TierPill({ tier }: { tier: string }) {
  const cls =
    tier === "active"
      ? "bg-success/15 text-success border-success/30"
      : tier === "suspended"
      ? "bg-destructive/15 text-destructive border-destructive/30"
      : "bg-border/30 text-muted border-border";
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded font-mono text-[10px] tracking-wider uppercase border ${cls}`}
    >
      {tier}
    </span>
  );
}

function ActivationScore({ user }: { user: UserRow }) {
  const milestones = [
    { done: !!user.emailVerified, label: "V" },
    { done: user.captureCount > 0, label: "C" },
    { done: user.hasSynthesis, label: "S" },
    { done: user.daysActive >= 2, label: "2" },
    { done: user.workspaceCount > 0, label: "W" },
  ];
  const completed = milestones.filter((m) => m.done).length;

  return (
    <div className="flex items-center gap-0.5" title={`${completed}/5 milestones`}>
      {milestones.map((m, i) => (
        <span
          key={i}
          className={`inline-block w-4 h-4 rounded text-center leading-4 font-mono text-[8px] font-bold ${
            m.done
              ? "bg-success/20 text-success"
              : "bg-border/30 text-muted/30"
          }`}
          title={
            ["Verified", "Captured", "Synthesis", "2+ Days", "Workspace"][i]
          }
        >
          {m.label}
        </span>
      ))}
      <span className="font-mono text-[10px] text-muted ml-1">
        {completed}/5
      </span>
    </div>
  );
}

function LastSeenIndicator({ date }: { date: Date | string | null }) {
  const days = daysSince(date);
  const color =
    days <= 3
      ? "text-success"
      : days <= 7
      ? "text-foreground"
      : days <= 30
      ? "text-warning"
      : "text-destructive";

  return (
    <span className={`font-mono text-[10px] ${color}`}>
      {timeAgo(date)}
    </span>
  );
}

function EditModal({
  user,
  onClose,
  onSave,
}: {
  user: UserRow;
  onClose: () => void;
  onSave: (data: {
    firstName: string;
    lastName: string;
    tier: string;
    isSuperAdmin: boolean;
  }) => Promise<void>;
}) {
  const [firstName, setFirstName] = useState(user.firstName || "");
  const [lastName, setLastName] = useState(user.lastName || "");
  const [tier, setTier] = useState(user.tier);
  const [isSuperAdmin, setIsSuperAdmin] = useState(user.isSuperAdmin);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      await onSave({ firstName, lastName, tier, isSuperAdmin });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-panel border border-border rounded-lg w-full max-w-md">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-mono text-sm font-bold text-foreground tracking-wider">
            EDIT USER
          </h3>
          <p className="font-mono text-[10px] text-muted mt-1">{user.email}</p>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-[10px] tracking-widest text-muted uppercase mb-1">
                FIRST NAME
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full bg-background border border-border rounded px-3 py-1.5 font-mono text-xs text-foreground focus:outline-none focus:border-primary/50"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] tracking-widest text-muted uppercase mb-1">
                LAST NAME
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full bg-background border border-border rounded px-3 py-1.5 font-mono text-xs text-foreground focus:outline-none focus:border-primary/50"
              />
            </div>
          </div>

          <div>
            <label className="block font-mono text-[10px] tracking-widest text-muted uppercase mb-1">
              TIER
            </label>
            <div className="flex gap-2">
              {(["trial", "active", "suspended"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTier(t)}
                  className={`px-3 py-1.5 rounded font-mono text-xs tracking-wider transition-colors cursor-pointer ${
                    tier === t
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "bg-background border border-border text-muted hover:text-foreground"
                  }`}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="superadmin"
              checked={isSuperAdmin}
              onChange={(e) => setIsSuperAdmin(e.target.checked)}
              className="accent-primary"
            />
            <label
              htmlFor="superadmin"
              className="font-mono text-xs text-foreground tracking-wider cursor-pointer"
            >
              SUPER ADMIN
            </label>
          </div>

          {error && (
            <p className="font-mono text-xs text-destructive">{error}</p>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-xs tracking-wider text-muted hover:text-foreground transition-colors cursor-pointer"
          >
            CANCEL
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 rounded bg-primary/10 text-primary border border-primary/20 font-mono text-xs tracking-wider hover:bg-primary/20 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {saving ? "SAVING..." : "SAVE"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function UsersClient({ users: initialUsers }: { users: UserRow[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<UserRow | null>(null);

  // Filter
  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        u.domain.toLowerCase().includes(q) ||
        (u.firstName && u.firstName.toLowerCase().includes(q)) ||
        (u.lastName && u.lastName.toLowerCase().includes(q)) ||
        (u.orgName && u.orgName.toLowerCase().includes(q))
    );
  }, [users, search]);

  // Sort
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let aVal: string | number | null = a[sortKey] as string | number | null;
      let bVal: string | number | null = b[sortKey] as string | number | null;

      // Handle dates
      if (sortKey === "createdAt" || sortKey === "lastSignIn") {
        aVal = aVal ? new Date(aVal as string).getTime() : 0;
        bVal = bVal ? new Date(bVal as string).getTime() : 0;
      }

      // Handle nulls
      if (aVal == null) aVal = sortDir === "asc" ? Infinity : -Infinity;
      if (bVal == null) bVal = sortDir === "asc" ? Infinity : -Infinity;

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return sortDir === "asc"
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
  }, [filtered, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function SortHeader({
    label,
    sortField,
    className = "",
  }: {
    label: string;
    sortField: SortKey;
    className?: string;
  }) {
    const active = sortKey === sortField;
    return (
      <button
        type="button"
        onClick={() => toggleSort(sortField)}
        className={`font-mono text-[10px] tracking-widest uppercase cursor-pointer hover:text-foreground transition-colors ${
          active ? "text-primary" : "text-muted"
        } ${className}`}
      >
        {label}
        {active && (
          <span className="ml-0.5">{sortDir === "asc" ? "↑" : "↓"}</span>
        )}
      </button>
    );
  }

  async function handleEditSave(data: {
    firstName: string;
    lastName: string;
    tier: string;
    isSuperAdmin: boolean;
  }) {
    if (!editingUser) return;
    const res = await fetch(`/api/admin/users/${editingUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Failed to update user");
    }
    // Update local state
    setUsers((prev) =>
      prev.map((u) =>
        u.id === editingUser.id
          ? {
              ...u,
              firstName: data.firstName || null,
              lastName: data.lastName || null,
              tier: data.tier as UserRow["tier"],
              isSuperAdmin: data.isSuperAdmin,
            }
          : u
      )
    );
  }

  async function handleSuspend(user: UserRow) {
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error || "Failed to suspend user");
      return;
    }
    setUsers((prev) =>
      prev.map((u) =>
        u.id === user.id ? { ...u, tier: "suspended" as const } : u
      )
    );
    setConfirmDelete(null);
  }

  // Summary stats
  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.tier === "active").length;
  const trialUsers = users.filter((u) => u.tier === "trial").length;
  const suspendedUsers = users.filter((u) => u.tier === "suspended").length;
  const verifiedCount = users.filter((u) => u.emailVerified).length;
  const activeLast7d = users.filter(
    (u) => daysSince(u.lastSignIn) <= 7
  ).length;

  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        <div className="bg-panel border border-border rounded-lg p-3">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
            TOTAL
          </p>
          <p className="font-display text-xl font-bold text-foreground">
            {totalUsers}
          </p>
        </div>
        <div className="bg-panel border border-border rounded-lg p-3">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
            ACTIVE TIER
          </p>
          <p className="font-display text-xl font-bold text-success">
            {activeUsers}
          </p>
        </div>
        <div className="bg-panel border border-border rounded-lg p-3">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
            TRIAL
          </p>
          <p className="font-display text-xl font-bold text-foreground">
            {trialUsers}
          </p>
        </div>
        <div className="bg-panel border border-border rounded-lg p-3">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
            SUSPENDED
          </p>
          <p className="font-display text-xl font-bold text-destructive">
            {suspendedUsers}
          </p>
        </div>
        <div className="bg-panel border border-border rounded-lg p-3">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
            VERIFIED
          </p>
          <p className="font-display text-xl font-bold text-foreground">
            {verifiedCount}
          </p>
        </div>
        <div className="bg-panel border border-border rounded-lg p-3">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
            ACTIVE 7D
          </p>
          <p
            className={`font-display text-xl font-bold ${
              activeLast7d > 0 ? "text-success" : "text-muted"
            }`}
          >
            {activeLast7d}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search email, domain, name, or org..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md bg-panel border border-border rounded px-4 py-2 font-mono text-xs text-foreground placeholder:text-muted/50 focus:outline-none focus:border-primary/50"
        />
        {search && (
          <p className="font-mono text-[10px] text-muted mt-1">
            {sorted.length} results
          </p>
        )}
      </div>

      {/* Users Table */}
      <div className="bg-panel border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
            ALL USERS ({sorted.length})
          </p>
        </div>

        {/* Table Header */}
        <div className="grid grid-cols-[1fr_100px_70px_70px_90px_80px_70px_60px_60px_50px] gap-1 px-4 py-2 border-b border-border">
          <SortHeader label="USER" sortField="email" />
          <SortHeader label="DOMAIN" sortField="domain" className="text-center" />
          <SortHeader label="TIER" sortField="tier" className="text-center" />
          <SortHeader label="LAST SEEN" sortField="lastSignIn" className="text-center" />
          <SortHeader label="ACTIVATED" sortField="captureCount" className="text-center" />
          <SortHeader label="CAPTURES" sortField="captureCount" className="text-center" />
          <SortHeader label="DAYS" sortField="daysActive" className="text-center" />
          <SortHeader label="WS" sortField="workspaceCount" className="text-center" />
          <SortHeader label="SPEND" sortField="aiSpendCents" className="text-center" />
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase text-center">
            ACT
          </span>
        </div>

        {/* Rows */}
        {sorted.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p className="font-mono text-sm text-muted">
              {search ? "No users match your search" : "No users yet"}
            </p>
          </div>
        )}
        {sorted.map((user) => (
          <div
            key={user.id}
            className="grid grid-cols-[1fr_100px_70px_70px_90px_80px_70px_60px_60px_50px] gap-1 px-4 py-2 border-b border-border/50 hover:bg-white/2 transition-colors"
          >
            {/* User cell */}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-mono text-xs text-foreground truncate">
                  {user.email}
                </p>
                {user.isSuperAdmin && (
                  <span className="inline-block px-1 py-0 rounded font-mono text-[8px] tracking-wider bg-primary/15 text-primary border border-primary/30">
                    SA
                  </span>
                )}
              </div>
              {(user.firstName || user.lastName) && (
                <p className="font-mono text-[10px] text-muted truncate">
                  {[user.firstName, user.lastName].filter(Boolean).join(" ")}
                  {user.orgName && ` · ${user.orgName}`}
                </p>
              )}
              {!user.firstName && !user.lastName && user.orgName && (
                <p className="font-mono text-[10px] text-muted truncate">
                  {user.orgName}
                </p>
              )}
            </div>

            {/* Domain */}
            <p className="font-mono text-[10px] text-muted text-center self-center truncate">
              {user.domain}
            </p>

            {/* Tier */}
            <div className="flex justify-center self-center">
              <TierPill tier={user.tier} />
            </div>

            {/* Last Seen */}
            <div className="flex justify-center self-center">
              <LastSeenIndicator date={user.lastSignIn} />
            </div>

            {/* Activation */}
            <div className="flex justify-center self-center">
              <ActivationScore user={user} />
            </div>

            {/* Captures */}
            <p className="font-mono text-[10px] text-muted text-center self-center">
              {user.captureCount}
            </p>

            {/* Days Active */}
            <p className="font-mono text-[10px] text-muted text-center self-center">
              {user.daysActive}
            </p>

            {/* Workspaces */}
            <p className="font-mono text-[10px] text-muted text-center self-center">
              {user.workspaceCount}
            </p>

            {/* AI Spend */}
            <p className="font-mono text-[10px] text-muted text-center self-center">
              {user.aiSpendCents > 0
                ? `$${(user.aiSpendCents / 100).toFixed(2)}`
                : "--"}
            </p>

            {/* Actions */}
            <div className="flex items-center justify-center gap-1 self-center">
              <button
                type="button"
                onClick={() => setEditingUser(user)}
                className="font-mono text-[10px] text-primary hover:text-primary/80 cursor-pointer"
                title="Edit user"
              >
                ✎
              </button>
              {user.tier !== "suspended" && (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(user)}
                  className="font-mono text-[10px] text-destructive hover:text-destructive/80 cursor-pointer"
                  title="Suspend user"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {editingUser && (
        <EditModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSave={handleEditSave}
        />
      )}

      {/* Suspend Confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-panel border border-border rounded-lg w-full max-w-sm p-5">
            <h3 className="font-mono text-sm font-bold text-foreground tracking-wider mb-2">
              SUSPEND USER?
            </h3>
            <p className="font-mono text-xs text-muted mb-1">
              {confirmDelete.email}
            </p>
            <p className="font-mono text-[10px] text-muted/70 mb-4">
              This sets their tier to &quot;suspended&quot;. They will not be
              deleted -- their data is preserved.
            </p>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="font-mono text-xs tracking-wider text-muted hover:text-foreground transition-colors cursor-pointer"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={() => handleSuspend(confirmDelete)}
                className="px-4 py-1.5 rounded bg-destructive/10 text-destructive border border-destructive/20 font-mono text-xs tracking-wider hover:bg-destructive/20 transition-colors cursor-pointer"
              >
                SUSPEND
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
