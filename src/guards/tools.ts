import { ConfigError } from "../errors.js";

/** Every tool this server knows how to register. */
export const ALL_TOOLS = [
  // Read
  "list_instances",
  "connection_state",
  "list_groups",
  "find_chats",
  "find_contacts",
  "find_messages",
  "find_labels",
  "find_webhook",
  "find_group_by_invite",
  "get_chat_history",
  "get_group_info",
  "get_group_resolved_participants",
  "get_settings",
  "check_number",
  "download_media",
  "fetch_business_profile",
  "fetch_invite_code",
  "fetch_privacy",
  "fetch_profile_picture",
  // Send / interact
  "send_text",
  "send_media",
  "send_audio",
  "send_sticker",
  "send_location",
  "send_contact",
  "send_reaction",
  "send_poll",
  "send_list",
  "send_button",
  "send_presence",
  "send_group_invite",
  "send_status",
  "mark_as_read",
  "archive_chat",
  "handle_label",
  // State-changing / administrative
  "delete_message",
  "update_profile_name",
  "update_profile_status",
  "update_profile_picture",
  "remove_profile_picture",
  "update_privacy",
  "update_block_status",
  "create_group",
  "update_group_subject",
  "update_group_description",
  "update_group_picture",
  "update_group_setting",
  "update_participants",
  "revoke_invite_code",
  "accept_invite",
  "leave_group",
  "restart_instance",
  "logout_instance",
  "set_settings",
  "set_webhook",
] as const;

export type ToolName = (typeof ALL_TOOLS)[number];

/**
 * Tools disabled unless named explicitly in EVOLUTION_ALLOWED_TOOLS (or via @dangerous).
 * They change account/group state irreversibly, broadcast, or redirect traffic.
 */
export const DANGEROUS_TOOLS: readonly ToolName[] = [
  "send_status", // broadcasts to all contacts; can drop all linked devices (evolution-api #2196)
  "delete_message",
  "update_privacy",
  "update_profile_name",
  "update_profile_status",
  "update_profile_picture",
  "remove_profile_picture",
  "update_block_status",
  "create_group",
  "update_group_subject",
  "update_group_description",
  "update_group_picture",
  "update_group_setting",
  "update_participants",
  "revoke_invite_code",
  "accept_invite",
  "leave_group",
  "restart_instance",
  "logout_instance",
  "set_settings",
  "set_webhook", // can redirect every incoming message to an arbitrary URL
];

const DANGEROUS = new Set<string>(DANGEROUS_TOOLS);

export const TOOL_GROUPS: Readonly<Record<string, readonly ToolName[]>> = {
  "@read": [
    "list_instances",
    "connection_state",
    "list_groups",
    "find_chats",
    "find_contacts",
    "find_messages",
    "find_labels",
    "find_webhook",
    "find_group_by_invite",
    "get_chat_history",
    "get_group_info",
    "get_group_resolved_participants",
    "get_settings",
    "check_number",
    "download_media",
    "fetch_business_profile",
    "fetch_invite_code",
    "fetch_privacy",
    "fetch_profile_picture",
  ],
  "@send": ["send_text", "send_media", "send_audio", "send_presence", "mark_as_read"],
  "@default": ALL_TOOLS.filter((t) => !DANGEROUS.has(t)),
  "@dangerous": DANGEROUS_TOOLS,
};

export function isDangerous(tool: string): boolean {
  return DANGEROUS.has(tool);
}

/**
 * Resolve EVOLUTION_ALLOWED_TOOLS into the set of tools to register.
 * - unset/blank → every non-dangerous tool (@default)
 * - set → exactly the listed tools/groups; unknown names are a startup error.
 */
export function resolveAllowedTools(raw: string | undefined): Set<string> {
  if (!raw || !raw.trim()) return new Set(TOOL_GROUPS["@default"]);

  const known = new Set<string>(ALL_TOOLS);
  const result = new Set<string>();
  const unknown: string[] = [];

  for (const token of raw.split(",").map((s) => s.trim()).filter(Boolean)) {
    if (token.startsWith("@")) {
      const group = TOOL_GROUPS[token];
      if (!group) unknown.push(token);
      else group.forEach((t) => result.add(t));
    } else if (known.has(token)) {
      result.add(token);
    } else {
      unknown.push(token);
    }
  }

  if (unknown.length > 0) {
    throw new ConfigError(
      `EVOLUTION_ALLOWED_TOOLS has unknown entries: ${unknown.join(", ")}. ` +
        `Groups: ${Object.keys(TOOL_GROUPS).join(", ")}`
    );
  }
  if (result.size === 0) throw new ConfigError("EVOLUTION_ALLOWED_TOOLS resolved to no tools");
  return result;
}
