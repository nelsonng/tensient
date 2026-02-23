import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { MonoLabel } from "@/components/mono-label";

const configExample = `{
  "mcpServers": {
    "tensient": {
      "url": "https://tensient.com/api/mcp",
      "headers": {
        "Authorization": "Bearer tns_YOUR_KEY_HERE"
      }
    }
  }
}`;

export default function DocsQuickstartPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-[900px] px-6 pt-28 pb-24">
        <MonoLabel className="mb-3 block text-primary">DOCS / QUICKSTART</MonoLabel>
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight mb-6">
          Integration Quickstart
        </h1>

        <ol className="space-y-4 list-decimal list-inside font-body text-base text-muted">
          <li>Sign in to Tensient and open your workspace settings.</li>
          <li>Go to the DEVELOPER tab and click GENERATE NEW KEY.</li>
          <li>Copy the key immediately. It is shown once.</li>
          <li>Paste this into your MCP client configuration:</li>
        </ol>

        <pre className="mt-4 rounded-lg border border-border bg-panel p-4 overflow-x-auto text-xs font-mono text-foreground">
          {configExample}
        </pre>

        <p className="font-body text-base text-muted mt-6">
          Test connection by asking your agent to run <code>list_signals</code> or
          <code> list_conversations</code>.
        </p>
      </main>
      <Footer />
    </>
  );
}
