import { GlitchText } from "@/components/glitch-text";
import { SlantedButton } from "@/components/slanted-button";
import { MonoLabel } from "@/components/mono-label";
import { PanelCard } from "@/components/panel-card";
import { ConversationDemo } from "@/components/conversation-demo";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";

export default function Home() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-[1200px] px-6 pt-32 pb-24">
        {/* Hero */}
        <section className="mb-24">
          <MonoLabel className="mb-4 block text-primary">
            FOR PEOPLE WHO THINK FOR A LIVING
          </MonoLabel>

          <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold uppercase tracking-tight mb-6 max-w-[900px]">
            Your context is scattered across ChatGPT, Claude, Gemini, and{" "}
            <span className="text-primary">
              47 tabs that forgot everything.
            </span>
          </h1>

          <p className="max-w-[640px] font-body text-lg leading-relaxed text-muted mb-10">
            Tensient is one place for all your thinking &mdash; with an AI
            that remembers.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <SlantedButton href="/sign-up">START A CONVERSATION</SlantedButton>
            <SlantedButton variant="outline" href="#how-it-works">
              SEE HOW IT WORKS
            </SlantedButton>
          </div>
        </section>

        {/* The Transformation */}
        <section id="how-it-works" className="mb-24">
          <MonoLabel className="mb-8 block">
            WHAT HAPPENS WHEN YOU THINK OUT LOUD
          </MonoLabel>
          <ConversationDemo />
          <div className="mt-8 max-w-[900px] mx-auto">
            <p className="font-body text-base text-muted leading-relaxed">
              Your AI reads your{" "}
              <span className="text-foreground font-medium">Brain</span>{" "}
              (personal notes),{" "}
              your{" "}
              <span className="text-foreground font-medium">Canon</span>{" "}
              (team strategy),{" "}
              and your selected{" "}
              <span className="text-foreground font-medium">Coaches</span>
              {" "}&mdash; before every response.
            </p>
          </div>
        </section>

        {/* Three Layers */}
        <section className="mb-24">
          <MonoLabel className="mb-8 block">THREE LAYERS OF CONTEXT</MonoLabel>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <PanelCard>
              <span className="font-mono text-xs text-primary mb-4 block">
                01
              </span>
              <h3 className="font-display text-xl font-bold uppercase tracking-tight mb-3">
                CONVERSATIONS
              </h3>
              <p className="font-body text-base leading-relaxed text-muted">
                Talk through anything &mdash; strategy, frustrations,
                decisions. Voice or text. AI responds with structure, actions,
                and the questions you should be asking. Every conversation is
                saved. Pick up where you left off.
              </p>
            </PanelCard>

            <PanelCard>
              <span className="font-mono text-xs text-primary mb-4 block">
                02
              </span>
              <h3 className="font-display text-xl font-bold uppercase tracking-tight mb-3">
                BRAIN
              </h3>
              <p className="font-body text-base leading-relaxed text-muted">
                Your personal context library. Notes, documents, PDFs,
                screenshots &mdash; anything you want the AI to know about
                you. It reads your Brain before every response. Your thinking
                compounds over time.
              </p>
            </PanelCard>

            <PanelCard>
              <span className="font-mono text-xs text-primary mb-4 block">
                03
              </span>
              <h3 className="font-display text-xl font-bold uppercase tracking-tight mb-3">
                CANON
              </h3>
              <p className="font-body text-base leading-relaxed text-muted">
                Your team&apos;s shared knowledge. Strategy docs, playbooks,
                company goals. When the AI responds, it checks your thinking
                against the Canon. Alignment isn&apos;t measured &mdash;
                it&apos;s built into every interaction.
              </p>
            </PanelCard>
          </div>
        </section>

        {/* Coaches */}
        <section className="mb-24">
          <MonoLabel className="mb-8 block">OPTIONAL COACHES</MonoLabel>
          <p className="font-body text-base text-muted mb-6 max-w-[640px]">
            Not every conversation needs coaching. But when it does, choose
            your lens.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <PanelCard>
              <h4 className="font-display text-base font-bold uppercase tracking-tight text-primary mb-1">
                JENSEN T5T
              </h4>
              <p className="font-body text-base text-muted">
                Prioritize ruthlessly. Top 5 only.
              </p>
            </PanelCard>
            <PanelCard>
              <h4 className="font-display text-base font-bold uppercase tracking-tight text-primary mb-1">
                PAUL GRAHAM
              </h4>
              <p className="font-body text-base text-muted">
                Think from first principles.
              </p>
            </PanelCard>
            <PanelCard>
              <h4 className="font-display text-base font-bold uppercase tracking-tight text-primary mb-1">
                WARTIME GENERAL
              </h4>
              <p className="font-body text-base text-muted">
                Hard truths, no comfort.
              </p>
            </PanelCard>
          </div>
          <p className="font-mono text-sm text-muted mt-4">
            Fork any coach. Build your own. Your coaches, your rules.
          </p>
        </section>

        {/* The Compounding Problem */}
        <section className="mb-24">
          <div className="max-w-[700px]">
            <MonoLabel className="mb-4 block text-primary">
              WHY THIS IS DIFFERENT
            </MonoLabel>
            <h2 className="font-display text-3xl font-bold uppercase tracking-tight mb-6">
              EVERY AI TOOL YOU USE FORGETS EVERYTHING
            </h2>
            <div className="space-y-4">
              <p className="font-body text-base leading-relaxed text-muted">
                The problem isn&apos;t any single AI tool. The problem is
                you use five of them &mdash; ChatGPT, Claude, Gemini, Grok,
                Perplexity &mdash; whichever is best this week. Every one of
                them starts from zero. Your thinking fragments more with
                every new tool you adopt.
              </p>
              <p className="font-body text-base leading-relaxed text-foreground">
                Tensient is the persistent layer. The AI changes underneath.
                Your Brain, your Canon, your conversation history &mdash;
                that stays. Your context compounds instead of scattering.
              </p>
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
          <p className="mx-auto max-w-[500px] font-body text-lg leading-relaxed text-foreground mb-8">
            Your thinking deserves a home.
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
