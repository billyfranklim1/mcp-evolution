import { z } from "zod";
import type { ToolRegistry } from "../registry.js";

const schema = {
  includeState: z
    .boolean()
    .optional()
    .describe("When true, also fetch the connection state (open/close/connecting) of each instance."),
};

export function registerListInstances(server: ToolRegistry): void {
  server.registerTool(
    "list_instances",
    {
      title: "List Instances",
      description:
        "List the WhatsApp instances this server is allowed to use (names only) and which one is the default. " +
        "Pass one of these names as `instance` to other tools. Set includeState=true to also get each connection state.",
      inputSchema: schema,
      instanceScoped: false,
    },
    async (args, { http, config }) => {
      const instances = await Promise.all(
        config.instances.map(async (name) => {
          const item: { name: string; default: boolean; state?: string; error?: string } = {
            name,
            default: name === config.defaultInstance,
          };
          if (args.includeState) {
            try {
              const data = await http
                .forInstance(name)
                .get<{ instance?: { state?: string }; state?: string }>(`/instance/connectionState/${name}`);
              item.state = data?.instance?.state ?? data?.state ?? "unknown";
            } catch (e) {
              item.error = e instanceof Error ? e.message : String(e);
            }
          }
          return item;
        })
      );
      return { content: [{ type: "text" as const, text: JSON.stringify({ instances }, null, 2) }] };
    }
  );
}
