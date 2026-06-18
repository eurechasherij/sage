import { request, type HttpOpts, type Result } from "./http.js";
import type { PackageCandidate } from "./types.js";

// Packagist: search.json + the p2 metadata endpoint. Documented + stable.

interface PackagistSearch {
  results?: {
    name: string;
    description?: string;
    repository?: string;
    downloads?: number;
    favers?: number;
  }[];
}

export const searchPackagist = async (
  query: string,
  opts?: HttpOpts,
): Promise<Result<PackageCandidate[]>> => {
  const url = `https://packagist.org/search.json?q=${encodeURIComponent(query)}&per_page=10`;
  const res = await request<PackagistSearch>(url, "packagist", {}, opts);
  if (!res.ok) return res;
  return {
    ok: true,
    data: (res.data.results ?? []).map((r) => ({
      name: r.name,
      ecosystem: "composer" as const,
      description: r.description,
      repoUrl: r.repository,
      downloads: r.downloads,
      stars: r.favers,
    })),
  };
}

interface P2Response {
  packages?: Record<string, { version: string; time?: string; abandoned?: boolean | string }[]>;
}

export const packagistHealthBits = async (
  name: string,
  opts?: HttpOpts,
): Promise<Result<{ version?: string; lastPublish?: string; deprecated: boolean }>> => {
  const res = await request<P2Response>(
    `https://repo.packagist.org/p2/${name}.json`,
    "packagist",
    {},
    opts,
  );
  if (!res.ok) return res;
  const versions = res.data.packages?.[name] ?? [];
  const newest = versions[0]; // p2 lists newest first
  const deprecated = versions.some((v) => v.abandoned !== undefined && v.abandoned !== false);
  return { ok: true, data: { version: newest?.version, lastPublish: newest?.time, deprecated } };
}
