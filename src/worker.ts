import { createMcpHandler } from "agents/mcp";
import { createServer } from "./mcp/server.js";

// Cloudflare Workers HTTP entrypoint for the SAGE MCP service.
//
// Stateless (no Durable Object): a FRESH McpServer per request, required by
// @modelcontextprotocol/sdk >= 1.26 (it refuses to reconnect a server that already
// has a transport). createServer() already returns a new instance each call.
//
// Deployed by Workers Builds on git push (`npx wrangler deploy`). The same pure-data
// tools (search / health / docs) that the local stdio server exposes are served here
// over streamable HTTP at /mcp. No local file access — reasoning stays host-side.
//
// Params are intentionally loosely typed: this file targets the Workers runtime, and
// typing it against @cloudflare/workers-types here would clash with the node/bun
// globals the rest of the project is typechecked against. Wrangler typechecks +
// bundles it for Workers at build time.
const handler = {
  fetch(request: unknown, env: unknown, ctx: unknown) {
    return createMcpHandler(createServer())(request as never, env as never, ctx as never);
  },
};

export default handler;
