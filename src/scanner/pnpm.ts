import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { isPublicRegistryUrl } from "./classify.js";
import { readPackageJsonDirect } from "./manifest.js";
import type { InstalledPackage } from "./types.js";

// Targeted parser for the `packages:` section of pnpm-lock.yaml (v6 and v9). Not a
// general YAML parser — it reads exactly what we need: each package id (name@version)
// and whether its resolution is the public registry (integrity-only) vs a custom
// tarball / directory / git (private). Direct deps come from package.json.

interface PnpmEntry {
  name: string;
  version: string;
  public: boolean;
}

export const scanPnpm = async (root: string): Promise<InstalledPackage[]> => {
  let raw: string;
  try {
    raw = await readFile(join(root, "pnpm-lock.yaml"), "utf8");
  } catch {
    return [];
  }

  const direct = await readPackageJsonDirect(root);
  const byName = new Map<string, InstalledPackage>();
  for (const e of parsePnpmPackages(raw)) {
    const pkg: InstalledPackage = {
      name: e.name,
      version: e.version,
      ecosystem: "npm",
      direct: direct.has(e.name),
      publicCoordinate: e.public,
    };
    const cur = byName.get(pkg.name);
    if (!cur || (pkg.direct && !cur.direct)) byName.set(pkg.name, pkg);
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
};

const parsePnpmPackages = (raw: string): PnpmEntry[] => {
  const out: PnpmEntry[] = [];
  let inPackages = false;
  let cur: PnpmEntry | null = null;

  for (const line of raw.split("\n")) {
    if (/^\S/.test(line)) {
      inPackages = line.trimEnd() === "packages:";
      cur = null;
      continue;
    }
    if (!inPackages) continue;

    const keyM = /^ {2}(?:'([^']+)'|"([^"]+)"|([^\s:][^:]*)):\s*$/.exec(line);
    if (keyM) {
      const key = keyM[1] ?? keyM[2] ?? keyM[3] ?? "";
      const id = stripPeer(key.replace(/^\//, "")); // v6 keys start with '/'
      const nv = splitNameVersion(id);
      cur = nv ? { name: nv.name, version: nv.version, public: true } : null;
      if (cur) out.push(cur);
      continue;
    }

    const resM = /^ {4}resolution:\s*\{(.+)\}/.exec(line);
    if (resM && cur) {
      const body = resM[1]!;
      if (/directory:|type:\s*git|repo:/.test(body)) {
        cur.public = false;
      } else {
        const tar = /tarball:\s*'?([^',}\s]+)'?/.exec(body);
        cur.public = tar ? isPublicRegistryUrl(tar[1]) : true; // integrity-only => registry
      }
    }
  }
  return out;
};

const stripPeer = (id: string): string => {
  const p = id.indexOf("(");
  return p === -1 ? id : id.slice(0, p);
};

const splitNameVersion = (id: string): { name: string; version: string } | null => {
  const at = id.startsWith("@") ? id.indexOf("@", 1) : id.indexOf("@");
  if (at < 1) return null;
  return { name: id.slice(0, at), version: id.slice(at + 1) };
};
