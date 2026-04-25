import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";

const schema = {
  numbers: z.array(z.string().min(1)).min(1).describe(
    "Array of phone numbers to check (e.g. ['5511999999999']). Returns whether each number has WhatsApp and their JID."
  ),
};

export function registerCheckNumber(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "check_number",
    {
      title: "Check Number",
      description: "Check whether phone numbers have WhatsApp accounts. Returns exists, jid, and number for each.",
      inputSchema: schema,
    },
    async (args) => {
      try {
        const data = await client.post(`/chat/whatsappNumbers/${client.instanceName}`, {
          numbers: args.numbers,
        });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        if (e instanceof McpError) return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        throw e;
      }
    }
  );
}
