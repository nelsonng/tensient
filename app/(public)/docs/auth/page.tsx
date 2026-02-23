import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { MonoLabel } from "@/components/mono-label";

export default function DocsAuthPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-[900px] px-6 pt-28 pb-24">
        <a
          href="/docs"
          className="mb-4 inline-block font-mono text-xs text-muted transition-colors hover:text-primary"
        >
          ← BACK TO DOCS
        </a>
        <MonoLabel className="mb-3 block text-primary">DOCS / AUTH</MonoLabel>
        <h1 className="font-display text-3xl font-bold tracking-tight mb-6">
          Authentication Guide
        </h1>

        <div className="space-y-5 font-body text-base text-muted">
          <p>
            MCP requests use API key auth via <code>Authorization: Bearer tns_...</code>.
            Keys are workspace-scoped and user-attributed.
          </p>
          <p>
            The full key is displayed exactly once on creation. Tensient stores only a
            SHA-256 hash and a short prefix for UI display.
          </p>
          <p>
            Revoke keys in Settings → Developer. Revoked keys are rejected immediately
            and can no longer call the MCP endpoint.
          </p>
          <p>
            Security best practices: never commit keys, keep one key per client, rotate
            regularly, and revoke leaked keys immediately.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
