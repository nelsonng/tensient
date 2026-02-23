import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { MonoLabel } from "@/components/mono-label";

const toolGroups = [
  {
    name: "Sensors",
    tools: [
      "list_signals(status, priority, humanPriority, since, before, search, limit)",
      "list_synthesis_documents()",
      "get_synthesis_history(limit)",
      "list_brain_documents(search, since, before, limit)",
      "list_canon_documents(search, since, before, limit)",
      "list_conversations(limit)",
      "get_conversation_messages(conversationId)",
    ],
  },
  {
    name: "Actuators",
    tools: [
      "create_signal(content, conversationId, messageId, aiPriority)",
      "update_signal(signalId, humanPriority, status)",
      "create_brain_document(title, content)",
      "create_canon_document(title, content)",
      "update_brain_document(documentId, title, content)",
    ],
  },
  {
    name: "Search + Synthesis",
    tools: ["search_similar(query, scope, limit)", "run_synthesis()"],
  },
  {
    name: "Delete",
    tools: ["delete_signal(signalId)", "delete_document(documentId)"],
  },
];

export default function DocsToolsPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-[950px] px-6 pt-28 pb-24">
        <a
          href="/docs"
          className="mb-4 inline-block font-mono text-xs text-muted transition-colors hover:text-primary"
        >
          ← BACK TO DOCS
        </a>
        <MonoLabel className="mb-3 block text-primary">DOCS / TOOLS</MonoLabel>
        <h1 className="font-display text-3xl font-bold tracking-tight mb-6">
          Tool Reference
        </h1>
        <p className="font-body text-base text-muted mb-8">
          Tensient MCP exposes 16 tools grouped by read, write, search, synthesis,
          and delete operations.
        </p>

        <div className="space-y-4">
          {toolGroups.map((group) => (
            <section key={group.name} className="rounded-lg border border-border bg-panel p-4">
              <h2 className="font-mono text-xs tracking-widest text-primary uppercase mb-3">
                {group.name}
              </h2>
              <ul className="space-y-2">
                {group.tools.map((tool) => (
                  <li key={tool} className="font-mono text-xs text-foreground">
                    {tool}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
