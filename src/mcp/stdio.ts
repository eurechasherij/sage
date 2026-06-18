import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

// Local stdio entrypoint. The production deployment serves the same server over
// streamable HTTP at sage.rematcha.dev; this is the dev/single-machine transport.
const server = createServer();
await server.connect(new StdioServerTransport());
