import { createServer as createHttpServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ConfigError } from "./errors.js";

export interface HttpOptions {
  port: number;
  host: string;
  /** Path the MCP endpoint is served on (default "/mcp"). */
  path: string;
  /** Bearer token every MCP request must present. Always required. */
  authToken: string;
}

const MIN_TOKEN_LENGTH = 32;
const MAX_BODY_BYTES = 25 * 1024 * 1024; // media payloads can be large base64 strings

/** Parse HTTP transport options from env. Throws ConfigError. */
export function loadHttpOptions(env: NodeJS.ProcessEnv = process.env): HttpOptions {
  const authToken = env.MCP_AUTH_TOKEN?.trim();
  if (!authToken) {
    throw new ConfigError("MCP_AUTH_TOKEN is required when MCP_TRANSPORT=http (the endpoint can send WhatsApp messages)");
  }
  if (authToken.length < MIN_TOKEN_LENGTH) {
    throw new ConfigError(`MCP_AUTH_TOKEN must be at least ${MIN_TOKEN_LENGTH} characters`);
  }

  const port = Number(env.PORT?.trim() || "3000");
  if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new ConfigError("PORT must be a valid TCP port");

  let path = env.MCP_HTTP_PATH?.trim() || "/mcp";
  if (!path.startsWith("/")) path = `/${path}`;

  return { port, host: env.HOST?.trim() || "0.0.0.0", path, authToken };
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/** Constant-time check of the `Authorization: Bearer <token>` header. */
export function isAuthorized(header: string | undefined, token: string): boolean {
  const match = /^Bearer\s+(.+)$/i.exec(header ?? "");
  if (!match) return false;
  return timingSafeEqual(digest((match[1] ?? "").trim()), digest(token));
}

function sendJson(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(JSON.stringify(body));
}

function jsonRpcError(res: ServerResponse, status: number, message: string, headers?: Record<string, string>): void {
  sendJson(res, status, { jsonrpc: "2.0", error: { code: -32000, message }, id: null }, headers);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new Error("Request body too large");
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : undefined;
}

/**
 * Build the HTTP server. Stateless Streamable HTTP: every POST gets a fresh
 * MCP server + transport, so there is no session state to leak between clients.
 */
export function createHttpApp(buildServer: () => McpServer, opts: HttpOptions): Server {
  return createHttpServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");

    if (url.pathname === "/health" && req.method === "GET") {
      sendJson(res, 200, { status: "ok" });
      return;
    }

    if (url.pathname !== opts.path) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }

    if (!isAuthorized(req.headers.authorization, opts.authToken)) {
      jsonRpcError(res, 401, "Unauthorized", { "WWW-Authenticate": 'Bearer realm="mcp-evolution"' });
      return;
    }

    if (req.method !== "POST") {
      // Stateless mode: no server-initiated SSE stream and no sessions to delete.
      jsonRpcError(res, 405, "Method not allowed", { Allow: "POST" });
      return;
    }

    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      const tooLarge = err instanceof Error && err.message === "Request body too large";
      jsonRpcError(res, tooLarge ? 413 : 400, tooLarge ? "Request body too large" : "Invalid JSON body");
      return;
    }

    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (err) {
      console.error("[mcp-evolution] Error handling MCP request:", err instanceof Error ? err.message : err);
      if (!res.headersSent) jsonRpcError(res, 500, "Internal server error");
    }
  });
}
