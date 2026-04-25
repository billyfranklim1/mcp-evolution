import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";
import { PhoneOrJidSchema } from "../schemas.js";

const RowSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  rowId: z.string().optional(),
});

const SectionSchema = z.object({
  title: z.string().min(1),
  rows: z.array(RowSchema).min(1),
});

const schema = {
  number: PhoneOrJidSchema,
  title: z.string().min(1).describe("Message title"),
  description: z.string().min(1).describe("Message body/description"),
  buttonText: z.string().min(1).describe("Text on the list button (e.g. 'View Options')"),
  footerText: z.string().optional().describe("Optional footer text"),
  sections: z.array(SectionSchema).min(1).describe("List sections, each with rows"),
};

export function registerSendList(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "send_list",
    {
      title: "Send List",
      description: "Send a WhatsApp list message (interactive menu) via the pinned instance.",
      inputSchema: schema,
    },
    async (args) => {
      try {
        const payload: Record<string, unknown> = {
          number: args.number,
          title: args.title,
          description: args.description,
          buttonText: args.buttonText,
          sections: args.sections,
        };
        if (args.footerText) payload["footerText"] = args.footerText;
        const data = await client.post(`/message/sendList/${client.instanceName}`, payload);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        if (e instanceof McpError) return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        throw e;
      }
    }
  );
}
