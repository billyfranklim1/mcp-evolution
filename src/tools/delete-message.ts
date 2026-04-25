import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";

const schema = {
  id: z.string().min(1).describe("Message ID to delete"),
  remoteJid: z.string().min(1).describe("JID of the chat containing the message"),
  fromMe: z.boolean().describe("Whether the message was sent by this instance"),
  participant: z.string().optional().describe("Participant JID (required for group messages)"),
};

export function registerDeleteMessage(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "delete_message",
    {
      title: "Delete Message",
      description: "Delete a message for everyone via the pinned WhatsApp instance.",
      inputSchema: schema,
    },
    async (args) => {
      try {
        const payload: Record<string, unknown> = {
          id: args.id,
          remoteJid: args.remoteJid,
          fromMe: args.fromMe,
        };
        if (args.participant) payload["participant"] = args.participant;
        const data = await client.delete(`/chat/deleteMessageForEveryone/${client.instanceName}`, payload);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        if (e instanceof McpError) return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        throw e;
      }
    }
  );
}
