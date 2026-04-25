import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// ── Env validation ────────────────────────────────────────────────────────────

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;

if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) {
  console.error(
    'Missing required env vars: EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE'
  );
  process.exit(1);
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

async function apiGet(path) {
  const url = `${EVOLUTION_API_URL}${path}`;
  const res = await fetch(url, {
    headers: { apikey: EVOLUTION_API_KEY },
  });
  const body = await res.text();
  if (!res.ok) {
    return { isError: true, status: res.status, body };
  }
  try {
    return { ok: true, data: JSON.parse(body) };
  } catch {
    return { ok: true, data: body };
  }
}

async function apiPost(path, payload) {
  const url = `${EVOLUTION_API_URL}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: EVOLUTION_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const body = await res.text();
  if (!res.ok) {
    return { isError: true, status: res.status, body };
  }
  try {
    return { ok: true, data: JSON.parse(body) };
  } catch {
    return { ok: true, data: body };
  }
}

// ── Result builders ───────────────────────────────────────────────────────────

function ok(data) {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

function err(status, body) {
  return {
    isError: true,
    content: [{ type: 'text', text: `Error ${status}: ${body}` }],
  };
}

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'list_groups',
    description: 'List all WhatsApp groups for the pinned instance.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'find_chats',
    description: 'Find chats for the pinned instance. Optionally filter with a Prisma-style where clause.',
    inputSchema: {
      type: 'object',
      properties: {
        where: {
          type: 'object',
          description: 'Optional Prisma-style filter object.',
        },
      },
      required: [],
    },
  },
  {
    name: 'find_contacts',
    description: 'Find contacts for the pinned instance. Optionally filter with a Prisma-style where clause.',
    inputSchema: {
      type: 'object',
      properties: {
        where: {
          type: 'object',
          description: 'Optional Prisma-style filter object.',
        },
      },
      required: [],
    },
  },
  {
    name: 'find_messages',
    description: 'Find messages by remoteJid (phone number or group JID) for the pinned instance.',
    inputSchema: {
      type: 'object',
      properties: {
        remoteJid: {
          type: 'string',
          description: 'The JID or phone number to query messages for.',
        },
        limit: {
          type: 'number',
          description: 'Max messages to return (default 50).',
        },
      },
      required: ['remoteJid'],
    },
  },
  {
    name: 'get_chat_history',
    description: 'Get chat history for a specific contact or group JID.',
    inputSchema: {
      type: 'object',
      properties: {
        remoteJid: {
          type: 'string',
          description: 'The JID or phone number.',
        },
        limit: {
          type: 'number',
          description: 'Max messages to return (default 50).',
        },
      },
      required: ['remoteJid'],
    },
  },
  {
    name: 'send_text',
    description: 'Send a text message via the pinned WhatsApp instance.',
    inputSchema: {
      type: 'object',
      properties: {
        number: {
          type: 'string',
          description: 'Recipient JID or phone number (e.g. 5511999999999 or group@g.us).',
        },
        text: {
          type: 'string',
          description: 'Message text to send.',
        },
      },
      required: ['number', 'text'],
    },
  },
  {
    name: 'send_media',
    description: 'Send a media message (image, video, audio, document) via the pinned instance.',
    inputSchema: {
      type: 'object',
      properties: {
        number: {
          type: 'string',
          description: 'Recipient JID or phone number.',
        },
        mediatype: {
          type: 'string',
          description: 'Media type: image, video, audio, or document.',
          enum: ['image', 'video', 'audio', 'document'],
        },
        media: {
          type: 'string',
          description: 'URL or base64 of the media.',
        },
        fileName: {
          type: 'string',
          description: 'Optional filename (required for document type).',
        },
        caption: {
          type: 'string',
          description: 'Optional caption for the media.',
        },
      },
      required: ['number', 'mediatype', 'media'],
    },
  },
  {
    name: 'get_group_info',
    description: 'Get detailed info for a specific WhatsApp group.',
    inputSchema: {
      type: 'object',
      properties: {
        groupJid: {
          type: 'string',
          description: 'The group JID (e.g. 120363xxxxxxxx@g.us).',
        },
      },
      required: ['groupJid'],
    },
  },
];

// ── Tool handlers ─────────────────────────────────────────────────────────────

async function handleTool(name, args) {
  const inst = EVOLUTION_INSTANCE;

  switch (name) {
    case 'list_groups': {
      const r = await apiGet(`/group/fetchAllGroups/${inst}?getParticipants=false`);
      if (r.isError) return err(r.status, r.body);
      // Normalize to compact shape
      const groups = Array.isArray(r.data)
        ? r.data.map(({ id, subject, size, owner }) => ({ id, subject, size, owner }))
        : r.data;
      return ok(groups);
    }

    case 'find_chats': {
      const payload = args?.where ? { where: args.where } : {};
      const r = await apiPost(`/chat/findChats/${inst}`, payload);
      if (r.isError) return err(r.status, r.body);
      return ok(r.data);
    }

    case 'find_contacts': {
      const payload = args?.where ? { where: args.where } : {};
      const r = await apiPost(`/chat/findContacts/${inst}`, payload);
      if (r.isError) return err(r.status, r.body);
      return ok(r.data);
    }

    case 'find_messages':
    case 'get_chat_history': {
      if (!args?.remoteJid) {
        return err(400, 'remoteJid is required');
      }
      const payload = {
        where: { key: { remoteJid: args.remoteJid } },
        limit: args.limit ?? 50,
      };
      const r = await apiPost(`/chat/findMessages/${inst}`, payload);
      if (r.isError) return err(r.status, r.body);
      return ok(r.data);
    }

    case 'send_text': {
      if (!args?.number || !args?.text) {
        return err(400, 'number and text are required');
      }
      const r = await apiPost(`/message/sendText/${inst}`, {
        number: args.number,
        text: args.text,
      });
      if (r.isError) return err(r.status, r.body);
      return ok(r.data);
    }

    case 'send_media': {
      if (!args?.number || !args?.mediatype || !args?.media) {
        return err(400, 'number, mediatype, and media are required');
      }
      const payload = {
        number: args.number,
        mediatype: args.mediatype,
        media: args.media,
      };
      if (args.fileName) payload.fileName = args.fileName;
      if (args.caption) payload.caption = args.caption;
      const r = await apiPost(`/message/sendMedia/${inst}`, payload);
      if (r.isError) return err(r.status, r.body);
      return ok(r.data);
    }

    case 'get_group_info': {
      if (!args?.groupJid) {
        return err(400, 'groupJid is required');
      }
      const r = await apiGet(
        `/group/findGroupInfos/${inst}?groupJid=${encodeURIComponent(args.groupJid)}`
      );
      if (r.isError) return err(r.status, r.body);
      return ok(r.data);
    }

    default:
      return err(404, `Unknown tool: ${name}`);
  }
}

// ── MCP Server ────────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'mcp-evolution', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    return await handleTool(name, args);
  } catch (e) {
    return err(500, e.message ?? String(e));
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`mcp-evolution started (instance: ${EVOLUTION_INSTANCE})`);
