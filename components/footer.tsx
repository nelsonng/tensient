import { MonoLabel } from "./mono-label";

export function Footer() {
  return (
    <footer className="border-t border-border bg-background py-16">
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          <div>
            <MonoLabel className="mb-4 block text-foreground">
              PRODUCT
            </MonoLabel>
            <ul className="space-y-2">
              <li>
                <a
                  href="#"
                  className="font-body text-sm text-muted transition-colors hover:text-primary"
                >
                  Overview
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="font-body text-sm text-muted transition-colors hover:text-primary"
                >
                  Documentation
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="font-body text-sm text-muted transition-colors hover:text-primary"
                >
                  Changelog
                </a>
              </li>
            </ul>
          </div>
          <div>
            <MonoLabel className="mb-4 block text-foreground">
              COMPANY
            </MonoLabel>
            <ul className="space-y-2">
              <li>
                <a
                  href="#"
                  className="font-body text-sm text-muted transition-colors hover:text-primary"
                >
                  About
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="font-body text-sm text-muted transition-colors hover:text-primary"
                >
                  Blog
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="font-body text-sm text-muted transition-colors hover:text-primary"
                >
                  Careers
                </a>
              </li>
            </ul>
          </div>
          <div>
            <MonoLabel className="mb-4 block text-foreground">
              CONNECT
            </MonoLabel>
            <ul className="space-y-2">
              <li>
                <a
                  href="#"
                  className="font-body text-sm text-muted transition-colors hover:text-primary"
                >
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="font-body text-sm text-muted transition-colors hover:text-primary"
                >
                  X / Twitter
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="font-body text-sm text-muted transition-colors hover:text-primary"
                >
                  Discord
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-16 border-t border-border pt-8">
          <p className="font-mono text-xs text-muted">
            &copy; {new Date().getFullYear()} Tensient. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
