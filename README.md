# mcp-evolution

MCP server for [Evolution API](https://github.com/EvolutionAPI/evolution-api) (WhatsApp) with instance pinning.

## What it is

`mcp-evolution` is a [Model Context Protocol](https://modelcontextprotocol.io) server that wraps Evolution API v2 and exposes a set of safe WhatsApp tools to any MCP-compatible AI client (Claude Desktop, Claude Code, custom agents, etc.).

The server is **instance-pinned**: all three connection parameters (API URL, API key, and instance name) are fixed at startup via environment variables. This means the AI caller cannot accidentally address a different WhatsApp number or instance — every tool call goes to exactly one pre-configured instance.

## Why pinning matters

In multi-tenant or shared environments, a generic Evolution API tool could let a caller switch instances mid-conversation and leak messages or send to unintended recipients. By pinning at startup, `mcp-evolution` acts as a single-purpose gateway — safe to hand to an AI agent without guardrails around instance selection.

## Tools

| Tool | Description |
|------|-------------|
| `list_groups` | List all WhatsApp groups for the pinned instance |
| `find_chats` | Find chats, optionally filtered with a Prisma-style `where` clause |
| `find_contacts` | Find contacts, optionally filtered with a Prisma-style `where` clause |
| `find_messages` | Find messages by remoteJid (phone number or group JID) |
| `get_chat_history` | Get message history for a contact or group JID |
| `send_text` | Send a plain text message |
| `send_media` | Send an image, video, audio, or document |
| `get_group_info` | Get detailed info for a specific group by JID |

## Install

```bash
git clone https://github.com/billyfranklim1/mcp-evolution.git
cd mcp-evolution
npm install
```

## Configure

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

```env
EVOLUTION_API_URL=http://localhost:8080   # URL of your Evolution API instance
EVOLUTION_API_KEY=your-evolution-api-key  # Global API key from Evolution API config
EVOLUTION_INSTANCE=your-instance-name     # The instance name you created in Evolution API
```

## Run standalone

```bash
node server.js
```

The server starts on stdio and prints a confirmation to stderr:

```
mcp-evolution started (instance: your-instance-name)
```

## Use with Claude Desktop / Claude Code

Add to your MCP config (e.g. `~/.claude/claude_desktop_config.json` or project `.mcp.json`):

```json
{
  "mcpServers": {
    "whatsapp": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-evolution/server.js"],
      "env": {
        "EVOLUTION_API_URL": "http://localhost:8080",
        "EVOLUTION_API_KEY": "your-evolution-api-key",
        "EVOLUTION_INSTANCE": "your-instance-name"
      }
    }
  }
}
```

Restart Claude Desktop / Claude Code after saving.

## Use with an MCP gateway / OAuth proxy

If you run an HTTP MCP gateway (e.g. [mcp-gateway](https://github.com/mcp-ecosystem/mcp-gateway)), you can wrap this stdio server behind it. Set the env vars in the gateway's process environment or secrets manager rather than in the config file. The server itself has no HTTP surface — it only speaks stdio MCP.

## Evolution API endpoints wrapped

| Tool | Method | Path |
|------|--------|------|
| `list_groups` | GET | `/group/fetchAllGroups/{instance}` |
| `find_chats` | POST | `/chat/findChats/{instance}` |
| `find_contacts` | POST | `/chat/findContacts/{instance}` |
| `find_messages` / `get_chat_history` | POST | `/chat/findMessages/{instance}` |
| `send_text` | POST | `/message/sendText/{instance}` |
| `send_media` | POST | `/message/sendMedia/{instance}` |
| `get_group_info` | GET | `/group/findGroupInfos/{instance}` |

Requires Evolution API v2. Tested against the open-source self-hosted version.

## License

MIT — see [LICENSE](LICENSE).

## Disclaimer

This is community software and is not affiliated with, endorsed by, or supported by the Evolution API project or any WhatsApp entity.
