import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";
import { PhoneOrJidSchema } from "../schemas.js";

const schema = {
  number: PhoneOrJidSchema,
  name: z.string().min(1).describe("Poll question/title"),
  selectableCount: z.number().int().min(1).describe("Number of options the recipient can select"),
  values: z.array(z.string().min(1)).min(2).describe("Array of poll options (minimum 2)"),
};

export function registerSendPoll(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "send_poll",
    {
      title: "Send Poll",
      description: "Send a WhatsApp poll message via the pinned instance.",
      inputSchema: schema,
    },
    async (args) => {
      try {
        const data = await client.post(`/message/sendPoll/${client.instanceName}`, {
          number: args.number,
          name: args.name,
          selectableCount: args.selectableCount,
          values: args.values,
        });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        if (e instanceof McpError) return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        throw e;
      }
    }
  );
}
