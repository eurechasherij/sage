# SAGE — conventions

SAGE (Software Advisory & Guidance Engine): a research-first work gate for coding
agents. See `docs/design-001-research-first-work-gate.md` for the architecture.

## Code style
- **Prefer `export const foo = (...) => {...}` over `export function foo(...) {}`** for
  all exported functions. SAGE does not use Inertia, so there is no `export default
  function` exception here — everything is `export const`.
- Internal (non-exported) helpers may stay as `function` declarations when hoisting
  is relied on (e.g. a helper used above its definition).
- TypeScript, ESM (`NodeNext`), strict mode with `noUncheckedIndexedAccess`.
- **Bun** is the toolchain: `bun install`, `bun test ./src`, `bun run build`. Bun
  runs `.ts` directly (e.g. `bun run src/replay/run.ts`), no build needed for dev.
- Tests are `bun:test`, colocated as `*.test.ts`, run with `bun test ./src` (scoped
  to src so the compiled `dist/` copies are not double-run). Pure logic is
  unit-tested with an injected fake `fetch` — no live network in the test suite.
- `tsconfig.build.json` (build) excludes tests from `dist/`; `tsconfig.json`
  (typecheck) includes them.

## Architecture invariant
All model reasoning lives in the agent; the hosted service (`sage.rematcha.dev`) is a
pure, stateless data API (`src/data/`, exposed via `src/mcp/server.ts`). There is no
local scanner/CLI — the `/work` skill (`work/SKILL.md`) has the agent read the
project's manifest itself, which is why every ecosystem works without a parser.
Private package names never leave the machine: the skill instructs the agent to send
only public package names to the service.
