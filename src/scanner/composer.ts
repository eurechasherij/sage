import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { composerCtxFromRepositories, isComposerPublic, type ComposerCtx } from "./classify.js";
import type { InstalledPackage } from "./types.js";

interface LockPkg {
  name?: string;
  version?: string;
  source?: { type?: string; url?: string };
  dist?: { type?: string; url?: string };
}

interface ComposerLock {
  packages?: LockPkg[];
  "packages-dev"?: LockPkg[];
}

/**
 * Parse a Composer project (composer.json + composer.lock).
 * Public-coordinate classification defaults to public (Packagist is the default
 * registry) and marks private only what composer.json declares private. See
 * classify.ts for the shared-host vs custom-host rules.
 */
export const scanComposer = async (root: string): Promise<InstalledPackage[]> => {
  let raw: string;
  try {
    raw = await readFile(join(root, "composer.lock"), "utf8");
  } catch {
    return [];
  }

  const lock = JSON.parse(raw) as ComposerLock;
  const { direct, ctx } = await readComposerManifest(root);

  const out: InstalledPackage[] = [];
  for (const p of [...(lock.packages ?? []), ...(lock["packages-dev"] ?? [])]) {
    if (!p.name) continue;
    out.push({
      name: p.name,
      version: p.version ?? "",
      ecosystem: "composer",
      direct: direct.has(p.name),
      publicCoordinate: isComposerPublic(p, ctx),
      resolved: p.dist?.url ?? p.source?.url,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

async function readComposerManifest(
  root: string,
): Promise<{ direct: Set<string>; ctx: ComposerCtx }> {
  const direct = new Set<string>();
  let repositories: unknown;
  try {
    const cj = JSON.parse(await readFile(join(root, "composer.json"), "utf8")) as Record<
      string,
      unknown
    >;
    for (const field of ["require", "require-dev"]) {
      const deps = cj[field];
      if (deps && typeof deps === "object") {
        for (const n of Object.keys(deps as Record<string, string>)) {
          // platform requirements are not packages
          if (n === "php" || n.startsWith("ext-") || n.startsWith("lib-")) continue;
          direct.add(n);
        }
      }
    }
    repositories = cj["repositories"];
  } catch {
    // no/invalid composer.json — direct stays empty, ctx defaults to all-public
  }
  return { direct, ctx: composerCtxFromRepositories(repositories) };
}
