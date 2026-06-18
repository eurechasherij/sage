import type { InstalledPackage } from "../scanner/types.js";
import { DEFAULT_ALIASES, type Alias } from "./aliases.js";

/**
 * Deterministic pre-filter: given a capability string and the installed packages,
 * return the installed packages that plausibly already cover it. Two signals:
 *  1. the capability text matches a curated alias whose package is installed
 *  2. the capability text literally names an installed package
 * This is NOT the final answer — the host model ranks/decides. It exists so the
 * obvious reuse (installed swr / pennant) is never missed.
 */
export function matchInstalled(
  capability: string,
  installed: InstalledPackage[],
  aliases: Alias[] = DEFAULT_ALIASES,
): InstalledPackage[] {
  const cap = capability.toLowerCase();
  const aliased = new Set<string>();
  for (const a of aliases) {
    if (a.match.some((m) => cap.includes(m))) {
      for (const n of a.npm ?? []) aliased.add(n);
      for (const n of a.composer ?? []) aliased.add(n);
    }
  }

  const seen = new Set<string>();
  const hits: InstalledPackage[] = [];
  for (const p of installed) {
    const named = cap.includes(p.name.toLowerCase());
    if ((aliased.has(p.name) || named) && !seen.has(p.name)) {
      seen.add(p.name);
      hits.push(p);
    }
  }
  // direct deps first — they are the more likely intended reuse
  return hits.sort((a, b) => Number(b.direct) - Number(a.direct) || a.name.localeCompare(b.name));
}
