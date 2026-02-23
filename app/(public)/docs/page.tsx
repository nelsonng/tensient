import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { MonoLabel } from "@/components/mono-label";

const sections = [
  {
    href: "/docs/quickstart",
    title: "Integration Quickstart",
    description: "Connect an MCP client to Tensient in about 3 minutes.",
  },
  {
    href: "/docs/tools",
    title: "Tool Reference",
    description: "All 16 MCP tools with categories and key parameters.",
  },
  {
    href: "/docs/auth",
    title: "Authentication Guide",
    description: "How API keys are generated, scoped, and revoked.",
  },
];

export default function DocsPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-[1000px] px-6 pt-28 pb-24">
        <MonoLabel className="mb-3 block text-primary">DOCUMENTATION</MonoLabel>
        <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight mb-4">
          MCP Integration Docs
        </h1>
        <p className="font-body text-base text-muted max-w-[700px] mb-10">
          Tensient exposes an MCP endpoint so any compatible agent can read and write
          organizational context using the same world model as the web app.
        </p>

        <div className="grid gap-4">
          {sections.map((section) => (
            <a
              key={section.href}
              href={section.href}
              className="block rounded-lg border border-border bg-panel p-5 hover:border-primary/40 transition-colors"
            >
              <p className="font-mono text-xs tracking-widest text-primary uppercase mb-2">
                {section.title}
              </p>
              <p className="font-body text-sm text-muted">{section.description}</p>
            </a>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
