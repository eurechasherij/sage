# SAGE — Software Advisory & Guidance Engine

A research-first work gate for AI coding agents. SAGE stops an agent from
overengineering or ignoring better options by making it **research before it writes
code**: check what is already installed, read the version-pinned docs, and only
then (if nothing fits) search and health-check packages.

It exists because of two real failures it prevents:
- an agent hand-rolled `useEffect` polling while **SWR was already installed**;
- an agent invented a Laravel Pennant workaround instead of the **documented
  `intercept` API**.

See [`docs/design-001-research-first-work-gate.md`](docs/design-001-research-first-work-gate.md)
for the full design and [`docs/design-002-landing-page.md`](docs/design-002-landing-page.md)
for the landing page.

## How it fits together

```
HOST (your machine / the agent)          SERVICE (sage.rematcha.dev — pure data)
  /work skill ........ the gate           search_packages
  sage scan .......... installed deps     check_package_health(_batch)
  sage match ......... reuse candidates    get_package_docs
  evaluateFloor ...... auto-install gate
  decision artifact .. .sage/decisions/
```

All model reasoning is host-side. The service is a thin, stateless aggregator over
deps.dev / OSV / npm / Packagist. Private package names never leave the machine
(`src/scanner/classify.ts`).

## Install (for an agent project)

1. Add the MCP server. Production (hosted): point your agent at
   `https://sage.rematcha.dev/mcp`. Local/dev: `bun run dev:mcp` (runs the TS
   directly), or `node dist/mcp/stdio.js` after a build.
2. Copy `skill/SKILL.md` into your agent's skills dir as `work/SKILL.md`, then run
   `/work <ticket>`.

## CLI

```
bun run src/cli.ts scan [dir]                 # installed deps + public-coordinate flags
bun run src/cli.ts match "<capability>" [dir] # installed packages that may already cover it
```

(After `bun run build`, the `sage` / `sage-mcp` bins run the compiled `dist/`.)

## Develop

This project uses [Bun](https://bun.sh).

```
bun install
bun run typecheck   # tsc, checks all sources incl. tests
bun test ./src      # bun:test; pure logic unit-tested with a fake fetch (no network)
bun run build       # tsc -p tsconfig.build.json -> dist/ (excludes tests; bins: sage, sage-mcp)
```

## Status

Host-side-first slice of v1 is built and tested: dependency scanner (npm +
composer) with privacy classification, the data layer (search/health/docs with
graceful degradation), the auto-install safety floor, the capability matcher, the
decision artifact with integrity binding, the pure-data MCP server, the CLI, and
the `/work` skill.

Not yet built (planned, see the design docs): **bun/pnpm/yarn lockfile scanning**
(only `package-lock.json` + `composer.lock` today — note SAGE's own repo now uses
`bun.lock`, so it can't yet scan itself), the hosted deployment to sage.rematcha.dev,
Context7-backed exact versioned docs, and the enforcement increment (a PreToolUse
hook or CI check that makes the gate non-skippable — v1 is a strong convention, not
a hard wall). Run the 20-task replay benchmark before investing further in
world-search depth.
