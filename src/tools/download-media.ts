import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";

const schema = {
  message: z.object({
    key: z.object({
      remoteJid: z.string().min(1).describe("Chat JID"),
      fromMe: z.boolean().describe("Whether sent by this instance"),
      id: z.string().min(1).describe("Message ID"),
    }),
  }).describe("Message object containing the media"),
  convertToMp4: z.boolean().optional().describe("Convert audio to mp4 format"),
};

export function registerDownloadMedia(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "download_media",
    {
      title: "Download Media",
      description: "Download media from a WhatsApp message as base64 via the pinned instance.",
      inputSchema: schema,
    },
    async (args) => {
      try {
        const payload: Record<string, unknown> = { message: args.message };
        if (args.convertToMp4 !== undefined) payload["convertToMp4"] = args.convertToMp4;
        const data = await client.post(`/chat/getBase64FromMediaMessage/${client.instanceName}`, payload);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        if (e instanceof McpError) return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        throw e;
      }
    }
  );
}
