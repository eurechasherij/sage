import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Direct dependency names declared in package.json. npm / pnpm / yarn all take
 * their "direct vs transitive" truth from the manifest, not the lockfile.
 */
export const readPackageJsonDirect = async (root: string): Promise<Set<string>> => {
  const names = new Set<string>();
  try {
    const pj = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as Record<
      string,
      Record<string, string> | undefined
    >;
    for (const field of [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
      "peerDependencies",
    ]) {
      const deps = pj[field];
      if (deps) for (const n of Object.keys(deps)) names.add(n);
    }
  } catch {
    // no/invalid package.json — empty direct set
  }
  return names;
};
