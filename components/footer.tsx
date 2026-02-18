import { MonoLabel } from "./mono-label";

export function Footer() {
  return (
    <footer className="border-t border-border bg-background py-16">
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="flex flex-col sm:flex-row justify-between gap-8">
          <div>
            <MonoLabel className="mb-4 block text-foreground">LEGAL</MonoLabel>
            <ul className="space-y-2">
              <li>
                <a
                  href="/privacy"
                  className="font-body text-base text-muted transition-colors hover:text-primary"
                >
                  Privacy Policy
                </a>
              </li>
              <li>
                <a
                  href="/terms"
                  className="font-body text-base text-muted transition-colors hover:text-primary"
                >
                  Terms of Service
                </a>
              </li>
            </ul>
          </div>
          <div className="sm:text-right">
            <MonoLabel className="mb-4 block text-foreground">
              CONTACT
            </MonoLabel>
            <a
              href="mailto:hello@tensient.com"
              className="font-body text-base text-muted transition-colors hover:text-primary"
            >
              hello@tensient.com
            </a>
          </div>
        </div>
        <div className="mt-16 border-t border-border pt-8">
          <p className="font-mono text-sm text-muted">
            &copy; {new Date().getFullYear()} Tensient. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
