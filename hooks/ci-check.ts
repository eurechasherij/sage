#!/usr/bin/env bun
// CI gate: fail a PR when source files changed but no SAGE research decision is
// present. Addresses the expensive failure (catching it before/at PR time, where
// the wasted CI runs happen). Thin wrapper over src/enforce/gate.ts (tested).
//
// Usage in CI: `bun run hooks/ci-check.ts` with SAGE_BASE_REF set to the base
// branch (e.g. origin/main). See templates/sage-gate.yml.

import { existsSync, readdirSync } from "node:fs";
import { isSourceFile } from "../src/enforce/gate.js";

const base = process.env.SAGE_BASE_REF ?? "origin/main";
const diff = await Bun.$`git diff --name-only ${base}...HEAD`.text().catch(() => "");
const changed = diff.split("\n").filter(Boolean);
const sourceChanged = changed.filter(isSourceFile);

const hasDecisionArtifact =
  existsSync(".sage/decisions") && readdirSync(".sage/decisions").some((f) => f.endsWith(".json"));

if (sourceChanged.length > 0 && !hasDecisionArtifact) {
  console.error("SAGE gate FAILED: source files changed but no .sage/decisions/*.json present.");
  console.error("Run /work to research before implementing. Changed source files:");
  for (const f of sourceChanged) console.error(`  ${f}`);
  process.exit(1);
}

console.log(`SAGE gate OK (${sourceChanged.length} source files, decision artifact present: ${hasDecisionArtifact}).`);
