import { request, type HttpOpts, type Result } from "./http.js";
import type { PackageCandidate } from "./types.js";

// npm public registry: search + packument. Stable, documented endpoints.

interface NpmSearchResponse {
  objects?: {
    package: {
      name: string;
      version?: string;
      description?: string;
      date?: string;
      links?: { repository?: string };
    };
    score?: { detail?: { popularity?: number } };
  }[];
}

export const searchNpm = async (
  query: string,
  opts?: HttpOpts,
): Promise<Result<PackageCandidate[]>> => {
  const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=10`;
  const res = await request<NpmSearchResponse>(url, "npm", {}, opts);
  if (!res.ok) return res;
  return {
    ok: true,
    data: (res.data.objects ?? []).map((o) => ({
      name: o.package.name,
      ecosystem: "npm" as const,
      version: o.package.version,
      description: o.package.description,
      lastPublish: o.package.date,
      repoUrl: o.package.links?.repository,
      popularity: o.score?.detail?.popularity,
    })),
  };
}

interface Packument {
  "dist-tags"?: { latest?: string };
  time?: Record<string, string>;
  versions?: Record<string, { deprecated?: string }>;
}

export const npmHealthBits = async (
  name: string,
  opts?: HttpOpts,
): Promise<Result<{ version?: string; lastPublish?: string; deprecated: boolean }>> => {
  const encoded = encodeURIComponent(name).replace(/^%40/, "@"); // keep scope @, encode the slash
  const res = await request<Packument>(`https://registry.npmjs.org/${encoded}`, "npm", {}, opts);
  if (!res.ok) return res;
  const latest = res.data["dist-tags"]?.latest;
  const lastPublish = res.data.time?.["modified"] ?? (latest ? res.data.time?.[latest] : undefined);
  const deprecated = !!(latest && res.data.versions?.[latest]?.deprecated);
  return { ok: true, data: { version: latest, lastPublish, deprecated } };
}
