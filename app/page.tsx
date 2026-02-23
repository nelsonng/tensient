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
          <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold uppercase tracking-tight mb-6 max-w-[900px]">
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
                Any AI agent queries the world model via MCP &mdash; the open
                protocol agents use to connect to tools. Your coding agent, your
                support bot, your ops automation. A 5-person team operates like
                a 100-person team.
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
          <p className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-primary">
            Tensient is the thermostat. Sense. Synthesize. Act.
          </p>
        </section>

        {/* Agent-Native */}
        <section className="mb-32 max-w-[800px]">
          <MonoLabel className="mb-10 block text-foreground">
            AGENT-NATIVE
          </MonoLabel>
          <p className="font-body text-lg leading-relaxed text-muted mb-6">
            16 MCP tools. Sensors, actuators, and a synthesis engine. Not a
            document store &mdash; a queryable world model. Agents don&apos;t
            retrieve files. They ask questions: &ldquo;What are the open P1
            signals?&rdquo; &ldquo;What changed in the last 24
            hours?&rdquo; &ldquo;What patterns are emerging across customer
            feedback?&rdquo;
          </p>
          <p className="font-body text-lg leading-relaxed text-muted">
            The web app is the human interface. MCP is the agent interface. Same
            data. Same world model.
          </p>
        </section>

        {/* Closing CTA */}
        <section className="border-t border-border pt-16">
          <h2 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight mb-8 max-w-[700px]">
            Your agents are starting from zero. Give them your world model.
          </h2>
          <SlantedButton href="/sign-up">BUILD YOUR WORLD MODEL</SlantedButton>
        </section>
      </main>
      <Footer />
    </>
  );
}
