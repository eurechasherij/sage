// Privacy-preserving classification (design-001 finding 3C + eng-review refinement).
//
// A package is a "public coordinate" — safe to send to the hosted SAGE service —
// ONLY when its lockfile-resolved source clearly matches a public registry.
// Everything else (workspace links, path repos, private registries, unknown hosts)
// is treated as private and is never transmitted. We classify from lockfile
// metadata alone; we never probe a registry to test publicness, because the probe
// itself would leak the private name.

const NPM_PUBLIC_REGISTRY = "https://registry.npmjs.org/";

/**
 * npm: public iff resolved from registry.npmjs.org and not a local link.
 * `link: true` marks a workspace/local package — always private.
 */
export function isNpmPublic(resolved: string | undefined, link: boolean | undefined): boolean {
  if (link) return false;
  if (!resolved) return false;
  return resolved.startsWith(NPM_PUBLIC_REGISTRY);
}
