import { GlitchText } from "@/components/glitch-text";
import { SlantedButton } from "@/components/slanted-button";
import { MonoLabel } from "@/components/mono-label";
import { PanelCard } from "@/components/panel-card";
import { ArchetypeTabs } from "@/components/archetype-tabs";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";

const steps = [
  {
    number: "01",
    title: "SET YOUR GOALS",
    description:
      "A manager types or speaks what matters most right now. AI distills it into clear objectives -- your team's single source of truth.",
  },
  {
    number: "02",
    title: "SHARE YOUR THOUGHTS",
    description:
      "Instead of writing polished status reports, people dump what's on their mind. Blockers, progress, frustrations -- raw and unfiltered.",
  },
  {
    number: "03",
    title: "AI DOES THE SYNTHESIS",
    description:
      "Every thought is compared against the goals. Alignment scored, action items extracted, coaching delivered. The manager sees who's aligned and who needs attention.",
  },
];

export default function Home() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-[1200px] px-6 pt-32 pb-24">
        {/* Hero */}
        <section className="mb-24">
          <MonoLabel className="mb-4 block text-primary">
            FOR TEAMS THAT SHIP
          </MonoLabel>

          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold uppercase tracking-tight mb-6 max-w-[900px]">
            Your team can&apos;t summarize their week.{" "}
            <span className="text-primary">We fix that.</span>
          </h1>

          <p className="max-w-[640px] font-body text-lg leading-relaxed text-muted mb-10">
            Team members dump what&apos;s on their mind. AI turns it into
            aligned updates, surfaces blockers, and scores how on-track they
            are against your goals.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <SlantedButton href="/sign-up">TRY IT FREE</SlantedButton>
            <SlantedButton variant="outline" href="#how-it-works">
              SEE HOW IT WORKS
            </SlantedButton>
          </div>
        </section>

        {/* See It In Action -- Archetype Tabs */}
        <section className="mb-24">
          <MonoLabel className="mb-8 block">SEE IT IN ACTION</MonoLabel>
          <ArchetypeTabs />
        </section>

        {/* You Already Know These People */}
        <section className="mb-24">
          <MonoLabel className="mb-4 block text-primary">
            YOU ALREADY KNOW THESE PEOPLE
          </MonoLabel>
          <h2 className="font-display text-3xl font-bold uppercase tracking-tight mb-8 max-w-[700px]">
            SLACK CAN&apos;T SHOW YOU THIS.{" "}
            <span className="text-muted">TENSIENT CAN.</span>
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <PanelCard>
              <span className="font-display text-base font-bold uppercase tracking-tight text-primary block mb-1">
                Your team has a Marcus.
              </span>
              <MonoLabel className="block mb-3 text-muted">
                Senior Engineer
              </MonoLabel>
              <p className="font-body text-base leading-relaxed text-muted">
                His work is critical. His updates are hieroglyphics. Leadership
                can&apos;t see what he&apos;s doing.
              </p>
            </PanelCard>
            <PanelCard>
              <span className="font-display text-base font-bold uppercase tracking-tight text-primary block mb-1">
                Your team has a Sam.
              </span>
              <MonoLabel className="block mb-3 text-muted">
                Customer Success Lead
              </MonoLabel>
              <p className="font-body text-base leading-relaxed text-muted">
                He&apos;s drowning in tickets. You won&apos;t know until he
                quits.
              </p>
            </PanelCard>
            <PanelCard>
              <span className="font-display text-base font-bold uppercase tracking-tight text-primary block mb-1">
                Your team has a Jordan.
              </span>
              <MonoLabel className="block mb-3 text-muted">
                Product Manager
              </MonoLabel>
              <p className="font-body text-base leading-relaxed text-muted">
                She validated demand from two paying customers. Her update
                buried the lead.
              </p>
            </PanelCard>
            <PanelCard>
              <span className="font-display text-base font-bold uppercase tracking-tight text-primary block mb-1">
                Your team has a Priya.
              </span>
              <MonoLabel className="block mb-3 text-muted">
                Product Marketing
              </MonoLabel>
              <p className="font-body text-base leading-relaxed text-muted">
                Everything is &quot;game-changing.&quot; The real work is buried
                under adjectives.
              </p>
            </PanelCard>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="mb-24">
          <MonoLabel className="mb-8 block">HOW IT WORKS</MonoLabel>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {steps.map((step) => (
              <PanelCard key={step.number}>
                <span className="font-mono text-xs text-primary mb-4 block">
                  {step.number}
                </span>
                <h3 className="font-display text-xl font-bold uppercase tracking-tight mb-3">
                  {step.title}
                </h3>
                <p className="font-body text-base leading-relaxed text-muted">
                  {step.description}
                </p>
              </PanelCard>
            ))}
          </div>
        </section>

        {/* Why This Exists */}
        <section className="mb-24">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-5">
            <div className="md:col-span-2">
              <MonoLabel className="mb-4 block text-primary">
                WHY THIS EXISTS
              </MonoLabel>
              <h2 className="font-display text-3xl font-bold uppercase tracking-tight">
                SLACK IS WHERE ALIGNMENT GOES TO DIE
              </h2>
            </div>
            <div className="md:col-span-3 space-y-6">
              <div>
                <h4 className="font-display text-base font-bold uppercase tracking-tight text-foreground mb-2">
                  THE WEEKLY UPDATE IS EXCRUCIATING
                </h4>
                <p className="font-body text-base leading-relaxed text-muted">
                  You do standups every day. So why is it so hard to summarize
                  your week? Because most people can&apos;t synthesize. If you
                  can&apos;t synthesize, you can&apos;t see the system
                  you&apos;re in. If you can&apos;t see the system, you
                  can&apos;t make trade-offs. If you can&apos;t make trade-offs,
                  you can&apos;t prioritize.
                </p>
              </div>
              <div>
                <h4 className="font-display text-base font-bold uppercase tracking-tight text-foreground mb-2">
                  EVERY INTERACTION WITHOUT COACHING IS WASTED
                </h4>
                <p className="font-body text-base leading-relaxed text-muted">
                  We have access to the thinking of the best operators in the
                  world -- Huang, Graham, Benioff. But none of that expertise
                  shows up when people are actually doing the work. Every Slack
                  message and every status update is a missed coaching
                  opportunity.
                </p>
              </div>
              <div>
                <h4 className="font-display text-base font-bold uppercase tracking-tight text-foreground mb-2">
                  ALIGNMENT ERODES SILENTLY
                </h4>
                <p className="font-body text-base leading-relaxed text-muted">
                  Every word and every hour should move the company toward its
                  goals. But without constant comparison to your goals, alignment
                  erodes quietly. Most of what goes into Slack is noise. Tensient
                  measures how aligned your team is to what actually matters.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="text-center mb-12">
          <GlitchText
            text="TENSIENT"
            as="h2"
            className="text-4xl md:text-5xl mb-3"
          />
          <MonoLabel className="block text-muted mb-6">
            AMBIENT ENTERPRISE TENSION
          </MonoLabel>
          <p className="mx-auto max-w-[500px] font-body text-lg leading-relaxed text-foreground mb-8">
            Your team is already telling you everything you need to know. Start
            listening.
          </p>
          <div className="flex justify-center gap-4">
            <SlantedButton size="lg" href="/sign-up">
              START FREE
            </SlantedButton>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
