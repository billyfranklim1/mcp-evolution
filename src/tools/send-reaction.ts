import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";

const schema = {
  key: z.object({
    remoteJid: z.string().min(1).describe("JID of the chat (e.g. 5511999999999@s.whatsapp.net)"),
    fromMe: z.boolean().describe("Whether the message was sent by this instance"),
    id: z.string().min(1).describe("Message ID to react to"),
  }).describe("Message key identifying the message to react to"),
  reaction: z.string().describe("Emoji reaction (e.g. '👍'). Send empty string to remove reaction."),
};

export function registerSendReaction(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "send_reaction",
    {
      title: "Send Reaction",
      description: "React to a WhatsApp message with an emoji via the pinned instance. Send empty string to remove reaction.",
      inputSchema: schema,
    },
    async (args) => {
      try {
        const data = await client.post(`/message/sendReaction/${client.instanceName}`, {
          key: args.key,
          reaction: args.reaction,
        });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        if (e instanceof McpError) return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        throw e;
      }
    }
  );
}
