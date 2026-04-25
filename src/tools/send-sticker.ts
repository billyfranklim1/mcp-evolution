import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";
import { PhoneOrJidSchema } from "../schemas.js";

const schema = {
  number: PhoneOrJidSchema,
  sticker: z.string().min(1).describe("URL or base64 of the sticker (webp format)"),
};

export function registerSendSticker(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "send_sticker",
    {
      title: "Send Sticker",
      description: "Send a sticker message via the pinned WhatsApp instance.",
      inputSchema: schema,
    },
    async (args) => {
      try {
        const data = await client.post(`/message/sendSticker/${client.instanceName}`, {
          number: args.number,
          sticker: args.sticker,
        });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        if (e instanceof McpError) return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        throw e;
      }
    }
  );
}
