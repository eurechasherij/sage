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
- Tests are vitest, colocated as `*.test.ts`. Pure logic is unit-tested with an
  injected fake `fetch` — no live network in the test suite.

## Architecture invariant
All model reasoning lives host-side; the hosted service (`sage.rematcha.dev`) is a
pure, stateless data API. Private package names never leave the machine — see
`src/scanner/classify.ts` (public-coordinate classification).
