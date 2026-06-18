import { access } from "node:fs/promises";
import { join } from "node:path";
import { scanNpm } from "./npm.js";
import type { Ecosystem, InstalledPackage, ScanResult } from "./types.js";

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Scan a project root for installed dependencies across supported ecosystems.
 * Host-side only: reads local lockfiles, never touches the network.
 */
export async function scanProject(root: string): Promise<ScanResult> {
  const ecosystems: Ecosystem[] = [];
  const packages: InstalledPackage[] = [];

  if (await exists(join(root, "package-lock.json"))) {
    const npm = await scanNpm(root);
    if (npm.length) {
      ecosystems.push("npm");
      packages.push(...npm);
    }
  }

  // TODO(E1b): composer.lock support (composer.json `repositories` + path/vcs
  // classification for the public-coordinate decision).

  return { root, ecosystems, packages };
}

export type { Ecosystem, InstalledPackage, ScanResult } from "./types.js";
