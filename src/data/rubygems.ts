import { request, type HttpOpts, type Result } from "./http.js";
import type { PackageCandidate } from "./types.js";

// RubyGems search.json.

interface RubygemsGem {
  name: string;
  version?: string;
  info?: string;
  downloads?: number;
  source_code_uri?: string;
  homepage_uri?: string;
}

export const searchRubygems = async (
  query: string,
  opts?: HttpOpts,
): Promise<Result<PackageCandidate[]>> => {
  const url = `https://rubygems.org/api/v1/search.json?query=${encodeURIComponent(query)}`;
  const res = await request<RubygemsGem[]>(url, "rubygems", {}, opts);
  if (!res.ok) return res;
  return {
    ok: true,
    data: (res.data ?? []).slice(0, 10).map((g) => ({
      name: g.name,
      ecosystem: "rubygems" as const,
      version: g.version,
      description: g.info,
      repoUrl: g.source_code_uri ?? g.homepage_uri,
      downloads: g.downloads,
    })),
  };
};
