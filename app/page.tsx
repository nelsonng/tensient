import { GlitchText } from "@/components/glitch-text";
import { SlantedButton } from "@/components/slanted-button";
import { MonoLabel } from "@/components/mono-label";
import { PanelCard } from "@/components/panel-card";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";

const steps = [
  {
    number: "01",
    title: "SET THE STRATEGY",
    description:
      "A manager types or speaks what matters most right now. AI distills it into a strategic reference document -- your team's single source of truth.",
  },
  {
    number: "02",
    title: "TEAM MEMBERS UNLOAD",
    description:
      "Instead of writing polished status reports, people dump what's on their mind. Blockers, progress, frustrations -- raw and unfiltered.",
  },
  {
    number: "03",
    title: "AI DOES THE SYNTHESIS",
    description:
      "Every update is compared against the strategy. Alignment scored, action items extracted, coaching delivered. The manager sees who's aligned and who needs attention.",
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
            are against your strategy.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <SlantedButton href="/sign-up">TRY IT FREE</SlantedButton>
            <SlantedButton variant="outline" href="#how-it-works">
              SEE HOW IT WORKS
            </SlantedButton>
          </div>
        </section>

        {/* See It In Action -- Before/After Mock */}
        <section className="mb-24">
          <MonoLabel className="mb-8 block">SEE IT IN ACTION</MonoLabel>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Before: Raw Input */}
            <PanelCard>
              <MonoLabel className="mb-4 block text-muted">
                WHAT YOUR TEAM MEMBER TYPES
              </MonoLabel>
              <p className="font-body text-base leading-relaxed text-muted italic">
                &quot;Honestly kind of a frustrating week. I spent most of
                Monday and Tuesday waiting on the design team for the homepage
                assets so I just started fixing auth bugs instead. Not sure if
                that was the best use of my time. Also had a couple meetings
                about the mobile app timeline that didn&apos;t really go
                anywhere. I think we need to figure out the payment integration
                before anything else but nobody seems to be owning that.&quot;
              </p>
            </PanelCard>

            {/* After: Structured Artifact */}
            <PanelCard className="border-primary/30">
              <MonoLabel className="mb-4 block text-primary">
                WHAT TENSIENT PRODUCES
              </MonoLabel>

              {/* Scores Row */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="text-center">
                  <span className="font-mono text-xs text-muted block mb-1">
                    ALIGNMENT
                  </span>
                  <span className="font-mono text-xl font-bold text-yellow-400">
                    59%
                  </span>
                </div>
                <div className="text-center">
                  <span className="font-mono text-xs text-muted block mb-1">
                    SENTIMENT
                  </span>
                  <span className="font-mono text-xl font-bold text-red-400">
                    -0.3
                  </span>
                </div>
              </div>

              <div className="border-t border-border pt-3 mb-3">
                <span className="font-mono text-xs text-muted block mb-2">
                  SYNTHESIZED UPDATE
                </span>
                <p className="font-body text-base leading-relaxed text-foreground">
                  Resolved authentication bugs (latency reduction). Blocked on
                  design assets for homepage. Payment integration ownership is
                  unresolved and at risk of slipping.
                </p>
              </div>

              <div className="border-t border-border pt-3 mb-3">
                <span className="font-mono text-xs text-muted block mb-2">
                  ACTION ITEMS
                </span>
                <ul className="space-y-1">
                  <li className="font-body text-base text-foreground flex items-start gap-2">
                    <span className="text-red-400 font-mono text-sm mt-0.5">
                      BLOCKED
                    </span>
                    <span>Follow up with design team on homepage assets</span>
                  </li>
                  <li className="font-body text-base text-foreground flex items-start gap-2">
                    <span className="text-yellow-400 font-mono text-sm mt-0.5">
                      ESCALATE
                    </span>
                    <span>Assign owner for payment integration</span>
                  </li>
                  <li className="font-body text-base text-primary flex items-start gap-2">
                    <span className="text-primary font-mono text-sm mt-0.5">
                      DONE
                    </span>
                    <span>Auth bug fixes shipped</span>
                  </li>
                </ul>
              </div>

              <div className="border-t border-border pt-3">
                <span className="font-mono text-xs text-muted block mb-2">
                  COACHING
                </span>
                <p className="font-body text-base leading-relaxed text-muted">
                  Good instinct to stay productive while blocked. Auth work
                  aligns with Q1 reliability goals. Flag the payment integration
                  gap to your lead -- unowned risks are the #1 cause of drift.
                </p>
              </div>
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
                  goals. But without constant comparison to strategy, alignment
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
            Your team&apos;s alignment is eroding right now. Measure it.
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
