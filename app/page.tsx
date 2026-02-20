import { SlantedButton } from "@/components/slanted-button";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";

export default function Home() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-[1200px] px-6 pt-32 pb-24">
        <section>
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
      </main>
      <Footer />
    </>
  );
}
