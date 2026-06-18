import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "./taskkey.js";

export type Outcome = "reused" | "added" | "avoided";
export type Mode = "ai-decides" | "human-decides";

export interface CapabilityDecision {
  capability: string;
  outcome: Outcome;
  package?: string;
  version?: string;
  reason: string;
  docsChecked: string[];
}

export interface DecisionArtifact {
  taskKey: string;
  /** binding hashes — an artifact is only valid if it covers the CURRENT inputs */
  taskHash: string;
  lockfileHash: string;
  capabilitiesHash: string;
  toolVersion: string;
  policyVersion: string;
  mode: Mode;
  decisions: CapabilityDecision[];
  degradedSources: string[];
  timestamp: string;
}

export interface BuildInput {
  taskKey: string;
  taskText: string;
  lockfileContent: string;
  capabilities: string[];
  toolVersion: string;
  policyVersion: string;
  mode: Mode;
  decisions: CapabilityDecision[];
  degradedSources: string[];
  timestamp: string;
}

export const capabilitiesHash = (capabilities: string[]): string =>
  sha256([...capabilities].map((c) => c.trim().toLowerCase()).sort().join("\n"));

export const buildArtifact = (i: BuildInput): DecisionArtifact => {
  return {
    taskKey: i.taskKey,
    taskHash: sha256(i.taskText),
    lockfileHash: sha256(i.lockfileContent),
    capabilitiesHash: capabilitiesHash(i.capabilities),
    toolVersion: i.toolVersion,
    policyVersion: i.policyVersion,
    mode: i.mode,
    decisions: i.decisions,
    degradedSources: i.degradedSources,
    timestamp: i.timestamp,
  };
}

const DIR = ".sage/decisions";

export const writeArtifact = async (root: string, art: DecisionArtifact): Promise<string> => {
  const dir = join(root, DIR);
  await mkdir(dir, { recursive: true });
  const jsonPath = join(dir, `${art.taskKey}.json`);
  await writeFile(jsonPath, JSON.stringify(art, null, 2));
  await writeFile(join(dir, `${art.taskKey}.md`), renderMarkdown(art));
  return jsonPath;
}

export const readArtifact = async (
  root: string,
  taskKey: string,
): Promise<DecisionArtifact | null> => {
  try {
    const raw = await readFile(join(root, DIR, `${taskKey}.json`), "utf8");
    return JSON.parse(raw) as DecisionArtifact;
  } catch {
    return null;
  }
}

export interface ValidationInput {
  taskText: string;
  lockfileContent: string;
  capabilities: string[];
}

/**
 * An artifact is VALID for the current work only if it binds to the same task,
 * lockfile, and capability set. This is what a PreToolUse hook / CI check uses —
 * mere file existence is not enough (a stale or forged file would pass that).
 */
export const isArtifactValid = (
  art: DecisionArtifact,
  cur: ValidationInput,
): { valid: boolean; mismatches: string[] } => {
  const mismatches: string[] = [];
  if (art.taskHash !== sha256(cur.taskText)) mismatches.push("task text changed");
  if (art.lockfileHash !== sha256(cur.lockfileContent)) mismatches.push("lockfile changed");
  if (art.capabilitiesHash !== capabilitiesHash(cur.capabilities))
    mismatches.push("capabilities changed");
  return { valid: mismatches.length === 0, mismatches };
}

function renderMarkdown(a: DecisionArtifact): string {
  const rows = a.decisions
    .map(
      (d) =>
        `- **${d.capability}** → \`${d.outcome}\`${d.package ? ` ${d.package}@${d.version ?? ""}` : ""}\n  - ${d.reason}\n  - docs: ${d.docsChecked.join(", ") || "none"}`,
    )
    .join("\n");
  return `# SAGE research decision — ${a.taskKey}

- mode: ${a.mode}
- tool: ${a.toolVersion} | policy: ${a.policyVersion}
- timestamp: ${a.timestamp}
- degraded sources: ${a.degradedSources.join(", ") || "none"}

## Decisions
${rows || "_none_"}
`;
}
