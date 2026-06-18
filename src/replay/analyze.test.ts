import { describe, expect, it } from "bun:test";
import { analyzeReplay, type ReplayEntry } from "./analyze.js";

const entry = (outcome: ReplayEntry["outcome"]): ReplayEntry => ({ task: "t", outcome });

describe("analyzeReplay", () => {
  it("tallies outcomes and derives failures vs world-search share", () => {
    const r = analyzeReplay([
      entry("ignored-installed-dep"),
      entry("ignored-installed-dep"),
      entry("ignored-documented-api"),
      entry("needed-new-package"),
      entry("fine"),
    ]);
    expect(r.total).toBe(5);
    expect(r.projectGroundingCatches).toBe(3);
    expect(r.needsWorldSearch).toBe(1);
    expect(r.failures).toBe(4);
    expect(r.worldSearchShare).toBeCloseTo(0.25, 5);
  });

  it("recommends keeping the service thin when project grounding dominates", () => {
    const entries = [
      ...Array.from({ length: 9 }, () => entry("ignored-installed-dep")),
      entry("needed-new-package"),
    ];
    expect(analyzeReplay(entries).recommendation).toMatch(/thin/i);
  });

  it("recommends investing in world-search when new packages dominate", () => {
    const entries = Array.from({ length: 12 }, () => entry("needed-new-package"));
    expect(analyzeReplay(entries).recommendation).toMatch(/invest in world-search/i);
  });

  it("flags a small sample", () => {
    expect(analyzeReplay([entry("fine")]).recommendation).toMatch(/small/i);
  });

  it("notes when there are no failures", () => {
    const entries = Array.from({ length: 10 }, () => entry("fine"));
    expect(analyzeReplay(entries).recommendation).toMatch(/no bad decisions/i);
  });
});
