# Testing & Verification Workflow

Procedures for verifying code updates.

## Purpose
Establishes testing patterns for units, integration layers, and system APIs.

## Status
- **Status**: Draft

## Scope
Directly plans tests suites layout and runtime checks.

## Guidelines
- Follow `.agent/skills/miraichi-delivery-lifecycle/SKILL.md` for test gates.
- Write a failing unit test before each new feature, bug fix, refactor, or behavior change.
- Unit tests run with Vitest through `pnpm run test:unit`.
- Coverage evidence runs through `pnpm run test:unit:coverage`; new or modified behavior targets 80% coverage as a review gate.
- Integration verification runs through `pnpm run test:integration`.
- Release verification runs through `pnpm run verify:release`.
- Isolate test mock databases from staging/production configurations.
- Placeholder pass-only scripts such as `node -e "... pass"` are forbidden.

## Test Layout
- Unit tests are colocated with the source they verify. Use `*.test.{js,ts}` next to the module, for example `src/foo.test.ts` beside `src/foo.ts` or `src/foo.test.js` beside `src/foo.js`.
- Integration tests belong in `tests/integration/` when they are conventional test-runner suites. Existing project verifiers may remain in `scripts/*integration*` when they orchestrate services or phase checks.
- E2E tests belong in `tests/e2e/` once they cover browser or full user-flow behavior. Existing endpoint smoke verifiers may remain wired through `pnpm run test:e2e` until they are migrated intentionally.
- Shared test helpers and sample data belong in `test-utils/`, `fixtures/`, or `__fixtures__/` under the owning package or app.
- Integration and E2E coverage never replaces the colocated unit test required for a changed behavior.

## TypeScript Test Direction
- ADR-0034 defines TypeScript as the gradual technical direction for typed contracts and domain boundaries.
- Do not perform a big-bang migration. Existing `.test.js` files stay valid until their source module is migrated or the test file is being materially changed.
- New tests for TypeScript modules must use `*.test.ts`.
- New app modules must be TypeScript-first. For new `apps/*/src` implementation code, write `.ts` modules and colocated `*.test.ts` tests unless the file is an explicit legacy runtime bridge.
- Prefer `.ts` for new shared contracts, config, validators, and pure domain helpers. App routes and runtime entrypoints migrate later after their lower-level contracts are stable.
- If a future build bundles application code, exclude `*.test.{js,ts}` from production artifacts explicitly.

## TODO / Next Steps
- [ ] Define code coverage target ratios (e.g. 80% coverage).
