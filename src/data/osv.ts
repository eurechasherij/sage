import { request, type HttpOpts, type Result } from "./http.js";
import type { Ecosystem } from "../scanner/types.js";
import type { Advisory, Severity } from "./types.js";

// OSV.dev — cross-ecosystem vulnerability advisories. POST /v1/query.
// https://google.github.io/osv.dev/post-v1-query/

const OSV_ECOSYSTEM: Record<Ecosystem, string> = { npm: "npm", composer: "Packagist" };

interface OsvVuln {
  id: string;
  summary?: string;
  severity?: { type?: string; score?: string }[];
  database_specific?: { severity?: string };
}
interface OsvResponse {
  vulns?: OsvVuln[];
}

export async function queryOsv(
  ecosystem: Ecosystem,
  name: string,
  version: string | undefined,
  opts?: HttpOpts,
): Promise<Result<Advisory[]>> {
  const pkg = { name, ecosystem: OSV_ECOSYSTEM[ecosystem] };
  const body = JSON.stringify(version ? { package: pkg, version } : { package: pkg });
  const res = await request<OsvResponse>(
    "https://api.osv.dev/v1/query",
    "osv",
    { method: "POST", headers: { "content-type": "application/json" }, body },
    opts,
  );
  if (!res.ok) return res;
  return { ok: true, data: (res.data.vulns ?? []).map(normalizeVuln) };
}

export function normalizeVuln(v: OsvVuln): Advisory {
  return { id: v.id, severity: mapSeverity(v.database_specific?.severity), summary: v.summary };
}

function mapSeverity(raw: string | undefined): Severity {
  const s = raw?.toUpperCase();
  if (s === "CRITICAL") return "CRITICAL";
  if (s === "HIGH") return "HIGH";
  if (s === "MODERATE" || s === "MEDIUM") return "MODERATE";
  if (s === "LOW") return "LOW";
  return "UNKNOWN";
}
