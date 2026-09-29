import { extractList } from "./extract-list.js";

/**
 * Evolution findMessages responses vary by version:
 * - Message[]
 * - { messages: Message[] }
 * - { messages: { total, pages, currentPage, records: Message[] } }
 */
export function extractMessages(data: unknown): unknown[] {
  return extractList(data, ["messages", "records"]);
}
