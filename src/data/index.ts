import type { Ecosystem } from "./types.js";
import type { HttpOpts, Result } from "./http.js";
import type { DocsSources, PackageCandidate, PackageHealth } from "./types.js";
import { searchNpm, npmHealthBits } from "./npm-registry.js";
import { searchPackagist, packagistHealthBits } from "./packagist.js";
import { searchCrates } from "./crates.js";
import { searchRubygems } from "./rubygems.js";
import { queryOsv } from "./osv.js";

export type { PackageCandidate, PackageHealth, DocsSources, Advisory, Severity } from "./types.js";
export type { Result, Degraded, HttpOpts, FetchFn } from "./http.js";

/**
 * World-search: one capability query → ranked candidates (host ranks them).
 * pypi/go have no clean public search API, so they return empty for now (project
 * grounding still works there — the agent reads the manifest; this is only the
 * "find a NEW package" path).
 */
export const searchPackages = (
  ecosystem: Ecosystem,
  query: string,
  opts?: HttpOpts,
): Promise<Result<PackageCandidate[]>> => {
  switch (ecosystem) {
    case "npm":
      return searchNpm(query, opts);
    case "composer":
      return searchPackagist(query, opts);
    case "cargo":
      return searchCrates(query, opts);
    case "rubygems":
      return searchRubygems(query, opts);
    default:
      return Promise.resolve({ ok: true, data: [] });
  }
};

/** Health for one package: OSV advisories + registry last-publish/deprecated. */
export const getHealth = async (
  ecosystem: Ecosystem,
  name: string,
  version?: string,
  opts?: HttpOpts,
): Promise<PackageHealth> => {
  // last-publish/deprecated bits only exist for npm + packagist clients; other
  // ecosystems get OSV advisories only (bits unavailable is informational, not a
  // floor blocker — the floor only blocks on missing OSV data).
  const bitsClient =
    ecosystem === "npm" ? npmHealthBits : ecosystem === "composer" ? packagistHealthBits : null;
  const [adv, bits] = await Promise.all([
    queryOsv(ecosystem, name, version, opts),
    bitsClient ? bitsClient(name, opts) : Promise.resolve(null),
  ]);
  const degraded: { source: string; reason: string }[] = [];
  if (!adv.ok) degraded.push({ source: adv.source, reason: adv.reason });
  if (bits && !bits.ok) degraded.push({ source: bits.source, reason: bits.reason });
  return {
    name,
    ecosystem,
    version: version ?? (bits?.ok ? bits.data.version : undefined),
    advisories: adv.ok ? adv.data : [],
    lastPublish: bits?.ok ? bits.data.lastPublish : undefined,
    deprecated: bits?.ok ? bits.data.deprecated : false,
    degraded,
  };
}

/**
 * Canonical documentation sources for a package. Pure URL construction — the host
 * model fetches + reads these and decides relevance. Confidence is "approximate"
 * because registry/repo pages track the latest version, not the installed one.
 */
export const getDocsSources = (
  ecosystem: Ecosystem,
  name: string,
  version?: string,
  repoUrl?: string,
): DocsSources => {
  const registryUrl: Record<Ecosystem, string> = {
    npm: `https://www.npmjs.com/package/${name}`,
    composer: `https://packagist.org/packages/${name}`,
    pypi: `https://pypi.org/project/${name}/`,
    go: `https://pkg.go.dev/${name}`,
    cargo: `https://crates.io/crates/${name}`,
    rubygems: `https://rubygems.org/gems/${name}`,
  };
  const sources: DocsSources["sources"] = [{ url: registryUrl[ecosystem], kind: "registry" }];
  if (repoUrl) sources.push({ url: repoUrl, kind: "repo" });
  return { name, ecosystem, version, sources, versionConfidence: version ? "approximate" : "unknown" };
}

/** Batch health — the service's batch endpoint; parallel, never serial. */
export const getHealthBatch = (
  items: { ecosystem: Ecosystem; name: string; version?: string }[],
  opts?: HttpOpts,
): Promise<PackageHealth[]> =>
  Promise.all(items.map((i) => getHealth(i.ecosystem, i.name, i.version, opts)));
