import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";
import { extractList } from "../util/extract-list.js";

export function registerFetchInstances(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "fetch_instances",
    {
      title: "Fetch Instances",
      description:
        "List Evolution WhatsApp instances (connection/debug). The MCP remains pinned to EVOLUTION_INSTANCE for other tools.",
      inputSchema: {},
    },
    async () => {
      try {
        const data = await client.get(`/instance/fetchInstances`);
        const rows = extractList(data, ["instances", "records"]);
        const list = rows.length > 0 ? rows : Array.isArray(data) ? data : [data];

        const normalized = (list as Record<string, unknown>[]).map((row) => {
          const instance =
            (row.instance as Record<string, unknown> | undefined) ??
            (row as Record<string, unknown>);
          return {
            name: instance.instanceName ?? instance.name ?? row.name,
            state: instance.state ?? instance.connectionStatus ?? row.connectionStatus,
            owner: instance.owner ?? instance.ownerJid ?? row.owner,
          };
        });

        return {
          content: [{ type: "text" as const, text: JSON.stringify(normalized, null, 2) }],
        };
      } catch (e) {
        if (e instanceof McpError) {
          return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        }
        throw e;
      }
    }
  );
}
