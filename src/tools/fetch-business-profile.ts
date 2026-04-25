import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";
import { PhoneOrJidSchema } from "../schemas.js";

const schema = {
  number: PhoneOrJidSchema,
};

export function registerFetchBusinessProfile(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "fetch_business_profile",
    {
      title: "Fetch Business Profile",
      description: "Fetch the WhatsApp Business profile information of a contact via the pinned instance.",
      inputSchema: schema,
    },
    async (args) => {
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
