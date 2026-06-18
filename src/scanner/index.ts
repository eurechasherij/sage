import { access } from "node:fs/promises";
import { join } from "node:path";
import { scanNpm } from "./npm.js";
import { scanPnpm } from "./pnpm.js";
import { scanYarn } from "./yarn.js";
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

  // npm ecosystem: one JS package manager per repo. Pick by which lockfile exists,
  // in priority order. (All resolve to npm packages.)
  let npmPackages: InstalledPackage[] = [];
  if (await exists(join(root, "package-lock.json"))) {
    npmPackages = await scanNpm(root);
  } else if (await exists(join(root, "pnpm-lock.yaml"))) {
    npmPackages = await scanPnpm(root);
  } else if (await exists(join(root, "yarn.lock"))) {
    npmPackages = await scanYarn(root);
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
