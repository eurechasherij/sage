// The enforcement increment: turn the /work convention into a hard wall. The pure
// decision lives here (tested); the PreToolUse hook and CI check are thin wrappers
// that gather inputs (the edited file, whether a decision artifact exists) and act
// on the result. Coarse by design for v1: it gates on "a research decision exists",
// not yet on "the decision covers this exact task" (that binding is a refinement).

export interface GateInput {
  toolName: string;
  filePath: string;
  /** any .sage/decisions/*.json present in the repo */
  hasDecisionArtifact: boolean;
  /** SAGE_GATE=off escape hatch */
  gateOff: boolean;
}

export interface GateResult {
  decision: "allow" | "block";
  reason?: string;
}

const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit"]);
const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|php|vue|svelte|py|rb|go|rs|java|kt|swift)$/i;

/** Does editing this path count as writing implementation code the gate protects? */
export const isSourceFile = (filePath: string): boolean => {
  const p = filePath.replace(/\\/g, "/");
  if (p.includes("/.sage/")) return false; // the decision artifacts themselves
  if (/(^|\/)(node_modules|dist|build|out|vendor|\.git)\//.test(p)) return false;
  if (/(^|\/)(docs?|\.github)\//.test(p)) return false;
  if (/\.(test|spec)\.[tj]sx?$/.test(p)) return false;
  const base = p.split("/").pop() ?? "";
  if (/(^|\.)config\.[tj]s$/.test(base)) return false; // *.config.ts, vite.config.ts, ...
  return CODE_EXT.test(p);
};

export const gateDecision = (i: GateInput): GateResult => {
  if (i.gateOff) return { decision: "allow" };
  if (!EDIT_TOOLS.has(i.toolName)) return { decision: "allow" };
  if (!isSourceFile(i.filePath)) return { decision: "allow" };
  if (i.hasDecisionArtifact) return { decision: "allow" };
  return {
    decision: "block",
    reason:
      "SAGE gate: no research decision found (.sage/decisions/). Run /work to check " +
      "installed deps + docs before writing code, or set SAGE_GATE=off to bypass.",
  };
};
