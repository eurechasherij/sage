#!/usr/bin/env node
import { matchInstalled } from "./capability/match.js";
import { scanProject } from "./scanner/index.js";

// Host-side CLI. The agent/skill runs these locally (file access stays on the
// machine); world-search/health/docs come from the MCP service. Reasoning is the
// agent's job — these commands are deterministic primitives.

const usage = `sage — research-first work gate (host-side primitives)

  sage scan [dir]                 list installed deps + public-coordinate flags
  sage match "<capability>" [dir] installed packages that may already cover it
`;

const run = async (): Promise<void> => {
  const [cmd, ...rest] = process.argv.slice(2);
  const dirOf = (i: number) => rest[i] ?? process.cwd();

  if (cmd === "scan") {
    console.log(JSON.stringify(await scanProject(dirOf(0)), null, 2));
    return;
  }

  if (cmd === "match") {
    const capability = rest[0];
    if (!capability) {
      console.error('usage: sage match "<capability>" [dir]');
      process.exitCode = 1;
      return;
    }
    const { packages } = await scanProject(dirOf(1));
    console.log(JSON.stringify(matchInstalled(capability, packages), null, 2));
    return;
  }

  console.error(usage);
  process.exitCode = cmd ? 1 : 0;
};

run().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
