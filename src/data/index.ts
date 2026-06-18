import type { Ecosystem } from "../scanner/types.js";
import type { HttpOpts, Result } from "./http.js";
import type { PackageCandidate, PackageHealth } from "./types.js";
import { searchNpm, npmHealthBits } from "./npm-registry.js";
import { searchPackagist, packagistHealthBits } from "./packagist.js";
import { queryOsv } from "./osv.js";

export type { PackageCandidate, PackageHealth, Advisory, Severity } from "./types.js";
export type { Result, Degraded, HttpOpts, FetchFn } from "./http.js";

/** World-search: one capability query → ranked candidates (host ranks them). */
export function searchPackages(
  ecosystem: Ecosystem,
  query: string,
  opts?: HttpOpts,
): Promise<Result<PackageCandidate[]>> {
  return ecosystem === "npm" ? searchNpm(query, opts) : searchPackagist(query, opts);
}

/** Health for one package: OSV advisories + registry last-publish/deprecated. */
export async function getHealth(
  ecosystem: Ecosystem,
  name: string,
  version?: string,
  opts?: HttpOpts,
): Promise<PackageHealth> {
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

/** Batch health — the service's batch endpoint; parallel, never serial. */
export function getHealthBatch(
  items: { ecosystem: Ecosystem; name: string; version?: string }[],
  opts?: HttpOpts,
): Promise<PackageHealth[]> {
  return Promise.all(items.map((i) => getHealth(i.ecosystem, i.name, i.version, opts)));
}
