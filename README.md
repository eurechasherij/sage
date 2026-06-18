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
   `https://sage.rematcha.dev/mcp`. Local/dev: `node dist/mcp/stdio.js` (after build).
2. Copy `skill/SKILL.md` into your agent's skills dir as `work/SKILL.md`, then run
   `/work <ticket>`.

## CLI

```
sage scan [dir]                 # installed deps + public-coordinate flags
sage match "<capability>" [dir] # installed packages that may already cover it
```

## Develop

```
npm install
npm run typecheck
npm test          # vitest; pure logic unit-tested with a fake fetch (no network)
npm run build     # emits dist/ (bins: sage, sage-mcp)
```

## Status

Host-side-first slice of v1 is built and tested: dependency scanner (npm +
composer) with privacy classification, the data layer (search/health/docs with
graceful degradation), the auto-install safety floor, the capability matcher, the
decision artifact with integrity binding, the pure-data MCP server, the CLI, and
the `/work` skill.

Not yet built (planned, see the design docs): the hosted deployment to
sage.rematcha.dev, Context7-backed exact versioned docs, and the enforcement
increment (a PreToolUse hook or CI check that makes the gate non-skippable —
v1 is a strong convention, not a hard wall). Run the 20-task replay benchmark
before investing further in world-search depth.
