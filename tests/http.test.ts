import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createHttpApp, isAuthorized, loadHttpOptions } from "../src/http.js";
import { ConfigError } from "../src/errors.js";

const TOKEN = "t".repeat(40);

describe("loadHttpOptions", () => {
  it("requires a long enough MCP_AUTH_TOKEN", () => {
    expect(() => loadHttpOptions({})).toThrow(ConfigError);
    expect(() => loadHttpOptions({ MCP_AUTH_TOKEN: "short" })).toThrow(ConfigError);
  });

  it("applies defaults", () => {
    expect(loadHttpOptions({ MCP_AUTH_TOKEN: TOKEN })).toEqual({
      port: 3000,
      host: "0.0.0.0",
      path: "/mcp",
      authToken: TOKEN,
    });
  });

  it("rejects an invalid port", () => {
    expect(() => loadHttpOptions({ MCP_AUTH_TOKEN: TOKEN, PORT: "abc" })).toThrow(ConfigError);
  });
});

describe("isAuthorized", () => {
  it("accepts only the exact bearer token", () => {
    expect(isAuthorized(`Bearer ${TOKEN}`, TOKEN)).toBe(true);
    expect(isAuthorized(`bearer ${TOKEN}`, TOKEN)).toBe(true);
    expect(isAuthorized(`Bearer ${TOKEN}x`, TOKEN)).toBe(false);
    expect(isAuthorized(TOKEN, TOKEN)).toBe(false);
    expect(isAuthorized(undefined, TOKEN)).toBe(false);
  });
});

describe("HTTP transport", () => {
  let app: Server;
  let base: string;

  beforeAll(async () => {
    const build = () => {
      const server = new McpServer({ name: "test", version: "0.0.0" });
      server.tool("ping", "ping", async () => ({ content: [{ type: "text", text: "pong" }] }));
      return server;
    };
    app = createHttpApp(build, { port: 0, host: "127.0.0.1", path: "/mcp", authToken: TOKEN });
    await new Promise<void>((resolve) => app.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(app.address() as AddressInfo).port}`;
  });

  afterAll(() => new Promise<void>((resolve) => app.close(() => resolve())));

  const rpc = (body: unknown, token: string | null = TOKEN) =>
    fetch(`${base}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

  it("serves /health without auth", async () => {
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
  });

  it("rejects missing or wrong tokens", async () => {
    expect((await rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, null)).status).toBe(401);
    expect((await rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, "nope")).status).toBe(401);
  });

  it("rejects GET on the MCP endpoint", async () => {
    const res = await fetch(`${base}/mcp`, { headers: { Authorization: `Bearer ${TOKEN}` } });
    expect(res.status).toBe(405);
  });

  it("handles initialize and tools/list statelessly", async () => {
    const init = await rpc({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } },
    });
    expect(init.status).toBe(200);
    expect(await init.text()).toContain("serverInfo");

    const list = await rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    expect(list.status).toBe(200);
    expect(await list.text()).toContain('"ping"');
  });
});
