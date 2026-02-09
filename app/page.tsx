import { GlitchText } from "@/components/glitch-text";
import { SlantedButton } from "@/components/slanted-button";
import { MonoLabel } from "@/components/mono-label";
import { PanelCard } from "@/components/panel-card";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";

const primitives = [
  {
    label: "THE CANON",
    heading: "STRATEGIC VECTOR",
    body: "Download your strategy. Speak it, paste it, type it. AI distills your direction into strategic pillars. One source of truth for the entire organization.",
    metric: "DRIFT BASELINE",
    metricValue: "0.00",
  },
  {
    label: "THE CAPTURE",
    heading: "SIGNAL EXTRACTION",
    body: "Unload what is stuck. The system extracts signal from noise, detects drift against The Canon, and clears the mental cache. Reporting becomes unblocking.",
    metric: "DRIFT SCORE",
    metricValue: "0.12",
  },
  {
    label: "THE ARTIFACT",
    heading: "PROCESSED TRUTH",
    body: "Actions surfaced. Sentiment read. Traction measured. Every capture produces a high-fidelity artifact with drift score, action items, and coaching feedback.",
    metric: "TRACTION",
    metricValue: "94%",
  },
];

const mechanics = [
  {
    label: "01",
    title: "THE THERAPIST EFFECT",
    description:
      "Do not ask what they did. Ask what is blocking them. The system validates frustration, flags blockers, and clears the emotional cache so ICs can flow.",
  },
  {
    label: "02",
    title: "THE MIRROR OF COMPETENCE",
    description:
      "Turns \"I fixed some stuff\" into \"Refactored authentication to reduce latency by 200ms.\" Gives ICs the language to describe their own value.",
  },
  {
    label: "03",
    title: "MONDAY AMMO",
    description:
      "Pre-loaded context for Monday morning. The one critical task, the links you need, three hours of deep work before your first meeting. Flow state on demand.",
  },
  {
    label: "04",
    title: "TRACTION STREAKS",
    description:
      "Gamified alignment. Every capture scored against The Canon. Teams compete on coherence, not volume. No one wants to be the slipping wheel.",
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
            ENTERPRISE TRACTION CONTROL
          </MonoLabel>

          <GlitchText
            text="TENSIENT"
            className="text-5xl md:text-6xl mb-6"
          />

          <p className="max-w-[640px] font-body text-lg leading-relaxed text-muted mb-10">
            Your team generates noise. We extract signal. Every update measured
            against the strategy. Drift detected. Traction scored. The lightbulb
            becomes a laser.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <SlantedButton>REQUEST ACCESS</SlantedButton>
            <SlantedButton variant="outline">VIEW DOCS</SlantedButton>
          </div>
        </section>

        {/* The Three Primitives */}
        <section id="product" className="mb-24">
          <MonoLabel className="mb-8 block">CORE PRIMITIVES</MonoLabel>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {primitives.map((p) => (
              <PanelCard key={p.label}>
                <MonoLabel className="mb-3 block text-primary">
                  {p.label}
                </MonoLabel>
                <h3 className="font-display text-xl font-bold uppercase tracking-tight mb-3">
                  {p.heading}
                </h3>
                <p className="font-body text-sm leading-relaxed text-muted mb-6">
                  {p.body}
                </p>
                <div className="border-t border-border pt-4">
                  <MonoLabel className="block mb-1">{p.metric}</MonoLabel>
                  <span className="font-mono text-2xl font-bold text-primary">
                    {p.metricValue}
                  </span>
                </div>
              </PanelCard>
            ))}
          </div>
        </section>

        {/* The Thesis */}
        <section className="mb-24">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-5">
            <div className="md:col-span-2">
              <MonoLabel className="mb-4 block text-primary">
                THE THESIS
              </MonoLabel>
              <h2 className="font-display text-3xl font-bold uppercase tracking-tight">
                SLACK IS SLOP
              </h2>
            </div>
            <div className="md:col-span-3">
              <p className="font-body text-base leading-relaxed text-muted mb-6">
                Tools like Slack and Teams rely on indefinite optimism. They
                assume 500 smart people self-organizing in a chat box will
                naturally align with company goals. This is false. Humans
                generate as much slop as AI. Without a forcing function,
                collaboration tools generate heat, not light.
              </p>
              <p className="font-body text-base leading-relaxed text-foreground">
                A functioning enterprise should feel like directed energy. Every
                ounce of caloric energy burned by the team hits the exact same
                target. Most companies act like lightbulbs: bright and hot, but
                scattered. That is entropy. Tensient is the infrastructure for
                coherence. We turn the lightbulb into a laser.
              </p>
            </div>
          </div>
        </section>

        {/* Growth Mechanics */}
        <section className="mb-24">
          <MonoLabel className="mb-8 block">GROWTH MECHANICS</MonoLabel>
          <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-2">
            {mechanics.map((m) => (
              <div
                key={m.label}
                className="bg-background p-8"
              >
                <span className="font-mono text-xs text-muted mb-3 block">
                  {m.label}
                </span>
                <h3 className="font-display text-lg font-bold uppercase tracking-tight mb-3">
                  {m.title}
                </h3>
                <p className="font-body text-sm leading-relaxed text-muted">
                  {m.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Protocols Marketplace Teaser */}
        <section id="protocols" className="mb-24">
          <PanelCard className="p-8 md:p-12">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 items-center">
              <div>
                <MonoLabel className="mb-4 block text-primary">
                  PROTOCOL MARKETPLACE
                </MonoLabel>
                <h2 className="font-display text-2xl font-bold uppercase tracking-tight mb-4">
                  SHAREABLE INTELLIGENCE
                </h2>
                <p className="font-body text-base leading-relaxed text-muted">
                  Protocols are the digital brains that process your captures.
                  Fork them. Tune them. Share them across teams. Build your own
                  and publish to the marketplace. Like Figma Community for
                  organizational intelligence.
                </p>
              </div>
              <div className="space-y-3">
                {[
                  { name: "Jensen T5T", category: "LEADERSHIP", uses: "2.4K" },
                  {
                    name: "Growth Mindset",
                    category: "PERSONAL",
                    uses: "1.8K",
                  },
                  {
                    name: "Wartime General",
                    category: "STRATEGY",
                    uses: "956",
                  },
                  { name: "YC Protocol", category: "STARTUP", uses: "3.1K" },
                ].map((protocol) => (
                  <div
                    key={protocol.name}
                    className="flex items-center justify-between border-b border-border pb-3"
                  >
                    <div>
                      <span className="font-display text-sm font-bold uppercase tracking-tight">
                        {protocol.name}
                      </span>
                      <span className="ml-3 font-mono text-xs text-muted">
                        {protocol.category}
                      </span>
                    </div>
                    <span className="font-mono text-xs text-primary">
                      {protocol.uses} USES
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </PanelCard>
        </section>

        {/* CTA */}
        <section className="text-center mb-12">
          <GlitchText
            text="BUILD COHERENCE"
            as="h2"
            className="text-4xl md:text-5xl mb-6"
          />
          <p className="mx-auto max-w-[500px] font-body text-base leading-relaxed text-muted mb-8">
            Stop measuring activity. Start measuring alignment. Tensient turns
            organizational noise into directed energy.
          </p>
          <div className="flex justify-center gap-4">
            <SlantedButton size="lg">REQUEST ACCESS</SlantedButton>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
