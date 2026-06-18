import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { isNpmPublic } from "./classify.js";
import { readPackageJsonDirect } from "./manifest.js";
import type { InstalledPackage } from "./types.js";

interface LockNode {
  version?: string;
  resolved?: string;
  link?: boolean;
}

interface PackageLock {
  lockfileVersion?: number;
  packages?: Record<string, LockNode>;
}

const NM = "node_modules/";

/**
 * Parse an npm project (package.json + package-lock.json, lockfileVersion 2/3).
 * Returns one entry per installed package, deduped by name, sorted by name.
 * Returns [] if there is no package-lock.json to read.
 */
export const scanNpm = async (root: string): Promise<InstalledPackage[]> => {
  let lockRaw: string;
  try {
    lockRaw = await readFile(join(root, "package-lock.json"), "utf8");
  } catch {
    return [];
  }

  const lock = JSON.parse(lockRaw) as PackageLock;
  if (!lock.packages) return []; // lockfileVersion 1 not supported yet

  const direct = await readPackageJsonDirect(root);
  const found: InstalledPackage[] = [];

  for (const [key, node] of Object.entries(lock.packages)) {
    if (key === "" || !key.includes(NM)) continue;
    const name = key.slice(key.lastIndexOf(NM) + NM.length);
    if (!name) continue;
    if (!node.version && !node.link) continue;
    found.push({
      name,
      version: node.version ?? "",
      ecosystem: "npm",
      direct: direct.has(name),
      publicCoordinate: isNpmPublic(node.resolved, node.link),
      resolved: node.resolved,
    });
  }

  return dedupeByName(found);
}

/** A package name can appear at multiple paths/versions; keep one, prefer the direct entry. */
function dedupeByName(pkgs: InstalledPackage[]): InstalledPackage[] {
  const byName = new Map<string, InstalledPackage>();
  for (const p of pkgs) {
    const cur = byName.get(p.name);
    if (!cur || (p.direct && !cur.direct)) byName.set(p.name, p);
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}
