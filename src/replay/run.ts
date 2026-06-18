#!/usr/bin/env bun
// One-off calibration runner. Tag ~20 real recent tasks in a JSONL file (see
// templates/replay.example.jsonl), then:
//   bun run ~/.claude/skills/sage/src/replay/run.ts tasks.jsonl
// It tallies where the agent went wrong and recommends how much world-search to build.

import { readFile } from "node:fs/promises";
import { analyzeReplay, type ReplayEntry } from "./analyze.js";

const file = process.argv[2];
if (!file) {
  console.error("usage: bun run src/replay/run.ts <tagged-tasks.jsonl>");
  process.exit(1);
}

const raw = await readFile(file, "utf8");
const entries: ReplayEntry[] = [];
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
