import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { MonoLabel } from "@/components/mono-label";

const mcpConfig = `{
  "mcpServers": {
    "tensient": {
      "url": "https://tensient.com/api/mcp",
      "headers": {
        "Authorization": "Bearer tns_YOUR_KEY_HERE"
      }
    }
  }
}`;

const cursorRuleTemplate = `# Session Protocol (Tensient)

At session start, call \`start_session\` via Tensient MCP.
At session end, call \`end_session\` with:
- summary
- filesChanged
- decisions
- debtAdded
- debtResolved
- observations
`;

export default function DocsContextLayerPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-[950px] px-6 pt-28 pb-24">
        <a
          href="/docs"
          className="mb-4 inline-block font-mono text-xs text-muted transition-colors hover:text-primary"
        >
          ← BACK TO DOCS
        </a>
        <MonoLabel className="mb-3 block text-primary">DOCS / CONTEXT LAYER</MonoLabel>
        <h1 className="font-display text-3xl font-bold tracking-tight mb-4">
          The Context Layer for Your Agents
        </h1>
        <p className="font-body text-base text-muted mb-8">
          Agents see code but not business context. Tensient gives every agent a shared,
          queryable world model so decisions, constraints, and learnings compound instead of
          resetting each run.
        </p>

        <section className="mb-8 rounded-lg border border-border bg-panel p-5">
          <h2 className="font-mono text-xs tracking-widest text-primary uppercase mb-3">
            Why This Matters
          </h2>
          <ul className="space-y-2 font-body text-sm text-muted">
            <li>Agents stop starting from zero on every task.</li>
            <li>Session outcomes become durable signals and synthesized knowledge.</li>
            <li>Orchestrators can build better prompts from real historical context.</li>
          </ul>
        </section>

        <section className="mb-8 rounded-lg border border-border bg-panel p-5">
          <h2 className="font-mono text-xs tracking-widest text-primary uppercase mb-3">
            Two Entry Points
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded border border-border p-4">
              <p className="font-mono text-[11px] tracking-widest text-primary uppercase mb-2">
                Simple
              </p>
              <p className="font-body text-sm text-muted">
                Cursor or Claude Code session: call <code>start_session</code>, work, then call{" "}
                <code>end_session</code>.
              </p>
            </div>
            <div className="rounded border border-border p-4">
              <p className="font-mono text-[11px] tracking-widest text-primary uppercase mb-2">
                Power
              </p>
              <p className="font-body text-sm text-muted">
                Orchestrator or agent swarm: query synthesis docs, open signals, and semantic
                search before spawning coding agents.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="font-mono text-xs tracking-widest text-primary uppercase mb-3">
            MCP Config
          </h2>
          <pre className="rounded-lg border border-border bg-panel p-4 overflow-x-auto text-xs font-mono text-foreground">
            {mcpConfig}
          </pre>
        </section>

        <section>
          <h2 className="font-mono text-xs tracking-widest text-primary uppercase mb-3">
            Cursor Rule Template
          </h2>
          <pre className="rounded-lg border border-border bg-panel p-4 overflow-x-auto text-xs font-mono text-foreground">
            {cursorRuleTemplate}
          </pre>
        </section>
      </main>
      <Footer />
    </>
  );
}
