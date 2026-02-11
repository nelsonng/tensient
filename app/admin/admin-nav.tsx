"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const NAV_ITEMS = [
  { label: "OVERVIEW", path: "/admin", icon: "◉" },
  { label: "ACQUISITION", path: "/admin/acquisition", icon: "▸" },
  { label: "ACTIVATION", path: "/admin/activation", icon: "▸" },
  { label: "RETENTION", path: "/admin/retention", icon: "▸" },
  { label: "ERRORS", path: "/admin/errors", icon: "▸" },
  { label: "ORGS", path: "/admin/orgs", icon: "▸" },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <aside className="fixed top-0 left-0 h-screen w-56 bg-panel border-r border-border flex flex-col z-50">
      {/* Header */}
      <div className="p-5 border-b border-border">
        <Link href="/admin" className="block">
          <span className="font-display text-xs font-bold tracking-wider text-primary">
            TENSIENT
          </span>
          <span className="block font-mono text-[10px] tracking-widest text-muted mt-0.5">
            CONTROL CENTER
          </span>
        </Link>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.path === "/admin"
              ? pathname === "/admin"
              : pathname?.startsWith(item.path);

          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md font-mono text-xs tracking-wider transition-all ${
                isActive
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted hover:text-foreground hover:bg-white/5"
              }`}
            >
              <span className="text-[10px]">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border space-y-2">
        <Link
          href="/dashboard"
          className="block font-mono text-[10px] tracking-wider text-muted hover:text-foreground transition-colors"
        >
          ← BACK TO DASHBOARD
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="font-mono text-[10px] tracking-wider text-muted hover:text-destructive transition-colors cursor-pointer"
        >
          SIGN OUT
        </button>
      </div>
    </aside>
  );
}
