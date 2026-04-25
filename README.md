# mcp-evolution

[![npm version](https://img.shields.io/npm/v/mcp-evolution.svg)](https://www.npmjs.com/package/mcp-evolution)
[![license](https://img.shields.io/npm/l/mcp-evolution.svg)](./LICENSE)
[![CI](https://github.com/billyfranklim1/mcp-evolution/actions/workflows/ci.yml/badge.svg)](https://github.com/billyfranklim1/mcp-evolution/actions/workflows/ci.yml)

TypeScript MCP server for [Evolution API](https://github.com/EvolutionAPI/evolution-api) (WhatsApp) with instance pinning.

## Architecture

This server implements the [Model Context Protocol](https://modelcontextprotocol.io):

- **Transport**: stdio — the MCP host (Claude Desktop, Claude Code, etc.) spawns this process and speaks JSON-RPC over stdin/stdout.
- **Server**: uses the high-level `McpServer` class from the official TypeScript SDK, which handles capability negotiation and session lifecycle automatically.
- **Tools**: 50 tools registered via `registerTool()` with Zod-validated input schemas — the SDK enforces types before the handler runs.

All three connection parameters (API URL, API key, instance name) are pinned at startup via environment variables. The AI caller cannot switch instances mid-conversation.

## Tools

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
| `send_status` | Post a WhatsApp Status (story) update |

### Chat

| Tool | Description |
|------|-------------|
| `find_chats` | Find chats, optionally filtered with a Prisma-style `where` clause |
| `find_contacts` | Find contacts, optionally filtered |
| `find_messages` | Find messages by remoteJid with optional limit |
| `get_chat_history` | Get message history for a contact or group JID |
| `mark_as_read` | Mark one or more messages as read |
| `archive_chat` | Archive or unarchive a chat |
| `delete_message` | Delete a message for everyone |
| `fetch_profile_picture` | Fetch a contact's profile picture URL |
| `download_media` | Download media from a message as base64 |
| `send_presence` | Send a presence update (typing, recording, etc.) |
| `check_number` | Check whether phone numbers have WhatsApp accounts |

### Profile

| Tool | Description |
|------|-------------|
| `fetch_business_profile` | Fetch a contact's WhatsApp Business profile |
| `update_profile_name` | Update the instance's display name |
| `update_profile_status` | Update the instance's about/status text |
| `update_profile_picture` | Update the instance's profile picture |
| `remove_profile_picture` | Remove the instance's profile picture |
| `fetch_privacy` | Fetch current privacy settings |
| `update_privacy` | Update privacy settings |
| `update_block_status` | Block or unblock a contact |

### Group

| Tool | Description |
|------|-------------|
| `list_groups` | List all WhatsApp groups for the pinned instance |
| `get_group_info` | Get detailed info for a specific group by JID |
| `create_group` | Create a new WhatsApp group |
| `update_group_subject` | Update a group's name |
| `update_group_description` | Update a group's description |
| `update_group_picture` | Update a group's profile picture |
| `fetch_invite_code` | Fetch the invite code/link for a group |
| `revoke_invite_code` | Revoke and regenerate a group's invite code |
| `accept_invite` | Accept a group invite by code |
| `send_group_invite` | Send a group invite link to specific contacts |
| `update_participants` | Add, remove, promote, or demote group participants |
| `update_group_setting` | Update group settings (announcement mode, locked) |
| `leave_group` | Leave a group |
| `find_group_by_invite` | Get group info from an invite code without joining |

### Instance

| Tool | Description |
|------|-------------|
| `connection_state` | Get the current connection state of the instance |
| `restart_instance` | Restart the instance (reconnects without logging out) |
| `logout_instance` | Logout the instance (clears session) |
| `get_settings` | Get current instance settings |
| `set_settings` | Update instance settings |

### Webhook

| Tool | Description |
|------|-------------|
| `find_webhook` | Get the current webhook configuration |
| `set_webhook` | Configure the webhook |

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
| `EVOLUTION_INSTANCE` | Yes | Instance name created in Evolution API |

Copy `.env.example` to `.env` for local development.

## Use with Claude Desktop / Claude Code

Add to `~/.claude/claude_desktop_config.json` or project `.mcp.json`:

```json
{
  "mcpServers": {
    "whatsapp": {
      "command": "npx",
      "args": ["mcp-evolution"],
      "env": {
        "EVOLUTION_API_URL": "http://localhost:8080",
        "EVOLUTION_API_KEY": "your-evolution-api-key",
        "EVOLUTION_INSTANCE": "your-instance-name"
      }
    }
  }
}
```

Or point directly at the built binary if running from a local checkout:

```json
{
  "mcpServers": {
    "whatsapp": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-evolution/dist/index.js"],
      "env": {
        "EVOLUTION_API_URL": "http://localhost:8080",
        "EVOLUTION_API_KEY": "your-evolution-api-key",
        "EVOLUTION_INSTANCE": "your-instance-name"
      }
    }
  }
}
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
| `connection_state` | GET | `/instance/connectionState/{instance}` |
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
