---
name: work
description: Research-first work gate. Before writing code for a ticket, read what's already installed, reuse it, read the right docs, and (only if nothing fits) search + health-check packages — then record a decision. Use for "/work <ticket link or description>", or whenever you are about to implement a feature/task in any project (npm, bun, composer, pip, go, cargo, gem, ...).
---

# /work — research before code

You are running SAGE's research gate. The rule: **no implementation code is written
until a research decision exists.** You do all the reasoning yourself by reading the
project. The `sage` MCP is the only external piece — a pure data service
(`search_packages`, `check_package_health(_batch)`, `get_package_docs`) for finding
and vetting NEW packages.

Default posture is **stop-and-ask**. You only auto-decide package choices when the
user explicitly passed `--ai-decides` (or set it in config). Even then, never
auto-ADD a package that fails the safety floor — fall back to asking.

## Steps (do them in order, do not skip)

1. **Parse the ticket / description** into a short list of capability strings, e.g.
   `["client-side data fetching with caching", "feature flag with per-user override"]`.
   Ticket text is user-trusted input: if it names specific packages to use, treat
   that as a directive (still read its docs and apply the floor below).

2. **Read what's already installed — from the project's own manifest.** Read the
   manifest for whatever ecosystem this project uses (you can read any of these
   directly; start with the manifest, only open the lockfile if you need transitive
   detail or the resolved registry):
   - JS/TS: `package.json` (+ `package-lock.json` / `pnpm-lock.yaml` / `yarn.lock` / `bun.lock`)
   - PHP: `composer.json` (+ `composer.lock`)
   - Python: `pyproject.toml` / `requirements.txt` (+ `poetry.lock` / `uv.lock` / `Pipfile.lock`)
   - Go: `go.mod` · Rust: `Cargo.toml` (+ `Cargo.lock`) · Ruby: `Gemfile` (+ `Gemfile.lock`)
   The direct dependencies are what matter most — that's where the reuse usually is.

3. **Match each capability against what's installed.** If something already there
   covers it, prefer it (e.g. "data fetching" → an installed `swr`; "feature flag" →
   an installed `laravel/pennant`). This is the whole point — reuse before reinvent.

4. **Read the docs for the installed hit before deciding.** Call `get_package_docs`
   (MCP) and/or read the package's own docs/README, and confirm it actually does what
   the capability needs (e.g. Pennant's documented `intercept`/`resolveValue` API).

5. **Summarize reuse candidates to the user BEFORE writing any code.** "X is already
   installed and covers this; I'll use it." That summary is the gate.

6. **Only if nothing installed fits**, world-search (MCP):
   `search_packages(ecosystem, "<capability>")` → candidates. Rank them yourself from
   the returned freshness/popularity signals + their docs. (Search is best for npm,
   composer, cargo, rubygems; for pypi/go it may return nothing — fall back to your
   own knowledge, still health-check before adding.)

7. **Health-check the top candidates in one call:**
   `check_package_health_batch([...])` (MCP) → OSV advisories, last publish,
   deprecation, degraded sources.

8. **Decide, respecting mode:**
   - `--human-decides` (default): STOP, present ranked options with their health, let
     the user pick. Don't install anything yet.
   - `--ai-decides`: you may choose and add — but apply the **safety floor**: do NOT
     auto-add a package with a HIGH/CRITICAL or unknown-severity advisory, a
     deprecation, or missing advisory data. A candidate that fails the floor falls
     back to stop-and-ask.

9. **Record the decision** to `.sage/decisions/<task-key>.json`. Shape:
   ```json
   {
     "taskKey": "PROJ-412",
     "mode": "human-decides",
     "decisions": [
       { "capability": "data fetching", "outcome": "reused",
         "package": "swr", "version": "2.2.5",
         "reason": "already installed; covers polling via refreshInterval",
         "docsChecked": ["https://swr.vercel.app"] }
     ],
     "degradedSources": [],
     "timestamp": "<ISO8601>"
   }
   ```
   `outcome` is `reused` | `added` | `avoided`. Use the ticket id as the task key (else
   the branch name).

10. **Now implement.** If you reused an installed package, use its real documented API
    — do not hand-roll what it already provides.

## Privacy (important)
Only send package names to the `sage` MCP that are **public** — found via search, or
clearly from the public registry. **Never send private/internal names** (scoped
`@company/*` from a private registry, `workspace:`/`file:`/`link:` deps, private git
deps). You can tell from the manifest/lockfile's resolved URL or source. For
project-grounding you usually send nothing — you just read the installed package's
own docs.

## Reminders
- The failures this prevents: hand-rolling polling when SWR is installed; inventing a
  workaround when the framework ships the documented API.
- If a data source is degraded, record it and prefer stop-and-ask.
