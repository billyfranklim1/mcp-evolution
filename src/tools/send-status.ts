import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";

const schema = {
  type: z.enum(["text", "image", "video", "audio"]).describe("Status content type"),
  content: z.string().min(1).describe("Text content or URL/base64 of the media"),
  caption: z.string().optional().describe("Caption for media statuses"),
  backgroundColor: z.string().optional().describe("Background color hex for text statuses (e.g. #000000)"),
  font: z.number().int().min(0).max(4).optional().describe("Font style 0-4 for text statuses"),
  statusJidList: z.array(z.string()).optional().describe("Specific JIDs to send status to (omit for all contacts)"),
};

export function registerSendStatus(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "send_status",
    {
      title: "Send Status",
      description: "Post a WhatsApp Status update (story) via the pinned instance.",
      inputSchema: schema,
    },
    async (args) => {
      try {
        const payload: Record<string, unknown> = {
          type: args.type,
          content: args.content,
        };
        if (args.caption !== undefined) payload["caption"] = args.caption;
        if (args.backgroundColor !== undefined) payload["backgroundColor"] = args.backgroundColor;
        if (args.font !== undefined) payload["font"] = args.font;
        if (args.statusJidList !== undefined) payload["statusJidList"] = args.statusJidList;
        const data = await client.post(`/message/sendStatus/${client.instanceName}`, payload);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        if (e instanceof McpError) return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        throw e;
      }
    }
  );
}
