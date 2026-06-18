import { describe, expect, it } from "vitest";
import { evaluateFloor } from "./floor.js";
import type { PackageHealth } from "../data/types.js";

function health(over: Partial<PackageHealth> = {}): PackageHealth {
  return {
    name: "pkg",
    ecosystem: "npm",
    advisories: [],
    deprecated: false,
    degraded: [],
    ...over,
  };
}

const NOW = Date.parse("2026-06-18T00:00:00Z");

describe("evaluateFloor", () => {
  it("passes a clean package", () => {
    const v = evaluateFloor(health({ lastPublish: "2026-05-01T00:00:00Z" }), {}, NOW);
    expect(v.pass).toBe(true);
    expect(v.blockers).toEqual([]);
  });

  it("blocks on a HIGH or CRITICAL advisory", () => {
    expect(evaluateFloor(health({ advisories: [{ id: "A", severity: "HIGH" }] }), {}, NOW).pass).toBe(false);
    expect(evaluateFloor(health({ advisories: [{ id: "B", severity: "CRITICAL" }] }), {}, NOW).pass).toBe(false);
  });

  it("only warns on LOW/MODERATE advisories by default", () => {
    const v = evaluateFloor(health({ advisories: [{ id: "C", severity: "MODERATE" }] }), {}, NOW);
    expect(v.pass).toBe(true);
    expect(v.warnings.some((w) => w.includes("MODERATE"))).toBe(true);
  });

  it("blocks an unknown-severity advisory by default (conservative)", () => {
    expect(evaluateFloor(health({ advisories: [{ id: "D", severity: "UNKNOWN" }] }), {}, NOW).pass).toBe(false);
  });

  it("blocks deprecated packages", () => {
    expect(evaluateFloor(health({ deprecated: true }), {}, NOW).pass).toBe(false);
  });

  it("blocks when advisory data is unavailable (OSV degraded)", () => {
    const v = evaluateFloor(health({ degraded: [{ source: "osv", reason: "timeout" }] }), {}, NOW);
    expect(v.pass).toBe(false);
    expect(v.blockers.some((b) => b.includes("advisory data unavailable"))).toBe(true);
  });

  it("treats staleness as a warning, never a blocker", () => {
    const v = evaluateFloor(health({ lastPublish: "2018-01-01T00:00:00Z" }), {}, NOW);
    expect(v.pass).toBe(true);
    expect(v.warnings.some((w) => w.includes("no release"))).toBe(true);
  });

  it("respects a stricter policy (block at MODERATE)", () => {
    const v = evaluateFloor(health({ advisories: [{ id: "E", severity: "MODERATE" }] }), { blockAtSeverity: "MODERATE" }, NOW);
    expect(v.pass).toBe(false);
  });
});
