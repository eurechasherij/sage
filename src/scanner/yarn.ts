import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { isPublicRegistryUrl } from "./classify.js";
import { readPackageJsonDirect } from "./manifest.js";
import type { InstalledPackage } from "./types.js";

// yarn.lock comes in two formats: classic (v1, a custom indented format with a
// `resolved "<url>"` per entry) and berry (v2+, YAML-ish with `resolution: "<spec>"`).
// Detect berry by its `__metadata:` block. Direct deps come from package.json.

interface YarnEntry {
  name: string;
  version: string;
  public: boolean;
}

export const scanYarn = async (root: string): Promise<InstalledPackage[]> => {
  let raw: string;
  try {
    raw = await readFile(join(root, "yarn.lock"), "utf8");
  } catch {
    return [];
  }

  const direct = await readPackageJsonDirect(root);
  const entries = /(^|\n)__metadata:/.test(raw) ? parseBerry(raw) : parseClassic(raw);

  const byName = new Map<string, InstalledPackage>();
  for (const e of entries) {
    if (!e.name || !e.version) continue;
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

// Classic v1: `name@range, name@range2:` header, then `  version "x"` / `  resolved "url"`.
const parseClassic = (raw: string): YarnEntry[] => {
  const out: YarnEntry[] = [];
  let name: string | null = null;
  let version = "";
  let resolved = "";
  const flush = () => {
    if (name) out.push({ name, version, public: resolved ? isPublicRegistryUrl(resolved) : false });
    name = null;
    version = "";
    resolved = "";
  };
  for (const line of raw.split("\n")) {
    if (line.trim() === "" || line.startsWith("#")) continue;
    if (/^\S/.test(line)) {
      flush();
      const header = line.replace(/:\s*$/, "");
      const firstSpec = header.split(",")[0]!.trim().replace(/^"|"$/g, "");
      name = specName(firstSpec);
      continue;
    }
    const v = /^\s+version\s+"([^"]+)"/.exec(line);
    if (v) {
      version = v[1]!;
      continue;
    }
    const r = /^\s+resolved\s+"([^"]+)"/.exec(line);
    if (r) resolved = r[1]!;
  }
  flush();
  return out;
};

// Berry: `"name@npm:range":` header, then `  version: x` / `  resolution: "name@npm:ver"`.
const parseBerry = (raw: string): YarnEntry[] => {
  const out: YarnEntry[] = [];
  let name: string | null = null;
  let version = "";
  let resolution = "";
  const flush = () => {
    if (name) out.push({ name, version, public: berryPublic(resolution) });
    name = null;
    version = "";
    resolution = "";
  };
  for (const line of raw.split("\n")) {
    if (line.trim() === "" || line.startsWith("#")) continue;
    if (/^[^\s"]/.test(line)) {
      flush();
      continue;
    } // top-level non-quoted key (e.g. __metadata) — not a package
    if (/^"/.test(line)) {
      flush();
      const header = line.replace(/:\s*$/, "");
      name = specName(header.split(",")[0]!.trim().replace(/^"|"$/g, ""));
      continue;
    }
    const v = /^\s+version:\s+"?([^"\n]+?)"?\s*$/.exec(line);
    if (v) {
      version = v[1]!.trim();
      continue;
    }
    const r = /^\s+resolution:\s+"([^"]+)"/.exec(line);
    if (r) resolution = r[1]!;
  }
  flush();
  return out;
};

const berryPublic = (resolution: string): boolean => {
  if (!resolution) return false;
  if (/@(workspace|file|portal|patch|link):/.test(resolution)) return false;
  if (/@(git\+|github:|git:|https?:)/.test(resolution)) return false;
  return /@npm:/.test(resolution);
};

// "name@range" / "@scope/name@range" / "name@npm:range" -> the package name.
const specName = (spec: string): string => {
  const at = spec.startsWith("@") ? spec.indexOf("@", 1) : spec.indexOf("@");
  return at < 1 ? spec : spec.slice(0, at);
};
