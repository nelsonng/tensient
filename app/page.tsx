import { GlitchText } from "@/components/glitch-text";
import { SlantedButton } from "@/components/slanted-button";
import { MonoLabel } from "@/components/mono-label";
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
            Claude. GPT. Gemini.{" "}
            <span className="text-primary">Any model &mdash; one place.</span>
          </h1>

          <p className="max-w-[640px] font-body text-lg leading-relaxed text-muted mb-10">
            Start a conversation on whichever model fits. Your context persists
            across all of them.
          </p>

          <SlantedButton href="/sign-up">START A CONVERSATION</SlantedButton>
        </section>

        {/* Conversation Demo */}
        <section className="mb-24">
          <ConversationDemo />
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
