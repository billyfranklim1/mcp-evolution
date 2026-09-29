import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";

const schema = {
  number: z.string().min(1).describe("Chat phone number or JID (recipient)"),
  text: z.string().min(1).describe("New message text"),
  key: z
    .object({
      remoteJid: z.string().min(1).describe("Chat JID of the original message"),
      fromMe: z.boolean().describe("Must be true for messages you sent"),
      id: z.string().min(1).describe("Message ID to edit"),
    })
    .describe("Original message key"),
};

export function registerUpdateMessage(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "update_message",
    {
      title: "Update Message",
      description: "Edit a previously sent text message via the pinned WhatsApp instance.",
      inputSchema: schema,
    },
    async (args) => {
      try {
        const data = await client.post(`/chat/updateMessage/${client.instanceName}`, {
          number: args.number,
          text: args.text,
          key: args.key,
        });
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
