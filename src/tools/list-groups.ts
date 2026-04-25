import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";

interface GroupItem {
  id: string;
  subject: string;
  size?: number;
  owner?: string;
}

export function registerListGroups(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "list_groups",
    {
      title: "List Groups",
      description: "List all WhatsApp groups for the pinned instance.",
      inputSchema: {},
    },
    async () => {
      try {
        const data = await client.get<GroupItem[]>(
          `/group/fetchAllGroups/${client.instanceName}?getParticipants=false`
        );
        // Normalize to compact shape
        const groups = Array.isArray(data)
          ? data.map(({ id, subject, size, owner }) => ({ id, subject, size, owner }))
          : data;
        return {
          content: [{ type: "text" as const, text: JSON.stringify(groups, null, 2) }],
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
