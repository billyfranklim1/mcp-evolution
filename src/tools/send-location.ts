import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EvolutionClient } from "../evolution-client.js";
import { PhoneOrJidSchema } from "../schemas.js";

const schema = {
  number: PhoneOrJidSchema,
  latitude: z.number().describe("Latitude in decimal degrees"),
  longitude: z.number().describe("Longitude in decimal degrees"),
  name: z.string().optional().describe("Location name/title"),
  address: z.string().optional().describe("Location address"),
};

export function registerSendLocation(server: McpServer, client: EvolutionClient): void {
  server.registerTool(
    "send_location",
    {
      title: "Send Location",
      description: "Send a location pin message via the pinned WhatsApp instance.",
      inputSchema: schema,
    },
    async (args) => {
      try {
        const payload: Record<string, unknown> = {
          number: args.number,
          latitude: args.latitude,
          longitude: args.longitude,
        };
        if (args.name) payload["name"] = args.name;
        if (args.address) payload["address"] = args.address;
        const data = await client.post(`/message/sendLocation/${client.instanceName}`, payload);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        if (e instanceof McpError) return { isError: true, content: [{ type: "text" as const, text: e.message }] };
        throw e;
      }
    }
  );
}
