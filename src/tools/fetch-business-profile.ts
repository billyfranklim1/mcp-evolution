import { z } from "zod";
import type { ToolRegistry } from "../registry.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import { PhoneOrJidSchema } from "../schemas.js";

const schema = {
  number: PhoneOrJidSchema,
};

export function registerFetchBusinessProfile(server: ToolRegistry): void {
  server.registerTool(
    "fetch_business_profile",
    {
      title: "Fetch Business Profile",
      description: "Fetch the WhatsApp Business profile information of a contact via the selected instance.",
      inputSchema: schema,
    },
    async (args, { client }) => {
      try {
        const data = await client.post(`/chat/fetchBusinessProfile/${client.instanceName}`, {
          number: args.number,
        });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        if (e instanceof McpError) return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        throw e;
      }
    }
  );
}
