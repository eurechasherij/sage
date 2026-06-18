// Package ecosystems the hosted data service understands. The agent reads the
// project's manifest itself (any ecosystem); these are the ones the service can
// look up health/search/docs for.
export type Ecosystem = "npm" | "composer" | "pypi" | "go" | "cargo" | "rubygems";

export type Severity = "LOW" | "MODERATE" | "HIGH" | "CRITICAL" | "UNKNOWN";

export interface Advisory {
  id: string;
  severity: Severity;
  summary?: string;
}

/** A package surfaced by world-search. Ranking/decision happens host-side. */
export interface PackageCandidate {
  name: string;
  ecosystem: Ecosystem;
  description?: string;
  version?: string;
  downloads?: number;
  stars?: number;
  /** npm search popularity 0..1 */
  popularity?: number;
  lastPublish?: string;
  repoUrl?: string;
}

export interface DocsSources {
  name: string;
  ecosystem: Ecosystem;
  version?: string;
  sources: { url: string; kind: "registry" | "repo" }[];
  /** "approximate": registry/repo pages track the latest, not the installed version */
  versionConfidence: "approximate" | "unknown";
}

export interface PackageHealth {
  name: string;
  ecosystem: Ecosystem;
  version?: string;
  advisories: Advisory[];
  lastPublish?: string;
  deprecated: boolean;
  /** sources that failed/were unavailable, so callers can record the gap */
  degraded: { source: string; reason: string }[];
}
