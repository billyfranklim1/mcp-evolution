# mcp-evolution

[![npm version](https://img.shields.io/npm/v/mcp-evolution.svg)](https://www.npmjs.com/package/mcp-evolution)
[![license](https://img.shields.io/npm/l/mcp-evolution.svg)](./LICENSE)
[![CI](https://github.com/billyfranklim1/mcp-evolution/actions/workflows/ci.yml/badge.svg)](https://github.com/billyfranklim1/mcp-evolution/actions/workflows/ci.yml)

TypeScript MCP server for [Evolution API](https://github.com/EvolutionAPI/evolution-api) (WhatsApp) with an instance allowlist and server-side guards (tool allowlist, recipient allowlist, secret redaction).

## Architecture

This server implements the [Model Context Protocol](https://modelcontextprotocol.io):

- **Transport**: stdio — the MCP host (Claude Desktop, Claude Code, etc.) spawns this process and speaks JSON-RPC over stdin/stdout.
- **Server**: uses the high-level `McpServer` class from the official TypeScript SDK, which handles capability negotiation and session lifecycle automatically.
- **Tools**: 55 tools registered via `registerTool()` with Zod-validated input schemas — the SDK enforces types before the handler runs.
- **Guards**: every tool goes through a registry that enforces the tool allowlist, the instance allowlist and the recipient allowlist, and redacts secrets from everything returned to the client.

The API URL, API key and the set of allowed instances are fixed at startup via environment variables. The AI caller can only pick an instance **from that list** — it can never address an instance outside it.

## Tools

Tools marked **(D)** are [dangerous](#dangerous-tools-disabled-by-default) and disabled unless explicitly enabled.

### Instances

| Tool | Description |
|------|-------------|
| `list_instances` | List the allowed instances (names only), the default one and, optionally, each connection state |

### Message

| Tool | Description |
|------|-------------|
| `send_text` | Send a plain text message |
| `send_media` | Send an image, video, audio, or document |
| `send_audio` | Send a WhatsApp audio (PTT voice note) |
| `send_sticker` | Send a sticker (webp) |
| `send_location` | Send a location pin |
| `send_contact` | Share one or more contacts (vCards) |
| `send_reaction` | React to a message with an emoji |
| `send_poll` | Send a poll message |
| `send_list` | Send an interactive list/menu message |
| `send_button` | Send an interactive button message |
| `send_status` (D) | Post a WhatsApp Status (story) update |

### Chat

| Tool | Description |
|------|-------------|
| `find_chats` | Find chats, optionally filtered with a Prisma-style `where` clause |
| `find_contacts` | Find contacts, optionally filtered |
| `find_messages` | Find messages by remoteJid with optional limit |
| `get_chat_history` | Get message history for a contact or group JID |
| `mark_as_read` | Mark one or more messages as read |
| `archive_chat` | Archive or unarchive a chat |
| `delete_message` (D) | Delete a message for everyone |
| `fetch_profile_picture` | Fetch a contact's profile picture URL |
| `download_media` | Download media from a message to a local file |
| `send_presence` | Send a presence update (typing, recording, etc.) |
| `check_number` | Check whether phone numbers have WhatsApp accounts |

### Profile

| Tool | Description |
|------|-------------|
| `fetch_business_profile` | Fetch a contact's WhatsApp Business profile |
| `update_profile_name` (D) | Update the instance's display name |
| `update_profile_status` (D) | Update the instance's about/status text |
| `update_profile_picture` (D) | Update the instance's profile picture |
| `remove_profile_picture` (D) | Remove the instance's profile picture |
| `fetch_privacy` | Fetch current privacy settings |
| `update_privacy` (D) | Update privacy settings |
| `update_block_status` (D) | Block or unblock a contact |

### Group

| Tool | Description |
|------|-------------|
| `list_groups` | List all WhatsApp groups for the selected instance |
| `get_group_info` | Get detailed info for a specific group by JID |
| `create_group` (D) | Create a new WhatsApp group |
| `update_group_subject` (D) | Update a group's name |
| `update_group_description` (D) | Update a group's description |
| `update_group_picture` (D) | Update a group's profile picture |
| `fetch_invite_code` | Fetch the invite code/link for a group |
| `revoke_invite_code` (D) | Revoke and regenerate a group's invite code |
| `accept_invite` (D) | Accept a group invite by code |
| `send_group_invite` | Send a group invite link to specific contacts |
| `update_participants` (D) | Add, remove, promote, or demote group participants |
| `update_group_setting` (D) | Update group settings (announcement mode, locked) |
| `leave_group` (D) | Leave a group |
| `find_group_by_invite` | Get group info from an invite code without joining |

### Instance

| Tool | Description |
|------|-------------|
| `connection_state` | Get the current connection state of the instance |
| `restart_instance` (D) | Restart the instance (reconnects without logging out) |
| `logout_instance` (D) | Logout the instance (clears session) |
| `get_settings` | Get current instance settings |
| `set_settings` (D) | Update instance settings |

### Webhook

| Tool | Description |
|------|-------------|
| `find_webhook` | Get the current webhook configuration |
| `set_webhook` (D) | Configure the webhook |

### Label

| Tool | Description |
|------|-------------|
| `find_labels` | List all labels (requires WhatsApp Business) |
| `handle_label` | Add or remove a label from a chat |

## Install & run via npx

```bash
EVOLUTION_API_URL=http://localhost:8080 \
EVOLUTION_API_KEY=your-key \
EVOLUTION_INSTANCE=your-instance \
npx mcp-evolution
```

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `EVOLUTION_API_URL` | Yes | Base URL of your Evolution API (e.g. `http://localhost:8080`) |
| `EVOLUTION_API_KEY` | Yes | Global API key from Evolution API config |
| `EVOLUTION_INSTANCE` | One of these two | Single instance name (legacy / simplest mode) |
| `EVOLUTION_INSTANCES` | One of these two | Comma-separated list of allowed instances, e.g. `personal,support` |
| `EVOLUTION_DEFAULT_INSTANCE` | No | Instance used when a call omits `instance` (must be in `EVOLUTION_INSTANCES`) |
| `EVOLUTION_ALLOWED_TOOLS` | No | Comma-separated tool names and/or groups. Unset = every non-dangerous tool |
| `EVOLUTION_ALLOWED_RECIPIENTS` | No | Comma-separated recipient allowlist (numbers, JIDs, LIDs, group JIDs). Unset = unrestricted |
| `EVOLUTION_ALLOWED_RECIPIENTS__<INSTANCE>` | No | Per-instance recipient allowlist; overrides the global one for that instance |
| `EVOLUTION_BASIC_AUTH` | No | Base64 `user:password` sent as `Authorization: Basic …` (e.g. nginx in front of Evolution) |
| `EVOLUTION_DB_URL` | No | Evolution Postgres URL, only for `get_group_resolved_participants` |

Invalid configuration (unknown tool names, default instance outside the list, both `EVOLUTION_INSTANCE` and `EVOLUTION_INSTANCES` set, malformed recipients…) aborts at startup with a message that never includes secret values.

### Instances

- **One instance** (`EVOLUTION_INSTANCE=foo`, or `EVOLUTION_INSTANCES=foo`): works exactly like before — no `instance` parameter is added and every call goes to `foo`.
- **Several instances** (`EVOLUTION_INSTANCES=foo,bar`): every instance-bound tool gets an optional `instance` parameter, validated against the list (a zod `enum`). Omitted → `EVOLUTION_DEFAULT_INSTANCE`; if no default is set the call fails asking for `instance`. Any value outside the list is rejected before any HTTP request is made.
- `list_instances` returns the configured names and which one is the default; `includeState: true` also queries each connection state.

### Tool allowlist — `EVOLUTION_ALLOWED_TOOLS`

When set, **only** the listed tools are registered; everything else does not even show up in `tools/list`. Entries are tool names or groups:

| Group | Tools |
|-------|-------|
| `@read` | `list_instances`, `connection_state`, `list_groups`, `find_chats`, `find_contacts`, `find_messages`, `find_labels`, `find_webhook`, `find_group_by_invite`, `get_chat_history`, `get_group_info`, `get_group_resolved_participants`, `get_settings`, `check_number`, `download_media`, `fetch_business_profile`, `fetch_invite_code`, `fetch_privacy`, `fetch_profile_picture` |
| `@send` | `send_text`, `send_media`, `send_audio`, `send_presence`, `mark_as_read` |
| `@default` | every tool except the dangerous ones (what you get when the variable is unset) |
| `@dangerous` | every dangerous tool (see below) |

Examples: `@read,@send` · `@read,send_text` · `@default,send_status`.

### Dangerous tools (disabled by default)

These tools change account/group state irreversibly, broadcast, or can redirect traffic. They are **not registered** unless named explicitly in `EVOLUTION_ALLOWED_TOOLS` (or via `@dangerous`):

| Tool | Why |
|------|-----|
| `send_status` | Broadcasts to all contacts; known to disconnect every linked device ([evolution-api#2196](https://github.com/EvolutionAPI/evolution-api/issues/2196)) |
| `delete_message` | Deletes messages for everyone |
| `update_privacy` | Changes account privacy |
| `update_profile_name`, `update_profile_status`, `update_profile_picture`, `remove_profile_picture` | Change the public profile |
| `update_block_status` | Blocks/unblocks contacts |
| `create_group`, `update_group_subject`, `update_group_description`, `update_group_picture`, `update_group_setting`, `update_participants`, `revoke_invite_code`, `accept_invite`, `leave_group` | Change group state/membership |
| `restart_instance`, `logout_instance` | Disrupt or destroy the WhatsApp session |
| `set_settings` | Changes instance behaviour (auto-read, reject calls, always online…) |
| `set_webhook` | Can redirect every incoming event to an arbitrary URL |

To re-enable, list them: `EVOLUTION_ALLOWED_TOOLS=@default,send_status,delete_message` (or `@default,@dangerous` for the pre-0.6 behaviour).

### Recipient allowlist — `EVOLUTION_ALLOWED_RECIPIENTS`

When set, any tool argument that identifies a chat — `number`, `numbers[]`, `remoteJid`, `jid`, `groupJid`, `chat`, `participants[]`, `statusJidList[]`, including nested ones such as `readMessages[].remoteJid` or `key.remoteJid` — must match the list, otherwise the call is rejected before reaching Evolution (the error names the rejected value, never the list). In addition:

- `find_chats`, `find_contacts` and `list_groups` only return entries in the list; `find_group_by_invite` refuses groups outside it.
- `send_status` requires an explicit `statusJidList`; `accept_invite` is refused.

Matching normalises both sides to digits of the part before `@` (dropping a `:device` suffix). Accepted forms: `5511999999999`, `+55 (11) 99999-9999`, `5511999999999@s.whatsapp.net`, `…@c.us`, `123456789012345@lid`, `120363…@g.us`. A LID is a different identifier from the phone number — if a contact reaches you as `@lid`, list that LID too. Write Brazilian mobiles in full (`55 DD 9XXXXXXXX`); legacy JIDs without the extra `9` then match as well.

**Per instance:** `EVOLUTION_ALLOWED_RECIPIENTS__<INSTANCE>` replaces the global list for that instance. `<INSTANCE>` is the instance name upper-cased with every character outside `A-Z0-9` replaced by `_` (e.g. `billy-franklim.2` → `EVOLUTION_ALLOWED_RECIPIENTS__BILLY_FRANKLIM_2`). Use `*` as the value to leave one instance unrestricted while a global list applies to the others.

### Secret redaction

The API key, `EVOLUTION_BASIC_AUTH` (both the base64 value and the decoded `user:password`/password) and passwords embedded in `EVOLUTION_API_URL`/`EVOLUTION_DB_URL` are replaced by `[REDACTED]` in every tool result and error returned to the MCP client, including Evolution error bodies that echo request headers.

## Use with Claude Code / Claude Desktop

Keep secrets out of the MCP JSON by putting them in an env file and loading it with Node's `--env-file` (Node ≥ 20.6):

```bash
# /path/to/credentials.env  (chmod 600)
EVOLUTION_API_URL=https://evolution.example.com
EVOLUTION_API_KEY=...
EVOLUTION_BASIC_AUTH=...
```

Single instance, read + basic send, one test recipient (`.mcp.json` or `claude mcp add-json`):

```json
{
  "mcpServers": {
    "whatsapp": {
      "command": "node",
      "args": [
        "--env-file=/path/to/credentials.env",
        "/absolute/path/to/mcp-evolution/dist/index.js"
      ],
      "env": {
        "EVOLUTION_INSTANCE": "my-instance",
        "EVOLUTION_ALLOWED_TOOLS": "@read,@send",
        "EVOLUTION_ALLOWED_RECIPIENTS": "5511999999999"
      }
    }
  }
}
```

Several instances with a default and per-instance recipients:

```json
{
  "mcpServers": {
    "whatsapp": {
      "command": "node",
      "args": ["--env-file=/path/to/credentials.env", "/absolute/path/to/mcp-evolution/dist/index.js"],
      "env": {
        "EVOLUTION_INSTANCES": "personal,support",
        "EVOLUTION_DEFAULT_INSTANCE": "personal",
        "EVOLUTION_ALLOWED_TOOLS": "@read,@send",
        "EVOLUTION_ALLOWED_RECIPIENTS__PERSONAL": "5511999999999,123456789012345@lid",
        "EVOLUTION_ALLOWED_RECIPIENTS__SUPPORT": "*"
      }
    }
  }
}
```

If a variable is defined both in `env` and in the file, Node keeps the value from `env` (the process environment wins). Keep secrets in the file and the guards in the JSON, where they are easy to review. With `npx` (`"command": "npx", "args": ["mcp-evolution"]`) there is no `--env-file`, so every variable has to go in `env`.

## Run as a remote server (Streamable HTTP)

Set `MCP_TRANSPORT=http` to serve MCP over HTTP instead of stdio, so clients connect by URL and nothing runs on their machine. The server is stateless: each request gets a fresh MCP server with the same guards.

| Variable | Default | Notes |
|---|---|---|
| `MCP_TRANSPORT` | `stdio` | `stdio` or `http` |
| `MCP_AUTH_TOKEN` | — | **Required** in HTTP mode, at least 32 characters. Clients send `Authorization: Bearer <token>` |
| `PORT` | `3000` | |
| `HOST` | `0.0.0.0` | Use `127.0.0.1` behind a reverse proxy |
| `MCP_HTTP_PATH` | `/mcp` | |

`GET /health` answers without auth for uptime checks. Put the server behind HTTPS (nginx, Caddy) and keep the guards (`EVOLUTION_ALLOWED_TOOLS`, `EVOLUTION_ALLOWED_RECIPIENTS`) in its environment: the token only proves who is calling, the guards still decide what they can do.

Register it in Claude Code:

```bash
claude mcp add --transport http evolution https://your-host/mcp --header "Authorization: Bearer $MCP_AUTH_TOKEN"
```

## Development

```bash
# Install dependencies
npm install

# Run in dev mode (no build step)
npm run dev

# Build TypeScript → dist/
npm run build

# Run tests
npm test

# Start from built output
npm start
```

## Evolution API endpoints wrapped

| Tool | Method | Path |
|------|--------|------|
| `send_text` | POST | `/message/sendText/{instance}` |
| `send_media` | POST | `/message/sendMedia/{instance}` |
| `send_audio` | POST | `/message/sendWhatsAppAudio/{instance}` |
| `send_sticker` | POST | `/message/sendSticker/{instance}` |
| `send_location` | POST | `/message/sendLocation/{instance}` |
| `send_contact` | POST | `/message/sendContact/{instance}` |
| `send_reaction` | POST | `/message/sendReaction/{instance}` |
| `send_poll` | POST | `/message/sendPoll/{instance}` |
| `send_list` | POST | `/message/sendList/{instance}` |
| `send_button` | POST | `/message/sendButtons/{instance}` |
| `send_status` | POST | `/message/sendStatus/{instance}` |
| `find_chats` | POST | `/chat/findChats/{instance}` |
| `find_contacts` | POST | `/chat/findContacts/{instance}` |
| `find_messages` / `get_chat_history` | POST | `/chat/findMessages/{instance}` |
| `mark_as_read` | POST | `/chat/markMessageAsRead/{instance}` |
| `archive_chat` | POST | `/chat/archiveChat/{instance}` |
| `delete_message` | DELETE | `/chat/deleteMessageForEveryone/{instance}` |
| `fetch_profile_picture` | POST | `/chat/fetchProfilePictureUrl/{instance}` |
| `download_media` | POST | `/chat/getBase64FromMediaMessage/{instance}` |
| `send_presence` | POST | `/chat/sendPresence/{instance}` |
| `check_number` | POST | `/chat/whatsappNumbers/{instance}` |
| `fetch_business_profile` | POST | `/chat/fetchBusinessProfile/{instance}` |
| `update_profile_name` | POST | `/chat/updateProfileName/{instance}` |
| `update_profile_status` | POST | `/chat/updateProfileStatus/{instance}` |
| `update_profile_picture` | POST | `/chat/updateProfilePicture/{instance}` |
| `remove_profile_picture` | DELETE | `/chat/removeProfilePicture/{instance}` |
| `fetch_privacy` | GET | `/chat/fetchPrivacySettings/{instance}` |
| `update_privacy` | POST | `/chat/updatePrivacySettings/{instance}` |
| `update_block_status` | POST | `/chat/updateBlockStatus/{instance}` |
| `list_groups` | GET | `/group/fetchAllGroups/{instance}` |
| `get_group_info` | GET | `/group/findGroupInfos/{instance}` |
| `create_group` | POST | `/group/create/{instance}` |
| `update_group_subject` | POST | `/group/updateGroupSubject/{instance}?groupJid=` |
| `update_group_description` | POST | `/group/updateGroupDescription/{instance}?groupJid=` |
| `update_group_picture` | POST | `/group/updateGroupPicture/{instance}?groupJid=` |
| `fetch_invite_code` | GET | `/group/inviteCode/{instance}?groupJid=` |
| `revoke_invite_code` | POST | `/group/revokeInviteCode/{instance}?groupJid=` |
| `accept_invite` | GET | `/group/acceptInviteCode/{instance}?inviteCode=` |
| `send_group_invite` | POST | `/group/sendInvite/{instance}` |
| `update_participants` | POST | `/group/updateParticipant/{instance}?groupJid=` |
| `update_group_setting` | POST | `/group/updateSetting/{instance}?groupJid=` |
| `leave_group` | DELETE | `/group/leaveGroup/{instance}?groupJid=` |
| `find_group_by_invite` | GET | `/group/inviteInfo/{instance}?inviteCode=` |
| `connection_state` / `list_instances` | GET | `/instance/connectionState/{instance}` |
| `restart_instance` | POST | `/instance/restart/{instance}` |
| `logout_instance` | DELETE | `/instance/logout/{instance}` |
| `get_settings` | GET | `/settings/find/{instance}` |
| `set_settings` | POST | `/settings/set/{instance}` |
| `find_webhook` | GET | `/webhook/find/{instance}` |
| `set_webhook` | POST | `/webhook/set/{instance}` |
| `find_labels` | GET | `/label/findLabels/{instance}` |
| `handle_label` | POST | `/label/handleLabel/{instance}` |

Requires Evolution API v2.

## License

MIT — see [LICENSE](LICENSE).

## Disclaimer

Community software, not affiliated with Evolution API or any WhatsApp entity.
