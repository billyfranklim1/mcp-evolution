import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";
import { PhoneOrJidSchema } from "../schemas.js";

const schema = {
  number: PhoneOrJidSchema,
  labelId: z.string().min(1).describe("Label ID to add or remove (get IDs from find_labels)"),
  action: z.enum(["add", "remove"]).describe("add: assign label to chat; remove: unassign label from chat"),
};

export function registerHandleLabel(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "handle_label",
    {
      title: "Handle Label",
      description: "Add or remove a WhatsApp label from a chat via the pinned instance (requires WhatsApp Business).",
      inputSchema: schema,
    },
    async (args) => {
      try {
        const data = await client.post(`/label/handleLabel/${client.instanceName}`, {
          number: args.number,
          labelId: args.labelId,
          action: args.action,
        });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        if (e instanceof McpError) return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        throw e;
      }
    }
  );
}
