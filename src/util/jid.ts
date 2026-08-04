import type { EvolutionClient } from "../evolution-client.js";
import { extractList } from "./extract-list.js";

export function isLidJid(jid: string): boolean {
  return jid.endsWith("@lid");
}

export function isPhoneJid(jid: string): boolean {
  return jid.endsWith("@s.whatsapp.net") || jid.endsWith("@c.us");
}

interface ChatRow {
  remoteJid?: string;
  lastMessage?: {
    key?: {
      remoteJid?: string;
      remoteJidAlt?: string;
    };
    pushName?: string;
  };
  pushName?: string;
  name?: string;
}

/**
 * Resolve alternate JIDs for the same chat (LID <-> phone).
 * Returns the input JID plus any mapped alternates from findChats.
 */
export async function resolveRelatedJids(
  client: EvolutionClient,
  remoteJid: string
): Promise<string[]> {
  const related = new Set<string>([remoteJid]);

  try {
    const raw = await client.post(`/chat/findChats/${client.instanceName}`, {});
    const chats = extractList(raw, ["chats", "records"]) as ChatRow[];

    for (const chat of chats) {
      const chatJid = chat.remoteJid;
      const alt = chat.lastMessage?.key?.remoteJidAlt;
      if (!chatJid) {
        continue;
      }

      if (chatJid === remoteJid && alt) {
        related.add(alt);
      }
      if (alt === remoteJid) {
        related.add(chatJid);
      }
      // Phone may be stored as chat.remoteJid while looking up LID, or vice versa
      if (chat.lastMessage?.key?.remoteJid === remoteJid && alt) {
        related.add(alt);
        related.add(chatJid);
      }
    }
  } catch {
    // Best-effort: still query the original JID alone
  }

  return [...related];
}

export function displayNameFromChat(chat: ChatRow): string | null {
  const lastPush = chat.lastMessage?.pushName?.trim();
  // Prefer non-self labels when last message is from peer; "Você"/"You" are weak
  const weak = new Set(["você", "voce", "you", "tu"]);
  if (lastPush && !weak.has(lastPush.toLowerCase())) {
    return lastPush;
  }
  // Do not fall back to weak self-labels — agent should use find_messages pushName
  return chat.pushName?.trim() || chat.name?.trim() || null;
}

export function phoneJidFromChat(chat: ChatRow): string | null {
  const jid = chat.remoteJid ?? "";
  if (isPhoneJid(jid)) {
    return jid;
  }
  const alt = chat.lastMessage?.key?.remoteJidAlt;
  return alt && isPhoneJid(alt) ? alt : null;
}
