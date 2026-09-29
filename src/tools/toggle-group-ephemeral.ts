import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";

const schema = {
  groupJid: z.string().min(1).describe("Group JID (e.g. 120363000000000000@g.us)"),
  expiration: z
    .number()
    .int()
    .min(0)
    .describe("Ephemeral duration in seconds (0 = off). Common: 86400 (24h), 604800 (7d), 7776000 (90d)."),
};

export function registerToggleGroupEphemeral(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "toggle_group_ephemeral",
    {
      title: "Toggle Group Ephemeral",
      description:
        "Enable or disable disappearing messages on a WhatsApp group (expiration in seconds; 0 disables).",
      inputSchema: schema,
    },
    async (args) => {
      try {
        const data = await client.post(
          `/group/toggleEphemeral/${client.instanceName}?groupJid=${encodeURIComponent(args.groupJid)}`,
          { expiration: args.expiration }
        );
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        if (e instanceof McpError) {
          return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        }
        throw e;
      }
    }
  );
}
