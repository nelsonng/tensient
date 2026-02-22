"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SynthesisSubnav({ workspaceId }: { workspaceId: string }) {
  const pathname = usePathname();
  const tabs = [
    { label: "DOCUMENTS", href: `/dashboard/${workspaceId}/synthesis` },
    { label: "SIGNALS", href: `/dashboard/${workspaceId}/synthesis/signals` },
    { label: "HISTORY", href: `/dashboard/${workspaceId}/synthesis/history` },
  ] as const;

  return (
    <div className="mx-auto max-w-[1200px] px-6">
      <div className="mb-4 border-b border-border pb-2">
        <div className="flex items-center gap-1">
          {tabs.map((tab) => {
            const isActive =
              tab.href === `/dashboard/${workspaceId}/synthesis`
                ? pathname === tab.href || pathname?.startsWith(`${tab.href}/documents`)
                : pathname?.startsWith(tab.href);
            return (
              <Link
                key={tab.label}
                href={tab.href}
                className={`px-3 py-1.5 font-mono text-xs tracking-wider ${
                  isActive
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
