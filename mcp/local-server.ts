import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools";

async function main() {
  const workspaceId = process.env.TENSIENT_WORKSPACE_ID!;
  const userId = process.env.TENSIENT_USER_ID!;

  if (!workspaceId || !userId) {
    console.error(
      "Missing required env vars: TENSIENT_WORKSPACE_ID, TENSIENT_USER_ID"
    );
    process.exit(1);
  }

  const server = new McpServer({
    name: "tensient",
    version: "0.1.0",
  });

  registerTools(server, workspaceId, userId);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Tensient MCP server failed to start:", err);
  process.exit(1);
});
