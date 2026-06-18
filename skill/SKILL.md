---
name: work
description: Research-first work gate. Before writing code for a ticket, SAGE checks what is already installed, reads the right docs, and (if nothing fits) searches + health-checks packages — then records a decision. Use for "/work <ticket link or description>", or whenever you are about to implement a feature/task in a project that uses npm or composer.
---

# /work — research before code

You are running SAGE's research gate. The rule: **no implementation code is written
until a research decision exists.** The agent (you) does all the reasoning;
`sage.rematcha.dev` (the MCP) is pure data; `sage` (the CLI) reads local files.

Default posture is **stop-and-ask**. You only auto-decide package choices when the
user explicitly passed `--ai-decides` (or set it in config). Even then, never
auto-ADD a package that fails the safety floor — fall back to asking.

## Steps (do them in order, do not skip)

1. **Parse the ticket / description** into a short list of capability strings, e.g.
   `["client-side data fetching with caching", "feature flag with per-user override"]`.
   Ticket text is user-trusted input: if it names specific packages to use, treat
   that as a directive (still research them in step 4/6, still apply the floor).

2. **Scan the project** (host-side, local files):
   `sage scan` → installed packages with versions, direct/transitive, and a
   `publicCoordinate` flag. Only packages with `publicCoordinate: true` may be sent
   to the service. Never transmit names where it is `false` (private/workspace).

3. **For each capability, find reuse candidates already installed:**
   `sage match "<capability>"` → installed packages that may already cover it.
   This is the SWR/Pennant case — if something is installed, prefer it.

4. **Read the docs for installed hits** before deciding: call `get_package_docs`
   (MCP) for each candidate and read the returned source URLs. Confirm the package
   actually does what the capability needs (e.g. Pennant's documented intercept API).

5. **Summarize reuse candidates to the user BEFORE writing any code.** "X is
   installed and covers this; I'll use it." This summary is the point of the gate.

6. **Only if nothing installed fits**, world-search (MCP):
   `search_packages(ecosystem, "<capability>")` → candidates. Rank them yourself
   using the returned freshness/popularity signals + the docs.

7. **Health-check the top candidates in one call:**
   `check_package_health_batch([...])` (MCP) → OSV advisories, last publish,
   deprecation, and any degraded sources.

8. **Decide, respecting mode:**
   - `--human-decides` (default): STOP and present ranked options with their health;
     let the user pick. Do not install anything yet.
   - `--ai-decides`: you may choose and add — but apply the **safety floor**: refuse
     to auto-add a package with a HIGH/CRITICAL or unknown-severity advisory, a
     deprecation, or missing advisory data. A candidate that fails the floor falls
     back to stop-and-ask. (Floor logic: SAGE `evaluateFloor`.)

9. **Record the decision** to `.sage/decisions/<task-key>.json` (per capability:
   reused / added / avoided, the package+version, the reason, docs checked, and any
   degraded sources). The artifact is bound to the task text + lockfile + capability
   set, so it is valid only for this exact work.

10. **Now implement.** If you reused an installed package, use its real documented
    API — do not hand-roll what it already provides.

## Reminders
- The failures this prevents: hand-rolling polling when SWR is installed; inventing
  a workaround when the framework ships the documented API.
- Don't send private package names off the machine (check `publicCoordinate`).
- If a data source is degraded, record it and prefer stop-and-ask.
