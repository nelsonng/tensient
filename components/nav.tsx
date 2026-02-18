"use client";

import Link from "next/link";
import { SlantedButton } from "./slanted-button";

const navItems = [
  { label: "SIGN IN", href: "/sign-in", mobileVisible: true },
];

export function Nav() {
  return (
    <header className="fixed top-0 left-0 right-0 z-30 border-b border-border bg-background/90 backdrop-blur-sm">
      <nav className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-6">
        <Link
          href="/"
          className="font-display text-base font-bold uppercase tracking-wider text-foreground"
        >
          TENSIENT
        </Link>

        <div className="flex items-center gap-4 sm:gap-8">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${item.mobileVisible ? "inline-block" : "hidden sm:inline-block"} font-mono text-xs sm:text-sm uppercase tracking-widest text-muted transition-colors duration-150 hover:text-primary`}
            >
              {item.label}
            </Link>
          ))}
          <span className="sm:hidden">
            <SlantedButton size="sm" href="/sign-up">TRY IT FREE</SlantedButton>
          </span>
          <span className="hidden sm:inline-flex">
            <SlantedButton size="default" href="/sign-up">TRY IT FREE</SlantedButton>
          </span>
        </div>
      </nav>
    </header>
  );
}
