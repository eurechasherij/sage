export type Ecosystem = "npm" | "composer";

export interface InstalledPackage {
  name: string;
  version: string;
  ecosystem: Ecosystem;
  /** Declared directly in the project manifest, not just pulled in transitively. */
  direct: boolean;
  /**
   * True only when the lockfile shows this package resolves from a known PUBLIC
   * registry, so its name+version is safe to send to the hosted SAGE service.
   * Anything not provably public (workspace links, private registries, path
   * repos, unknown hosts) is false and must never leave the machine. See
   * design-001 finding 3C.
   */
  publicCoordinate: boolean;
  /** Resolved source URL from the lockfile, when present. */
  resolved?: string;
}

export interface ScanResult {
  root: string;
  ecosystems: Ecosystem[];
  packages: InstalledPackage[];
}
