import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";
import { PhoneOrJidSchema } from "../schemas.js";

const ButtonSchema = z.object({
  type: z.enum(["reply", "url", "call"]).describe("Button type"),
  displayText: z.string().min(1).describe("Button label text"),
  id: z.string().optional().describe("Button ID for reply buttons"),
  url: z.string().url().optional().describe("URL for url-type buttons"),
  phoneNumber: z.string().optional().describe("Phone number for call-type buttons"),
});

const schema = {
  number: PhoneOrJidSchema,
  title: z.string().min(1).describe("Message title"),
  description: z.string().min(1).describe("Message body"),
  footer: z.string().optional().describe("Optional footer text"),
  buttons: z.array(ButtonSchema).min(1).describe("Array of buttons (max 3)"),
};

export function registerSendButton(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "send_button",
    {
      title: "Send Button",
      description: "Send a WhatsApp interactive button message via the pinned instance (max 3 buttons).",
      inputSchema: schema,
    },
    async (args) => {
      try {
        const payload: Record<string, unknown> = {
          number: args.number,
          title: args.title,
          description: args.description,
          buttons: args.buttons,
        };
        if (args.footer) payload["footer"] = args.footer;
        const data = await client.post(`/message/sendButtons/${client.instanceName}`, payload);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        if (e instanceof McpError) return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        throw e;
      }
    }
  );
}
