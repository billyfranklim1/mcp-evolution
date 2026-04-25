import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { EvolutionClient } from "../evolution-client.js";
import { registerListGroups } from "./list-groups.js";
import { registerFindChats } from "./find-chats.js";
import { registerFindContacts } from "./find-contacts.js";
import { registerFindMessages } from "./find-messages.js";
import { registerGetChatHistory } from "./get-chat-history.js";
import { registerSendText } from "./send-text.js";
import { registerSendMedia } from "./send-media.js";
import { registerGetGroupInfo } from "./get-group-info.js";

export function registerAllTools(server: McpServer, client: EvolutionClient): void {
  registerListGroups(server, client);
  registerFindChats(server, client);
  registerFindContacts(server, client);
  registerFindMessages(server, client);
  registerGetChatHistory(server, client);
  registerSendText(server, client);
  registerSendMedia(server, client);
  registerGetGroupInfo(server, client);
}
