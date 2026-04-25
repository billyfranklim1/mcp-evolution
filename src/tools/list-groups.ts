import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";

interface GroupItem {
  id: string;
  subject: string;
  size?: number;
  owner?: string;
}

const schema = {
  search: z
    .string()
    .optional()
    .describe("Case-insensitive substring match against group subject. Omit for no filter."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(500)
    .default(50)
    .optional()
    .describe("Max results to return (default 50, max 500)."),
};

export function registerListGroups(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "list_groups",
    {
      title: "List Groups",
      description: "List WhatsApp groups for the pinned instance. Supports search and limit to prevent large payloads.",
      inputSchema: schema,
    },
    async (args) => {
      try {
        const data = await client.get<GroupItem[]>(
          `/group/fetchAllGroups/${client.instanceName}?getParticipants=false`
        );

        let groups = Array.isArray(data) ? data : [];

        // Client-side search filter (Evolution API has no query filter)
        if (args.search) {
          const needle = args.search.toLowerCase();
          groups = groups.filter((g) => g.subject?.toLowerCase().includes(needle));
        }

        // Sort by subject asc for stable results
        groups.sort((a, b) => (a.subject ?? "").localeCompare(b.subject ?? ""));

        // Cap results
        const limit = args.limit ?? 50;
        groups = groups.slice(0, limit);

        // Normalize to compact shape — drop owner to shrink payload
        const normalized = groups.map(({ id, subject, size }) => ({ id, subject, size }));

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
