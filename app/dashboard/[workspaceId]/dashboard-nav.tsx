"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

const NAV_ITEMS = [
  { label: "CONVERSATIONS", path: "", absolute: false },
  { label: "CONTEXT", path: "context", absolute: false },
  { label: "SYNTHESIS", path: "synthesis", absolute: false },
  { label: "INTEGRATIONS", path: "integrations", absolute: false },
  { label: "SETTINGS", path: "settings", absolute: false },
  { label: "DOCS", path: "/docs", absolute: true },
] as const;

interface WorkspaceInfo {
  id: string;
  name: string;
}

export function DashboardNav({
  workspaceId,
  isSuperAdmin = false,
  workspaces = [],
}: {
  workspaceId: string;
  isSuperAdmin?: boolean;
  workspaces?: WorkspaceInfo[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const basePath = `/dashboard/${workspaceId}`;
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentWorkspace = workspaces.find((w) => w.id === workspaceId);
  const otherWorkspaces = workspaces.filter((w) => w.id !== workspaceId);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="mx-auto max-w-[1200px] px-6 pt-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link
            href={basePath}
            className="font-display text-base font-bold tracking-wider text-foreground"
          >
            TENSIENT
          </Link>
          {workspaces.length > 0 && (
            <>
              <span className="text-border">/</span>
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="font-mono text-sm text-muted hover:text-foreground transition-colors cursor-pointer flex items-center gap-1"
                >
                  {currentWorkspace?.name || "Workspace"}
                  <svg
                    className={`w-3 h-3 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {dropdownOpen && (
                  <div className="absolute top-full left-0 mt-2 w-56 bg-panel border border-border rounded-lg shadow-lg z-50">
                    {currentWorkspace && (
                      <div className="px-3 py-2 font-mono text-xs text-primary border-b border-border">
                        {currentWorkspace.name}
                      </div>
                    )}

                    {otherWorkspaces.length > 0 && (
                      <div className="py-1">
                        {otherWorkspaces.map((ws) => (
                          <Link
                            key={ws.id}
                            href={`/dashboard/${ws.id}`}
                            onClick={() => setDropdownOpen(false)}
                            className="block px-3 py-2 font-mono text-xs text-muted hover:text-foreground hover:bg-border/30 transition-colors"
                          >
                            {ws.name}
                          </Link>
                        ))}
                      </div>
                    )}

                    <div className="border-t border-border py-1">
                      <Link
                        href="/join"
                        onClick={() => setDropdownOpen(false)}
                        className="block px-3 py-2 font-mono text-xs text-muted hover:text-foreground hover:bg-border/30 transition-colors"
                      >
                        JOIN WORKSPACE
                      </Link>
                      {showNewForm ? (
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            if (!newName.trim() || creating) return;
                            setCreating(true);
                            try {
                              const res = await fetch("/api/workspaces", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ name: newName.trim() }),
                              });
                              const data = await res.json();
                              if (res.ok) {
                                setDropdownOpen(false);
                                setShowNewForm(false);
                                setNewName("");
                                router.push(`/dashboard/${data.id}`);
                              }
                            } finally {
                              setCreating(false);
                            }
                          }}
                          className="px-3 py-2"
                        >
                          <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="Workspace name"
                            autoFocus
                            className="w-full rounded border border-border bg-background px-2 py-1 font-mono text-xs text-foreground placeholder:text-muted/40 focus:border-primary focus:outline-none mb-1"
                          />
                          <div className="flex gap-1">
                            <button
                              type="submit"
                              disabled={creating || !newName.trim()}
                              className="font-mono text-[10px] text-primary hover:text-primary/80 cursor-pointer disabled:text-muted/40 disabled:cursor-not-allowed"
                            >
                              {creating ? "CREATING..." : "CREATE"}
                            </button>
                            <button
                              type="button"
                              onClick={() => { setShowNewForm(false); setNewName(""); }}
                              className="font-mono text-[10px] text-muted hover:text-foreground cursor-pointer"
                            >
                              CANCEL
                            </button>
                          </div>
                        </form>
                      ) : (
                        <button
                          onClick={() => setShowNewForm(true)}
                          className="block w-full text-left px-3 py-2 font-mono text-xs text-muted hover:text-foreground hover:bg-border/30 transition-colors cursor-pointer"
                        >
                          NEW WORKSPACE
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-4">
          {isSuperAdmin && (
            <Link
              href="/admin"
              className="px-3 py-1 rounded font-mono text-[10px] tracking-widest text-primary border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors"
            >
              COMMAND CENTER
            </Link>
          )}
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="font-mono text-xs text-muted hover:text-destructive transition-colors cursor-pointer"
          >
            SIGN OUT
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex items-center gap-1 mb-6 border-b border-border pb-3">
        {NAV_ITEMS.map((item) => {
          const href = item.absolute
            ? item.path
            : item.path
              ? `${basePath}/${item.path}`
              : basePath;
          const isActive = item.path
            ? item.absolute
              ? pathname === item.path || pathname?.startsWith(`${item.path}/`)
              : pathname?.startsWith(href)
            : pathname === basePath || pathname === `${basePath}/`;
          return (
            <Link
              key={item.label}
              href={href}
              className={`px-3 py-1.5 font-mono text-xs tracking-wider transition-colors ${
                isActive
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
