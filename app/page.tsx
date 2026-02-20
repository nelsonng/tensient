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
            Every AI on your team starts from zero.
          </h1>
          <p className="max-w-[640px] font-body text-lg leading-relaxed text-muted mb-10">
            No shared strategy. No shared context. Tensient puts your
            team&apos;s strategy in one place &mdash; every conversation pulls
            from it.
          </p>
          <SlantedButton href="/sign-up">GET STARTED FREE</SlantedButton>
        </section>
      </main>
      <Footer />
    </>
  );
}
