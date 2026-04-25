import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";
import { PhoneOrJidSchema } from "../schemas.js";

const ContactSchema = z.object({
  fullName: z.string().min(1).describe("Contact's full name"),
  wuid: z.string().min(1).describe("WhatsApp UID (e.g. 5511999999999@s.whatsapp.net)"),
  phoneNumber: z.string().min(1).describe("Phone number in international format"),
  organization: z.string().optional().describe("Contact's organization/company"),
  email: z.string().email().optional().describe("Contact's email address"),
  url: z.string().url().optional().describe("Contact's website URL"),
});

const schema = {
  number: PhoneOrJidSchema,
  contact: z.array(ContactSchema).min(1).describe("Array of contacts to share"),
};

export function registerSendContact(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "send_contact",
    {
      title: "Send Contact",
      description: "Share one or more contacts (vCards) via the pinned WhatsApp instance.",
      inputSchema: schema,
    },
    async (args) => {
      try {
        const data = await client.post(`/message/sendContact/${client.instanceName}`, {
          number: args.number,
          contact: args.contact,
        });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        if (e instanceof McpError) return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        throw e;
      }
    }
  );
}
