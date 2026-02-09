"use client";

import Link from "next/link";
import { SlantedButton } from "./slanted-button";

const navItems = [
  { label: "PRODUCT", href: "#product" },
  { label: "PROTOCOLS", href: "#protocols" },
  { label: "DOCS", href: "#" },
];

export function Nav() {
  return (
    <header className="fixed top-0 left-0 right-0 z-30 border-b border-border bg-background/90 backdrop-blur-sm">
      <nav className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-6">
        <Link
          href="/"
          className="font-display text-sm font-bold uppercase tracking-wider text-foreground"
        >
          TENSIENT
        </Link>

        <div className="flex items-center gap-8">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="hidden font-mono text-xs uppercase tracking-widest text-muted transition-colors duration-150 hover:text-primary sm:inline-block"
            >
              {item.label}
            </Link>
          ))}
          <SlantedButton size="default">REQUEST ACCESS</SlantedButton>
        </div>
      </nav>
    </header>
  );
}
