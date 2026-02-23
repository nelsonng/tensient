import { SlantedButton } from "@/components/slanted-button";
import { MonoLabel } from "@/components/mono-label";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";

export default function Home() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-[1200px] px-6 pt-32 pb-24">
        {/* Hero */}
        <section className="mb-32">
          <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-6 max-w-[900px]">
            Every AI agent starts with full organizational context.
          </h1>
          <p className="max-w-[640px] font-body text-lg leading-relaxed text-muted mb-10">
            Your team talks through priorities, blockers, and decisions.
            Tensient extracts signals, synthesizes them into a live world model,
            and exposes it to any AI agent. Instead of your PM spending hours
            synthesizing across Slack, JIRA, and meeting notes &mdash; Tensient
            does it continuously.
          </p>
          <SlantedButton href="/sign-up">BUILD YOUR WORLD MODEL</SlantedButton>
        </section>

        {/* How It Works */}
        <section className="mb-32">
          <MonoLabel className="mb-10 block text-foreground">
            HOW IT WORKS
          </MonoLabel>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div>
              <MonoLabel className="mb-4 block">01 / SENSE</MonoLabel>
              <p className="font-body text-base leading-relaxed text-muted">
                Conversations today. Customer feedback, support tickets, product
                analytics tomorrow. Every source feeds the same pipeline.
                Signals are structured observations &mdash; not tickets, not
                tasks.
              </p>
            </div>
            <div>
              <MonoLabel className="mb-4 block">02 / SYNTHESIZE</MonoLabel>
              <p className="font-body text-base leading-relaxed text-muted">
                AI integrates new signals into a versioned world model. Every
                change is a commit. Every conclusion traces back to its source.
                Most tools accumulate noise. Tensient accumulates understanding.
              </p>
            </div>
            <div>
              <MonoLabel className="mb-4 block">03 / QUERY</MonoLabel>
              <p className="font-body text-base leading-relaxed text-muted">
                Any AI agent queries the world model via MCP. Connect with one API
                key. No SDK, no custom integration.
              </p>
            </div>
          </div>
        </section>

        {/* The Gap */}
        <section className="mb-32 max-w-[800px]">
          <MonoLabel className="mb-10 block text-foreground">
            THE PROBLEM
          </MonoLabel>
          <p className="font-body text-xl leading-relaxed text-foreground mb-6">
            Every enterprise tool you use is a thermometer. Dashboards measure.
            Reports describe. Analytics observe. None of them synthesize data
            into understanding. None of them close the loop.
          </p>
          <p className="font-body text-xl leading-relaxed text-foreground mb-8">
            Every company building AI agents is building a custom context layer
            from scratch. A 5-person team should operate like a 100-person team
            &mdash; but only if their agents know what the organization knows.
          </p>
          <p className="font-display text-2xl md:text-3xl font-bold tracking-tight text-primary">
            Tensient is the thermostat. Sense. Synthesize. Act.
          </p>
        </section>

        {/* Agent-Native */}
        <section className="mb-32 max-w-[800px]">
          <MonoLabel className="mb-10 block text-foreground">
            AGENT-NATIVE
          </MonoLabel>
          <p className="font-body text-lg leading-relaxed text-muted mb-4">
            Connect any AI agent in 30 seconds. Your agent gets 16 tools: read
            signals, query context, run synthesis, and write insights back.
          </p>
          <pre className="rounded-lg border border-border bg-panel p-4 overflow-x-auto font-mono text-xs text-foreground mb-5">
{`{
  "mcpServers": {
    "tensient": {
      "url": "https://tensient.com/api/mcp",
      "headers": { "Authorization": "Bearer tns_YOUR_KEY_HERE" }
    }
  }
}`}
          </pre>
          <div>
            <SlantedButton href="/docs" size="sm">READ THE DOCS</SlantedButton>
          </div>
        </section>

        {/* For Developers */}
        <section className="mb-32 max-w-[900px]">
          <MonoLabel className="mb-6 block text-foreground">FOR DEVELOPERS</MonoLabel>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border border-border rounded-lg bg-panel p-4">
              <p className="font-mono text-xs text-primary tracking-widest mb-2">01</p>
              <p className="font-body text-sm text-muted">Sign up and open your workspace.</p>
            </div>
            <div className="border border-border rounded-lg bg-panel p-4">
              <p className="font-mono text-xs text-primary tracking-widest mb-2">02</p>
              <p className="font-body text-sm text-muted">
                Generate an API key in Settings → Developer.
              </p>
            </div>
            <div className="border border-border rounded-lg bg-panel p-4">
              <p className="font-mono text-xs text-primary tracking-widest mb-2">03</p>
              <p className="font-body text-sm text-muted">
                Paste the config into your MCP client and call tools.
              </p>
            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="border-t border-border pt-16">
          <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight mb-8 max-w-[700px]">
            Your agents are starting from zero. Give them your world model.
          </h2>
          <SlantedButton href="/sign-up">BUILD YOUR WORLD MODEL</SlantedButton>
        </section>
      </main>
      <Footer />
    </>
  );
}
