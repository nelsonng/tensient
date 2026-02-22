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
            Your org already knows everything. Your agents know nothing.
          </h1>
          <p className="max-w-[640px] font-body text-lg leading-relaxed text-muted mb-10">
            Team conversations are full of signal &mdash; priorities, blockers,
            market shifts. Tensient synthesizes them into a world model any AI
            agent can query.
          </p>
          <SlantedButton href="/sign-up">BUILD YOUR WORLD MODEL</SlantedButton>
        </section>
      </main>
      <Footer />
    </>
  );
}
