import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { isBunPublic } from "./classify.js";
import { parseJsonc } from "./jsonc.js";
import type { InstalledPackage } from "./types.js";

// Bun installs from the npm ecosystem, so scanned packages get ecosystem "npm"
// (that's what OSV/registry health + search use). bun.lock has no per-package
// resolved URL, so public/private is inferred from the descriptor's protocol plus
// any custom-registry scopes declared in bunfig.toml.

interface BunWorkspace {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}
interface BunLock {
  workspaces?: Record<string, BunWorkspace>;
  packages?: Record<string, unknown[]>;
}

export const scanBun = async (root: string): Promise<InstalledPackage[]> => {
  let raw: string;
  try {
    raw = await readFile(join(root, "bun.lock"), "utf8");
  } catch {
    return [];
  }

  const lock = parseJsonc<BunLock>(raw);
  if (!lock.packages) return [];

  const direct = collectDirect(lock);
  const privateScopes = await readBunfigPrivateScopes(root);

  const byName = new Map<string, InstalledPackage>();
  for (const value of Object.values(lock.packages)) {
    const descriptor = Array.isArray(value) ? value[0] : undefined;
    if (typeof descriptor !== "string") continue;
    const parsed = parseDescriptor(descriptor);
    if (!parsed) continue;

    const pkg: InstalledPackage = {
      name: parsed.name,
      version: parsed.version,
      ecosystem: "npm",
      direct: direct.has(parsed.name),
      publicCoordinate: isBunPublic(parsed.name, parsed.protocol, privateScopes),
    };
    const cur = byName.get(pkg.name);
    if (!cur || (pkg.direct && !cur.direct)) byName.set(pkg.name, pkg);
  }

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
};

type Protocol = "version" | "npm" | "workspace" | "file" | "link" | "git" | "url";

const parseDescriptor = (
  d: string,
): { name: string; version: string; protocol: Protocol } | null => {
  const at = d.startsWith("@") ? d.indexOf("@", 1) : d.indexOf("@");
  if (at < 1) return null;
  const name = d.slice(0, at);
  const res = d.slice(at + 1);

  if (res.startsWith("workspace:")) return { name, version: res.slice(10), protocol: "workspace" };
  if (res.startsWith("file:")) return { name, version: res, protocol: "file" };
  if (res.startsWith("link:")) return { name, version: res, protocol: "link" };
  if (res.startsWith("npm:")) {
    // alias: report the REAL package so health/search work on the right name
    const real = res.slice(4);
    const rat = real.startsWith("@") ? real.indexOf("@", 1) : real.indexOf("@");
    return rat > 0
      ? { name: real.slice(0, rat), version: real.slice(rat + 1), protocol: "npm" }
      : { name: real, version: "", protocol: "npm" };
  }
  if (/^(git\+|github:|git:|gitlab:|bitbucket:)/.test(res)) return { name, version: res, protocol: "git" };
  if (/^https?:\/\//.test(res)) return { name, version: res, protocol: "url" };
  return { name, version: res, protocol: "version" };
};

const collectDirect = (lock: BunLock): Set<string> => {
  const names = new Set<string>();
  for (const ws of Object.values(lock.workspaces ?? {})) {
    for (const field of [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
      "peerDependencies",
    ] as const) {
      const deps = ws[field];
      if (deps) for (const n of Object.keys(deps)) names.add(n);
    }
  }
  return names;
};

/** Scopes pinned to a custom registry in bunfig.toml [install.scopes] -> private. */
const readBunfigPrivateScopes = async (root: string): Promise<Set<string>> => {
  const scopes = new Set<string>();
  try {
    const toml = await readFile(join(root, "bunfig.toml"), "utf8");
    let inScopes = false;
    for (const line of toml.split("\n")) {
      const t = line.trim();
      if (t.startsWith("[")) {
        inScopes = t === "[install.scopes]";
        continue;
      }
      if (inScopes && t && !t.startsWith("#")) {
        const key = t.split("=")[0]?.trim().replace(/^["']|["']$/g, "");
        if (key) scopes.add(key.startsWith("@") ? key : `@${key}`);
      }
    }
  } catch {
    // no bunfig -> no private scopes
  }
  return scopes;
};
