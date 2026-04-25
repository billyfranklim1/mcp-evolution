import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";
import { PhoneOrJidSchema } from "../schemas.js";

const schema = {
  number: PhoneOrJidSchema,
  audio: z.string().min(1).describe("URL or base64-encoded audio (ogg/opus preferred for WhatsApp)"),
  encoding: z.boolean().optional().describe("Set true if audio is base64 encoded"),
  delay: z.number().int().nonnegative().optional().describe("Delay in milliseconds before sending"),
};

export function registerSendAudio(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "send_audio",
    {
      title: "Send Audio",
      description: "Send a WhatsApp audio (PTT voice note) via the pinned instance.",
      inputSchema: schema,
    },
    async (args) => {
      try {
        const payload: Record<string, unknown> = { number: args.number, audio: args.audio };
        if (args.encoding !== undefined) payload["encoding"] = args.encoding;
        if (args.delay !== undefined) payload["delay"] = args.delay;
        const data = await client.post(`/message/sendWhatsAppAudio/${client.instanceName}`, payload);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        if (e instanceof McpError) return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        throw e;
      }
    }
  );
}
