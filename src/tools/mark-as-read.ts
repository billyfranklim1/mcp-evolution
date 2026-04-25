import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";

const MessageKeySchema = z.object({
  remoteJid: z.string().min(1).describe("JID of the chat"),
  fromMe: z.boolean().describe("Whether the message was sent by this instance"),
  id: z.string().min(1).describe("Message ID"),
});

const schema = {
  readMessages: z.array(MessageKeySchema).min(1).describe("Array of message keys to mark as read"),
};

export function registerMarkAsRead(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "mark_as_read",
    {
      title: "Mark as Read",
      description: "Mark one or more messages as read via the pinned WhatsApp instance.",
      inputSchema: schema,
    },
    async (args) => {
      try {
        const data = await client.post(`/chat/markMessageAsRead/${client.instanceName}`, {
          readMessages: args.readMessages,
        });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        if (e instanceof McpError) return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        throw e;
      }
    }
  );
}
