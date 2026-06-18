// Public API surface. SAGE is now: the hosted data service (this library backs the
// MCP), the decision artifact, the enforcement gate, and the replay calibration.
// There is no scanner/CLI — the /work skill has the agent read the manifest itself.
export {
  searchPackages,
  getHealth,
  getHealthBatch,
  getDocsSources,
} from "./data/index.js";
export type {
  Ecosystem,
  PackageCandidate,
  PackageHealth,
  DocsSources,
  Advisory,
  Severity,
} from "./data/types.js";

export { evaluateFloor } from "./policy/floor.js";
export type { FloorPolicy, FloorVerdict } from "./policy/floor.js";

export { gateDecision, isSourceFile } from "./enforce/gate.js";
export type { GateInput, GateResult } from "./enforce/gate.js";

export { analyzeReplay } from "./replay/analyze.js";
export type { ReplayEntry, ReplayOutcome, ReplayReport } from "./replay/analyze.js";

export { taskKey } from "./decision/taskkey.js";
export {
  buildArtifact,
  writeArtifact,
  readArtifact,
  isArtifactValid,
  capabilitiesHash,
} from "./decision/artifact.js";
export type { DecisionArtifact, CapabilityDecision, Mode, Outcome } from "./decision/artifact.js";

export { createServer } from "./mcp/server.js";
