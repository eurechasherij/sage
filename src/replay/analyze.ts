// The 20-task replay: you tag ~20 real recent tasks with where the bad decision
// happened; this tallies them into a calibration that says how much world-search
// depth to actually build (the question the design left open). Pure + tested; the
// CLI (`sage replay <file.jsonl>`) reads the file and prints this report.

export type ReplayOutcome =
  | "ignored-installed-dep" // agent reinvented something already installed (e.g. SWR)
  | "ignored-documented-api" // agent worked around a documented API of an installed pkg (e.g. Pennant)
  | "needed-new-package" // genuinely needed to find/add a package not installed
  | "fine"; // agent did the right thing

export interface ReplayEntry {
  task: string;
  outcome: ReplayOutcome;
  note?: string;
}

export interface ReplayReport {
  total: number;
  counts: Record<ReplayOutcome, number>;
  failures: number;
  projectGroundingCatches: number; // catchable host-side, no world-search needed
  needsWorldSearch: number;
  worldSearchShare: number; // fraction of FAILURES that needed world-search (0..1)
  recommendation: string;
}

const ZERO: Record<ReplayOutcome, number> = {
  "ignored-installed-dep": 0,
  "ignored-documented-api": 0,
  "needed-new-package": 0,
  fine: 0,
};

export const analyzeReplay = (entries: ReplayEntry[]): ReplayReport => {
  const counts = { ...ZERO };
  for (const e of entries) counts[e.outcome]++;

  const total = entries.length;
  const projectGroundingCatches = counts["ignored-installed-dep"] + counts["ignored-documented-api"];
  const needsWorldSearch = counts["needed-new-package"];
  const failures = projectGroundingCatches + needsWorldSearch;
  const worldSearchShare = failures === 0 ? 0 : needsWorldSearch / failures;

  return {
    total,
    counts,
    failures,
    projectGroundingCatches,
    needsWorldSearch,
    worldSearchShare,
    recommendation: recommend(total, failures, worldSearchShare),
  };
};

const recommend = (total: number, failures: number, worldSearchShare: number): string => {
  if (total < 10) return "Sample is small (<10) — tag more tasks before trusting the split.";
  if (failures === 0) return "No bad decisions in the sample — the gate may be lower-value than expected.";
  if (worldSearchShare < 0.25)
    return "Most failures are caught by project grounding (installed deps + docs). Keep the world-search service thin — do not over-invest in search/comparison depth.";
  if (worldSearchShare < 0.6)
    return "Mixed: project grounding catches the majority, but world-search earns its place. Build search/health solidly, hold off on heavy comparison/ranking.";
  return "Most failures needed a NEW package the agent didn't know — invest in world-search depth (better search, comparison, freshness ranking).";
};
