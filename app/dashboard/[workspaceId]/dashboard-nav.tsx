"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const NAV_ITEMS = [
  { label: "GOALS", path: "goals" },
  { label: "THOUGHTS", path: "thoughts" },
  { label: "COACHES", path: "coaches" },
  { label: "SYNTHESIS", path: "synthesis" },
  { label: "SETTINGS", path: "settings" },
] as const;

export function DashboardNav({ workspaceId, isSuperAdmin = false }: { workspaceId: string; isSuperAdmin?: boolean }) {
  const pathname = usePathname();
  const basePath = `/dashboard/${workspaceId}`;

  // Hide nav on welcome/onboarding and strategy setup flows
  if (pathname?.includes("/welcome") || pathname?.includes("/strategy")) return null;

  return (
    <div className="mx-auto max-w-[1200px] px-6 pt-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Link
          href="/"
          className="font-display text-base font-bold uppercase tracking-wider text-foreground"
        >
          TENSIENT
        </Link>
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
        <Link
          href={basePath}
          className={`px-3 py-1.5 font-mono text-xs tracking-wider transition-colors ${
            pathname === basePath
              ? "text-primary border-b-2 border-primary"
              : "text-muted hover:text-foreground"
          }`}
        >
          HOME
        </Link>
        {NAV_ITEMS.map((item) => {
          const href = `${basePath}/${item.path}`;
          const isActive = pathname === href;
          return (
            <Link
              key={item.path}
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
