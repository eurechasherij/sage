import { describe, expect, it } from "bun:test";
import { request, type FetchFn } from "./http.js";
import { normalizeVuln, queryOsv } from "./osv.js";
import { searchNpm, npmHealthBits } from "./npm-registry.js";
import { packagistHealthBits } from "./packagist.js";
import { getHealth, getDocsSources } from "./index.js";

interface Route {
  match: (url: string) => boolean;
  status?: number;
  body: unknown;
}

function router(routes: Route[]): FetchFn {
  return async (url) => {
    const r = routes.find((rt) => rt.match(url));
    const status = r?.status ?? (r ? 200 : 404);
    return { ok: status >= 200 && status < 300, status, json: async () => r?.body ?? {} };
  };
}

const throwsAbort: FetchFn = async () => {
  const e = new Error("aborted");
  e.name = "AbortError";
  throw e;
};

describe("http.request", () => {
  it("returns data on 2xx", async () => {
    const fetchFn = router([{ match: () => true, body: { hello: "world" } }]);
    const res = await request<{ hello: string }>("https://x", "x", {}, { fetchFn });
    expect(res).toEqual({ ok: true, data: { hello: "world" } });
  });

  it("degrades on non-2xx with the status", async () => {
    const fetchFn = router([{ match: () => true, status: 503, body: {} }]);
    const res = await request("https://x", "depsdev", {}, { fetchFn });
    expect(res).toEqual({ ok: false, source: "depsdev", reason: "HTTP 503" });
  });

  it("degrades to 'timeout' when the fetch aborts", async () => {
    const res = await request("https://x", "osv", {}, { fetchFn: throwsAbort });
    expect(res).toEqual({ ok: false, source: "osv", reason: "timeout" });
  });
});

describe("osv", () => {
  it("maps database_specific severity", () => {
    expect(normalizeVuln({ id: "GHSA-1", database_specific: { severity: "HIGH" } }).severity).toBe("HIGH");
    expect(normalizeVuln({ id: "GHSA-2", database_specific: { severity: "MEDIUM" } }).severity).toBe("MODERATE");
    expect(normalizeVuln({ id: "GHSA-3" }).severity).toBe("UNKNOWN");
  });

  it("queries and normalizes vulns", async () => {
    const fetchFn = router([
      {
        match: (u) => u.includes("api.osv.dev"),
        body: { vulns: [{ id: "GHSA-x", database_specific: { severity: "CRITICAL" }, summary: "rce" }] },
      },
    ]);
    const res = await queryOsv("npm", "evil", "1.0.0", { fetchFn });
    expect(res.ok && res.data[0]).toMatchObject({ id: "GHSA-x", severity: "CRITICAL", summary: "rce" });
  });

  it("degrades cleanly when OSV is down", async () => {
    const fetchFn = router([{ match: () => true, status: 500, body: {} }]);
    const res = await queryOsv("npm", "x", undefined, { fetchFn });
    expect(res.ok).toBe(false);
  });
});

describe("npm registry", () => {
  it("normalizes search results incl popularity", async () => {
    const fetchFn = router([
      {
        match: (u) => u.includes("/-/v1/search"),
        body: {
          objects: [
            {
              package: { name: "swr", version: "2.2.5", description: "react hooks for data fetching", date: "2024-01-01", links: { repository: "https://github.com/vercel/swr" } },
              score: { detail: { popularity: 0.9 } },
            },
          ],
        },
      },
    ]);
    const res = await searchNpm("data fetching react", { fetchFn });
    expect(res.ok && res.data[0]).toMatchObject({ name: "swr", ecosystem: "npm", popularity: 0.9, repoUrl: "https://github.com/vercel/swr" });
  });

  it("reads latest version, last publish, and deprecation from the packument", async () => {
    const fetchFn = router([
      {
        match: (u) => u.includes("registry.npmjs.org/") && !u.includes("/-/v1/"),
        body: {
          "dist-tags": { latest: "3.0.0" },
          time: { modified: "2025-06-01T00:00:00Z", "3.0.0": "2025-05-01T00:00:00Z" },
          versions: { "3.0.0": { deprecated: "use v4" } },
        },
      },
    ]);
    const res = await npmHealthBits("left-pad", { fetchFn });
    expect(res.ok && res.data).toEqual({ version: "3.0.0", lastPublish: "2025-06-01T00:00:00Z", deprecated: true });
  });
});

describe("packagist", () => {
  it("reads newest version + abandoned from p2", async () => {
    const fetchFn = router([
      {
        match: (u) => u.includes("repo.packagist.org/p2/"),
        body: {
          packages: {
            "acme/old": [
              { version: "2.0.0", time: "2020-01-01T00:00:00Z", abandoned: true },
              { version: "1.0.0", time: "2019-01-01T00:00:00Z" },
            ],
          },
        },
      },
    ]);
    const res = await packagistHealthBits("acme/old", { fetchFn });
    expect(res.ok && res.data).toEqual({ version: "2.0.0", lastPublish: "2020-01-01T00:00:00Z", deprecated: true });
  });
});

describe("getHealth composition", () => {
  it("merges advisories + registry bits", async () => {
    const fetchFn = router([
      { match: (u) => u.includes("api.osv.dev"), body: { vulns: [{ id: "GHSA-z", database_specific: { severity: "LOW" } }] } },
      {
        match: (u) => u.includes("registry.npmjs.org/") && !u.includes("/-/v1/"),
        body: { "dist-tags": { latest: "1.2.3" }, time: { modified: "2025-01-01T00:00:00Z" }, versions: { "1.2.3": {} } },
      },
    ]);
    const h = await getHealth("npm", "foo", undefined, { fetchFn });
    expect(h.advisories[0]?.id).toBe("GHSA-z");
    expect(h.lastPublish).toBe("2025-01-01T00:00:00Z");
    expect(h.deprecated).toBe(false);
    expect(h.degraded).toEqual([]);
  });

  it("records degraded sources instead of throwing", async () => {
    const fetchFn = router([
      { match: (u) => u.includes("api.osv.dev"), status: 500, body: {} },
      { match: (u) => u.includes("registry.npmjs.org/"), body: { "dist-tags": { latest: "1.0.0" }, time: {}, versions: { "1.0.0": {} } } },
    ]);
    const h = await getHealth("npm", "foo", undefined, { fetchFn });
    expect(h.advisories).toEqual([]);
    expect(h.degraded.map((d) => d.source)).toContain("osv");
  });
});

describe("getDocsSources", () => {
  it("returns the npm page + repo with approximate confidence", () => {
    const d = getDocsSources("npm", "swr", "2.2.5", "https://github.com/vercel/swr");
    expect(d.sources.map((s) => s.url)).toEqual([
      "https://www.npmjs.com/package/swr",
      "https://github.com/vercel/swr",
    ]);
    expect(d.versionConfidence).toBe("approximate");
  });

  it("uses the packagist page for composer and is unknown without a version", () => {
    const d = getDocsSources("composer", "laravel/pennant");
    expect(d.sources[0]?.url).toBe("https://packagist.org/packages/laravel/pennant");
    expect(d.versionConfidence).toBe("unknown");
  });
});
