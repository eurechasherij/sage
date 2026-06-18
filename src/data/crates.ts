import { request, type HttpOpts, type Result } from "./http.js";
import type { PackageCandidate } from "./types.js";

// crates.io search. Requires a User-Agent (crates.io blocks requests without one).

interface CratesResponse {
  crates?: {
    name: string;
    max_stable_version?: string;
    max_version?: string;
    description?: string;
    repository?: string;
    downloads?: number;
  }[];
}

const UA = { "user-agent": "sage (https://sage.rematcha.dev)" };

export const searchCrates = async (
  query: string,
  opts?: HttpOpts,
): Promise<Result<PackageCandidate[]>> => {
  const url = `https://crates.io/api/v1/crates?q=${encodeURIComponent(query)}&per_page=10`;
  const res = await request<CratesResponse>(url, "crates.io", { headers: UA }, opts);
  if (!res.ok) return res;
  return {
    ok: true,
    data: (res.data.crates ?? []).map((c) => ({
      name: c.name,
      ecosystem: "cargo" as const,
      version: c.max_stable_version ?? c.max_version,
      description: c.description,
      repoUrl: c.repository,
      downloads: c.downloads,
    })),
  };
};
