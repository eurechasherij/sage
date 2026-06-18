#!/usr/bin/env bun
// Claude Code PreToolUse hook: blocks editing source code until a SAGE research
// decision exists, turning the /work convention into a hard wall.
//
// Wire it up in ~/.claude/settings.json:
//   "hooks": { "PreToolUse": [ { "matcher": "Edit|Write|MultiEdit",
//     "hooks": [ { "type": "command",
//       "command": "bun run ~/.claude/skills/sage/hooks/pre-tool-use.ts" } ] } ] }
//
// Escape hatch: SAGE_GATE=off. Thin wrapper over src/enforce/gate.ts (tested).

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { gateDecision } from "../src/enforce/gate.js";

interface HookPayload {
  tool_name?: string;
  tool_input?: { file_path?: string };
  cwd?: string;
}

const payload = (await Bun.stdin.json().catch(() => ({}))) as HookPayload;
const root = payload.cwd ?? process.cwd();
const decisionsDir = join(root, ".sage", "decisions");
const hasDecisionArtifact =
  existsSync(decisionsDir) && readdirSync(decisionsDir).some((f) => f.endsWith(".json"));

const result = gateDecision({
  toolName: payload.tool_name ?? "",
  filePath: payload.tool_input?.file_path ?? "",
  hasDecisionArtifact,
  gateOff: process.env.SAGE_GATE === "off",
});

if (result.decision === "block") {
  console.error(result.reason);
  process.exit(2); // exit 2 => Claude Code blocks the tool call and shows stderr
}
process.exit(0);
