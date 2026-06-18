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
export const isNpmPublic = (resolved: string | undefined, link: boolean | undefined): boolean => {
  if (link) return false;
  if (!resolved) return false;
  return resolved.startsWith(NPM_PUBLIC_REGISTRY);
}

// Composer: the default registry IS Packagist, and private packages are declared
// explicitly in composer.json `repositories` (vcs/path/composer) or installed as a
// `path` type. So the safe-AND-accurate rule is: public unless we can see it came
// from a declared private source. The trap: a private vcs repo on a SHARED public
// host (github.com, gitlab.com) must be matched by its exact repo URL, never by
// host — matching the host would wrongly mark every Packagist-sourced github
// package as private. Custom hosts (satis, internal gitlab) match by host.

const SHARED_PUBLIC_HOSTS = new Set([
  "github.com",
  "api.github.com",
  "codeload.github.com",
  "gitlab.com",
  "bitbucket.org",
]);

export interface ComposerCtx {
  /** exact normalized repo urls declared private (for shared public hosts) */
  privateRepoUrls: Set<string>;
  /** custom hosts declared private (satis / internal git) */
  privateHosts: Set<string>;
  /** true when composer.json disables Packagist — then nothing defaults to public */
  packagistDisabled: boolean;
}

interface ComposerPkgSrc {
  source?: { type?: string; url?: string };
  dist?: { type?: string; url?: string };
}

export const hostOf = (u: string | undefined): string | undefined => {
  if (!u) return undefined;
  try {
    return new URL(u).host;
  } catch {
    const m = /^[^@]+@([^:]+):/.exec(u); // scp-like git@host:path
    return m ? m[1] : undefined;
  }
}

export const normalizeRepo = (u: string | undefined): string | undefined => {
  if (!u) return undefined;
  return u
    .toLowerCase()
    .replace(/^git\+/, "")
    .replace(/^[a-z]+:\/\//, "")
    .replace(/^git@/, "")
    .replace(/:/, "/")
    .replace(/\.git$/, "")
    .replace(/\/+$/, "");
}

export const isComposerPublic = (pkg: ComposerPkgSrc, ctx: ComposerCtx): boolean => {
  if (pkg.dist?.type === "path" || pkg.source?.type === "path") return false;
  if (ctx.packagistDisabled) return false;

  const srcNorm = normalizeRepo(pkg.source?.url);
  if (srcNorm && ctx.privateRepoUrls.has(srcNorm)) return false;

  for (const h of [hostOf(pkg.source?.url), hostOf(pkg.dist?.url)]) {
    if (h && !SHARED_PUBLIC_HOSTS.has(h) && ctx.privateHosts.has(h)) return false;
  }
  return true;
}

/** Build classification context from composer.json `repositories`. */
export const composerCtxFromRepositories = (repositories: unknown): ComposerCtx => {
  const privateRepoUrls = new Set<string>();
  const privateHosts = new Set<string>();
  let packagistDisabled = false;

  const entries: unknown[] = Array.isArray(repositories)
    ? repositories
    : repositories && typeof repositories === "object"
      ? Object.values(repositories as Record<string, unknown>)
      : [];

  // packagist disable: {"packagist.org": false} in either array or object form
  const flat = Array.isArray(repositories)
    ? (repositories as Record<string, unknown>[])
    : repositories && typeof repositories === "object"
      ? [repositories as Record<string, unknown>]
      : [];
  for (const r of flat) {
    if (r && (r["packagist.org"] === false || r["packagist"] === false)) packagistDisabled = true;
  }

  for (const e of entries) {
    if (!e || typeof e !== "object") continue;
    const r = e as { type?: string; url?: string };
    if (r.type === "path") continue; // path handled per-package via dist.type
    if (!r.url) continue;
    const host = hostOf(r.url);
    if (host && SHARED_PUBLIC_HOSTS.has(host)) {
      const n = normalizeRepo(r.url);
      if (n) privateRepoUrls.add(n);
    } else if (host) {
      privateHosts.add(host);
    }
  }

  return { privateRepoUrls, privateHosts, packagistDisabled };
}
