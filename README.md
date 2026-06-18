# SAGE — Software Advisory & Guidance Engine

A research-first work gate for AI coding agents. SAGE stops an agent from
overengineering or ignoring better options by making it **research before it writes
code**: check what is already installed, read the version-pinned docs, and only
then (if nothing fits) search and health-check packages.

It exists because of two real failures it prevents:
- an agent hand-rolled `useEffect` polling while **SWR was already installed**;
- an agent invented a Laravel Pennant workaround instead of the **documented
  `intercept` API**.

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

## Install (one paste into Claude Code)

Requires [Bun](https://bun.sh). Open Claude Code and paste:

> Install SAGE: run `git clone --single-branch --depth 1 https://github.com/eurechasherij/sage.git ~/.claude/skills/sage && cd ~/.claude/skills/sage && ./setup`, then add a "sage" section to CLAUDE.md saying to run the `/work` skill before implementing any ticket in an npm or composer project. Then ask me if I also want SAGE added to the current project for teammates.

That clones SAGE into `~/.claude/skills/sage` and registers the hosted `sage` MCP
(`https://sage.rematcha.dev/mcp`). The `/work` skill is then available everywhere.
Nothing to build, no `bun install`, no local server — the data service is hosted and
the scanner the skill runs has no dependencies. (Bun is required to run the scanner.)

## The host-side engine (run by the skill, not by you)

`/work` reads local lockfiles by running the bundled TypeScript via Bun — no build,
no global CLI to install:

```
bun run ~/.claude/skills/sage/src/cli.ts scan                 # installed deps + public-coordinate flags
bun run ~/.claude/skills/sage/src/cli.ts match "<capability>" # installed packages that may already cover it
```

`scan` is the privacy boundary in code (decides what is safe to send to the MCP);
the skill calls it so the agent never re-implements lockfile parsing or eyeballs
"is this package private". The same logic backs the future CI/hook enforcement.

## Deploy the MCP service (Cloudflare Workers, push-to-deploy)

The MCP service runs as a stateless Cloudflare Worker (`src/worker.ts`, served at
`/mcp` via `createMcpHandler`). `wrangler.jsonc` configures it (`nodejs_compat`, no
Durable Objects).

**Live:** the landing page is at `https://sage.rematcha.dev/` and the MCP at
`https://sage.rematcha.dev/mcp` (the install one-liner registers it).

Push-to-deploy via **Workers Builds**: the GitHub repo is connected with **Build
command** empty and **Deploy command** `npx wrangler deploy`. Cloudflare's build
server runs that on every push to the production branch — you never run it locally.
`/` serves `public/index.html`; `/mcp` is the stateless MCP. The custom domain
`sage.rematcha.dev` is attached to the Worker in the Cloudflare dashboard.

Local checks before pushing: `bun run typecheck`, `bunx wrangler deploy --dry-run`
(bundles without deploying), `bun run dev:worker` (runs it locally on
`http://localhost:8787/mcp`).

## Enforcement (optional — make the gate a hard wall)

By default `/work` is a strong convention. To make it non-skippable:

- **PreToolUse hook (local):** blocks editing source code until a research decision
  (`.sage/decisions/`) exists. Add to `~/.claude/settings.json`:
  ```json
  { "hooks": { "PreToolUse": [ { "matcher": "Edit|Write|MultiEdit",
    "hooks": [ { "type": "command",
      "command": "bun run ~/.claude/skills/sage/hooks/pre-tool-use.ts" } ] } ] } }
  ```
  Escape hatch: `SAGE_GATE=off`.
- **CI check (PR-time):** copy `templates/sage-gate.yml` to a repo's
  `.github/workflows/` — it fails a PR that changed source without a decision,
  catching the skip before CI spend piles up.

Both are thin wrappers over the tested `src/enforce/gate.ts`.

## Develop

This project uses [Bun](https://bun.sh).

```
bun install
bun run typecheck   # tsc, checks all sources incl. tests
bun test ./src      # bun:test; pure logic unit-tested with a fake fetch (no network)
bun run build       # tsc -p tsconfig.build.json -> dist/ (excludes tests; bins: sage, sage-mcp)
```
