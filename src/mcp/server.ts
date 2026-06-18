import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getDocsSources, getHealth, getHealthBatch, searchPackages } from "../data/index.js";

// The SAGE hosted service, as an MCP server. It is PURE DATA: search, health,
// advisories, docs sources. No model reasoning, no local file access, no keys of
// its own (design-001: all reasoning is host-side; the service is a thin aggregator
// over deps.dev/OSV/registries). The host agent calls these and decides.

const json = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data) }] });

const ecosystem = z.enum(["npm", "composer"]);

export const createServer = (): McpServer => {
  const server = new McpServer({ name: "sage", version: "0.0.1" });

  server.registerTool(
    "search_packages",
    {
      description:
        "World-search for packages that may provide a capability. Returns ranked candidates with freshness/popularity signals; the caller ranks and decides.",
      inputSchema: { ecosystem, query: z.string() },
    },
    async ({ ecosystem, query }) => json(await searchPackages(ecosystem, query)),
  );

  server.registerTool(
    "check_package_health",
    {
      description:
        "Health for one package: OSV advisories, last publish, deprecation. Degraded sources are reported, never thrown.",
      inputSchema: { ecosystem, name: z.string(), version: z.string().optional() },
    },
    async ({ ecosystem, name, version }) => json(await getHealth(ecosystem, name, version)),
  );

  server.registerTool(
    "check_package_health_batch",
    {
      description: "Health for many packages in one call (parallel). Use this instead of N single calls.",
      inputSchema: {
        items: z.array(z.object({ ecosystem, name: z.string(), version: z.string().optional() })),
      },
    },
    async ({ items }) => json(await getHealthBatch(items)),
  );

  server.registerTool(
    "get_package_docs",
    {
      description:
        "Canonical documentation source URLs for a package (registry page + repo). The caller fetches and reads them. versionConfidence is 'approximate' (pages track the latest version).",
      inputSchema: {
        ecosystem,
        name: z.string(),
        version: z.string().optional(),
        repoUrl: z.string().optional(),
      },
    },
    async ({ ecosystem, name, version, repoUrl }) =>
      json(getDocsSources(ecosystem, name, version, repoUrl)),
  );

  return server;
};
