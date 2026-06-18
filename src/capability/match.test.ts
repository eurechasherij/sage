import { describe, expect, it } from "vitest";
import { matchInstalled } from "./match.js";
import type { InstalledPackage } from "../scanner/types.js";

function pkg(name: string, direct = true): InstalledPackage {
  return { name, version: "1.0.0", ecosystem: name.includes("/") ? "composer" : "npm", direct, publicCoordinate: true };
}

const installed = [pkg("swr"), pkg("laravel/pennant"), pkg("dequal", false), pkg("lodash")];

describe("matchInstalled", () => {
  it("connects a data-fetching capability to installed swr (the SWR case)", () => {
    const hits = matchInstalled("client-side data fetching with caching", installed);
    expect(hits.map((h) => h.name)).toContain("swr");
  });

  it("connects a feature-flag capability to installed laravel/pennant (the Pennant case)", () => {
    const hits = matchInstalled("feature flag with per-user override for beta users", installed);
    expect(hits.map((h) => h.name)).toContain("laravel/pennant");
  });

  it("matches when the capability literally names an installed package", () => {
    const hits = matchInstalled("use lodash debounce", installed);
    expect(hits.map((h) => h.name)).toContain("lodash");
  });

  it("returns nothing for a capability nothing installed covers", () => {
    expect(matchInstalled("3d physics simulation", installed)).toEqual([]);
  });

  it("orders direct dependencies before transitive ones", () => {
    const withTransitive = [pkg("dequal", false), pkg("swr", true)];
    const hits = matchInstalled("data fetching", [...withTransitive]);
    expect(hits[0]?.name).toBe("swr");
  });
});
