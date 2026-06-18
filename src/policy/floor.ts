import type { PackageHealth, Severity } from "../data/types.js";

// Auto-install safety floor (design-001 finding 3A). Under `--ai-decides` the agent
// may only auto-ADD a package that clears this floor; anything that fails falls
// back to stop-and-ask. Hard blockers are things we are confident make auto-install
// unsafe: a HIGH/CRITICAL (or severity-unknown) advisory, deprecation, or MISSING
// advisory data (can't clear a floor you couldn't evaluate). Staleness is only a
// warning — "no release in N months" wrongly condemns mature/stable packages
// (eng-review refinement), so it never hard-blocks.

const RANK: Record<Severity, number> = { UNKNOWN: -1, LOW: 0, MODERATE: 1, HIGH: 2, CRITICAL: 3 };

export interface FloorPolicy {
  blockAtSeverity?: Exclude<Severity, "UNKNOWN">;
  blockUnknownAdvisory?: boolean;
  blockDeprecated?: boolean;
  staleWarnAfterDays?: number;
}

export interface FloorVerdict {
  pass: boolean;
  blockers: string[];
  warnings: string[];
}

const DEFAULTS: Required<FloorPolicy> = {
  blockAtSeverity: "HIGH",
  blockUnknownAdvisory: true,
  blockDeprecated: true,
  staleWarnAfterDays: 365,
};

const DAY_MS = 86_400_000;

export const evaluateFloor = (
  health: PackageHealth,
  policy: FloorPolicy = {},
  nowMs: number = Date.parse("1970-01-01T00:00:00Z"),
): FloorVerdict => {
  const p = { ...DEFAULTS, ...policy };
  const blockers: string[] = [];
  const warnings: string[] = [];

  // Missing advisory data => cannot clear the floor.
  if (health.degraded.some((d) => d.source === "osv")) {
    blockers.push("advisory data unavailable (OSV degraded) — cannot verify safety");
  }

  for (const a of health.advisories) {
    if (a.severity === "UNKNOWN") {
      (p.blockUnknownAdvisory ? blockers : warnings).push(`advisory ${a.id} (severity unknown)`);
      continue;
    }
    const atOrAbove = RANK[a.severity] >= RANK[p.blockAtSeverity];
    (atOrAbove ? blockers : warnings).push(`advisory ${a.id} (${a.severity})`);
  }

  if (health.deprecated) {
    (p.blockDeprecated ? blockers : warnings).push("package is deprecated/abandoned");
  }

  if (health.lastPublish) {
    const age = nowMs - Date.parse(health.lastPublish);
    if (age > p.staleWarnAfterDays * DAY_MS) {
      const days = Math.round(age / DAY_MS);
      warnings.push(`no release in ~${days} days (review, not a blocker)`);
    }
  }

  return { pass: blockers.length === 0, blockers, warnings };
}
