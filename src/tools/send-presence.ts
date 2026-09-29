import { z } from "zod";
import type { ToolRegistry } from "../registry.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import { PhoneOrJidSchema } from "../schemas.js";

const schema = {
  number: PhoneOrJidSchema,
  presence: z.enum(["composing", "recording", "paused", "available", "unavailable"])
    .describe("Presence status to show: composing (typing), recording (audio), paused, available, unavailable"),
  delay: z.number().int().nonnegative().optional().describe("How long to show the presence in milliseconds"),
};

export function registerSendPresence(server: ToolRegistry): void {
  server.registerTool(
    "send_presence",
    {
      title: "Send Presence",
      description: "Send a presence update (typing, recording, etc.) to a chat via the selected instance.",
      inputSchema: schema,
    },
    async (args, { client }) => {
      try {
        const payload: Record<string, unknown> = {
          number: args.number,
          presence: args.presence,
        };
        if (args.delay !== undefined) payload["delay"] = args.delay;
        const data = await client.post(`/chat/sendPresence/${client.instanceName}`, payload);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        if (e instanceof McpError) return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        throw e;
      }
    }
  );
}
