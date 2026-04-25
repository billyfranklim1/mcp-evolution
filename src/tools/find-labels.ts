import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";

interface RawLabel {
  id?: string;
  name?: string;
  color?: string | number;
  [key: string]: unknown;
}

export function registerFindLabels(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "find_labels",
    {
      title: "Find Labels",
      description:
        "List all WhatsApp labels for the pinned instance (requires WhatsApp Business). " +
        "Returns normalized { id, name, color } array — nested chat blobs dropped to prevent overflow.",
      inputSchema: {},
    },
    async () => {
      try {
        const data = await client.get(`/label/findLabels/${client.instanceName}`);
        const raw: RawLabel[] = Array.isArray(data) ? data : [];

        const normalized = raw.map(({ id, name, color }) => ({ id, name, color }));

        return { content: [{ type: "text" as const, text: JSON.stringify(normalized, null, 2) }] };
      } catch (e) {
        if (e instanceof McpError) return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        throw e;
      }
    }
  );
}
