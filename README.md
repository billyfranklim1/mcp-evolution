# mcp-evolution

[![npm version](https://img.shields.io/npm/v/mcp-evolution.svg)](https://www.npmjs.com/package/mcp-evolution)
[![license](https://img.shields.io/npm/l/mcp-evolution.svg)](./LICENSE)
[![CI](https://github.com/billyfranklim1/mcp-evolution/actions/workflows/ci.yml/badge.svg)](https://github.com/billyfranklim1/mcp-evolution/actions/workflows/ci.yml)

TypeScript MCP server for [Evolution API](https://github.com/EvolutionAPI/evolution-api) (WhatsApp) with instance pinning.

## Architecture

This server implements the [Model Context Protocol](https://modelcontextprotocol.io):

- **Transport**: stdio — the MCP host (Claude Desktop, Claude Code, etc.) spawns this process and speaks JSON-RPC over stdin/stdout.
- **Server**: uses the high-level `McpServer` class from the official TypeScript SDK, which handles capability negotiation and session lifecycle automatically.
- **Tools**: eight tools registered via `registerTool()` with Zod-validated input schemas — the SDK enforces types before the handler runs.

All three connection parameters (API URL, API key, instance name) are pinned at startup via environment variables. The AI caller cannot switch instances mid-conversation.

## Tools

| Tool | Description |
|------|-------------|
| `list_groups` | List all WhatsApp groups for the pinned instance |
| `find_chats` | Find chats, optionally filtered with a Prisma-style `where` clause |
| `find_contacts` | Find contacts, optionally filtered with a Prisma-style `where` clause |
| `find_messages` | Find messages by remoteJid with optional limit |
| `get_chat_history` | Get message history for a contact or group JID |
| `send_text` | Send a plain text message |
| `send_media` | Send an image, video, audio, or document |
| `get_group_info` | Get detailed info for a specific group by JID |

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
| `list_groups` | GET | `/group/fetchAllGroups/{instance}` |
| `find_chats` | POST | `/chat/findChats/{instance}` |
| `find_contacts` | POST | `/chat/findContacts/{instance}` |
| `find_messages` / `get_chat_history` | POST | `/chat/findMessages/{instance}` |
| `send_text` | POST | `/message/sendText/{instance}` |
| `send_media` | POST | `/message/sendMedia/{instance}` |
| `get_group_info` | GET | `/group/findGroupInfos/{instance}` |

Requires Evolution API v2.

## License

MIT — see [LICENSE](LICENSE).

## Disclaimer

Community software, not affiliated with Evolution API or any WhatsApp entity.
