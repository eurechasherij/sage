import { access } from "node:fs/promises";
import { join } from "node:path";
import { scanNpm } from "./npm.js";
import { scanBun } from "./bun.js";
import { scanComposer } from "./composer.js";
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
export const scanProject = async (root: string): Promise<ScanResult> => {
  const ecosystems: Ecosystem[] = [];
  const packages: InstalledPackage[] = [];

  // npm ecosystem: prefer package-lock.json, fall back to bun.lock (both resolve
  // to npm packages). pnpm-lock.yaml / yarn.lock are not parsed yet.
  let npmPackages: InstalledPackage[] = [];
  if (await exists(join(root, "package-lock.json"))) {
    npmPackages = await scanNpm(root);
  } else if (await exists(join(root, "bun.lock"))) {
    npmPackages = await scanBun(root);
  }
  if (npmPackages.length) {
    ecosystems.push("npm");
    packages.push(...npmPackages);
  }

  if (await exists(join(root, "composer.lock"))) {
    const composer = await scanComposer(root);
    if (composer.length) {
      ecosystems.push("composer");
      packages.push(...composer);
    }
  }

  return { root, ecosystems, packages };
}

export type { Ecosystem, InstalledPackage, ScanResult } from "./types.js";
