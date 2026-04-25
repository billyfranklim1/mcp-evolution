import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";
import { PhoneOrJidSchema } from "../schemas.js";

const schema = {
  number: PhoneOrJidSchema,
  text: z.string().min(1).describe("Message text to send"),
};

export function registerSendText(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "send_text",
    {
      title: "Send Text",
      description: "Send a text message via the pinned WhatsApp instance.",
      inputSchema: schema,
    },
    async (args) => {
      try {
        const data = await client.post(`/message/sendText/${client.instanceName}`, {
          number: args.number,
          text: args.text,
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
        };
      } catch (e) {
        if (e instanceof McpError) {
          return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        }
        throw e;
      }
    }
  );
}
