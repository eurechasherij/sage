#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { matchInstalled } from "./capability/match.js";
import { scanProject } from "./scanner/index.js";
import { analyzeReplay, type ReplayEntry } from "./replay/analyze.js";

// Host-side CLI. The agent/skill runs these locally (file access stays on the
// machine); world-search/health/docs come from the MCP service. Reasoning is the
// agent's job — these commands are deterministic primitives.

const usage = `sage — research-first work gate (host-side primitives)

  sage scan [dir]                 list installed deps + public-coordinate flags
  sage match "<capability>" [dir] installed packages that may already cover it
  sage replay <file.jsonl>        calibrate world-search depth from tagged tasks
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

  if (cmd === "replay") {
    const file = rest[0];
    if (!file) {
      console.error("usage: sage replay <file.jsonl>");
      process.exitCode = 1;
      return;
    }
    const entries: ReplayEntry[] = [];
    const raw = await readFile(file, "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t) continue;
      try {
        entries.push(JSON.parse(t) as ReplayEntry);
      } catch {
        console.error(`skipping invalid JSONL line: ${t.slice(0, 60)}`);
      }
    }
    console.log(JSON.stringify(analyzeReplay(entries), null, 2));
    return;
  }

  console.error(usage);
  process.exitCode = cmd ? 1 : 0;
};

run().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
