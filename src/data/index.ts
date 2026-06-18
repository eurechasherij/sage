import type { Ecosystem } from "../scanner/types.js";
import type { HttpOpts, Result } from "./http.js";
import type { DocsSources, PackageCandidate, PackageHealth } from "./types.js";
import { searchNpm, npmHealthBits } from "./npm-registry.js";
import { searchPackagist, packagistHealthBits } from "./packagist.js";
import { queryOsv } from "./osv.js";

export type { PackageCandidate, PackageHealth, DocsSources, Advisory, Severity } from "./types.js";
export type { Result, Degraded, HttpOpts, FetchFn } from "./http.js";

/** World-search: one capability query → ranked candidates (host ranks them). */
export const searchPackages = (
  ecosystem: Ecosystem,
  query: string,
  opts?: HttpOpts,
): Promise<Result<PackageCandidate[]>> =>
  ecosystem === "npm" ? searchNpm(query, opts) : searchPackagist(query, opts);

/** Health for one package: OSV advisories + registry last-publish/deprecated. */
export const getHealth = async (
  ecosystem: Ecosystem,
  name: string,
  version?: string,
  opts?: HttpOpts,
): Promise<PackageHealth> => {
  const [adv, bits] = await Promise.all([
    queryOsv(ecosystem, name, version, opts),
    ecosystem === "npm" ? npmHealthBits(name, opts) : packagistHealthBits(name, opts),
  ]);
  const degraded: { source: string; reason: string }[] = [];
  if (!adv.ok) degraded.push({ source: adv.source, reason: adv.reason });
  if (!bits.ok) degraded.push({ source: bits.source, reason: bits.reason });
  return {
    name,
    ecosystem,
    version: version ?? (bits.ok ? bits.data.version : undefined),
    advisories: adv.ok ? adv.data : [],
    lastPublish: bits.ok ? bits.data.lastPublish : undefined,
    deprecated: bits.ok ? bits.data.deprecated : false,
    degraded,
  };
}

/**
 * Canonical documentation sources for a package. Pure URL construction — the host
 * model fetches + reads these and decides relevance. Without Context7 wired, the
 * version confidence is "approximate" (registry/repo pages track latest, not the
 * installed version); wiring Context7 later upgrades it to "exact".
 */
export const getDocsSources = (
  ecosystem: Ecosystem,
  name: string,
  version?: string,
  repoUrl?: string,
): DocsSources => {
  const sources: DocsSources["sources"] = [];
  if (ecosystem === "npm") {
    sources.push({ url: `https://www.npmjs.com/package/${name}`, kind: "registry" });
  } else {
    sources.push({ url: `https://packagist.org/packages/${name}`, kind: "registry" });
  }
  if (repoUrl) sources.push({ url: repoUrl, kind: "repo" });
  return { name, ecosystem, version, sources, versionConfidence: version ? "approximate" : "unknown" };
}

/** Batch health — the service's batch endpoint; parallel, never serial. */
export const getHealthBatch = (
  items: { ecosystem: Ecosystem; name: string; version?: string }[],
  opts?: HttpOpts,
): Promise<PackageHealth[]> =>
  Promise.all(items.map((i) => getHealth(i.ecosystem, i.name, i.version, opts)));
