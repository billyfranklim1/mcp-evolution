import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";

const schema = {
  groupJid: z
    .string()
    .min(1)
    .describe("The group JID (e.g. 120363xxxxxxxx@g.us)"),
};

export function registerGetGroupInfo(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "get_group_info",
    {
      title: "Get Group Info",
      description: "Get detailed info for a specific WhatsApp group.",
      inputSchema: schema,
    },
    async (args) => {
      try {
        const data = await client.get(
          `/group/findGroupInfos/${client.instanceName}?groupJid=${encodeURIComponent(args.groupJid)}`
        );
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
