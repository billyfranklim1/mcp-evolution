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
      fromMe?: boolean;
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
  const fromMe = chat.lastMessage?.key?.fromMe === true;
  // lastMessage.pushName is the sender — ignore when fromMe (owner name, not contact)
  const weak = new Set(["você", "voce", "you", "tu"]);
  if (!fromMe && lastPush && !weak.has(lastPush.toLowerCase())) {
    return lastPush;
  }
  // Do not fall back to weak self-labels — agent should use find_messages pushName
  return chat.pushName?.trim() || chat.name?.trim() || null;
}

/** Best-effort last message text for chat list search/display. */
export function lastTextFromChat(chat: {
  lastMessage?: { message?: Record<string, unknown> | null };
}): string | null {
  const msg = chat.lastMessage?.message;
  if (!msg || typeof msg !== "object") {
    return null;
  }
  if (typeof msg.conversation === "string" && msg.conversation.trim()) {
    return msg.conversation;
  }
  const extended = msg.extendedTextMessage as { text?: string } | undefined;
  if (typeof extended?.text === "string" && extended.text.trim()) {
    return extended.text;
  }
  for (const key of ["imageMessage", "videoMessage", "documentMessage", "audioMessage"] as const) {
    const media = msg[key] as { caption?: string } | undefined;
    if (typeof media?.caption === "string" && media.caption.trim()) {
      return media.caption;
    }
  }
  return null;
}

export function phoneJidFromChat(chat: ChatRow): string | null {
  const jid = chat.remoteJid ?? "";
  if (isPhoneJid(jid)) {
    return jid;
  }
  const alt = chat.lastMessage?.key?.remoteJidAlt;
  return alt && isPhoneJid(alt) ? alt : null;
}
