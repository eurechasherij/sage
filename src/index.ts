// Public API surface for SAGE's host-side library.
export { scanProject } from "./scanner/index.js";
export type { Ecosystem, InstalledPackage, ScanResult } from "./scanner/types.js";

export { searchPackages, getHealth, getHealthBatch, getDocsSources } from "./data/index.js";
export type { PackageCandidate, PackageHealth, DocsSources, Advisory, Severity } from "./data/types.js";

export { evaluateFloor } from "./policy/floor.js";
export type { FloorPolicy, FloorVerdict } from "./policy/floor.js";

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
