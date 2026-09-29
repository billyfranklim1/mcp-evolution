import { z } from "zod";
import type { ToolRegistry } from "../registry.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import { PhoneOrJidSchema } from "../schemas.js";

const schema = {
  number: PhoneOrJidSchema,
  status: z.enum(["block", "unblock"]).describe("block: block the contact; unblock: unblock the contact"),
};

export function registerUpdateBlockStatus(server: ToolRegistry): void {
  server.registerTool(
    "update_block_status",
    {
      title: "Update Block Status",
      description: "Block or unblock a WhatsApp contact via the selected instance.",
      inputSchema: schema,
    },
    async (args, { client }) => {
      try {
        const data = await client.post(`/chat/updateBlockStatus/${client.instanceName}`, {
          number: args.number,
          status: args.status,
        });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        if (e instanceof McpError) return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        throw e;
      }
    }
  );
}
