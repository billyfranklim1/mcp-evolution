import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";

const schema = {
  where: z
    .record(z.unknown())
    .optional()
    .describe("Optional Prisma-style filter object"),
};

export function registerFindContacts(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "find_contacts",
    {
      title: "Find Contacts",
      description:
        "Find contacts for the pinned instance. Optionally filter with a Prisma-style where clause.",
      inputSchema: schema,
    },
    async (args) => {
      try {
        const payload = args.where ? { where: args.where } : {};
        const data = await client.post(`/chat/findContacts/${client.instanceName}`, payload);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
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
