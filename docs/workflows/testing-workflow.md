# Testing & Verification Workflow

Procedures for verifying code updates.

## Purpose
Establishes testing patterns for units, integration layers, and system APIs.

## Status
- **Status**: Active

## Scope
Directly plans tests suites layout and runtime checks.

## Guidelines
- Follow `.agent/skills/miraichi-delivery-lifecycle/SKILL.md` for test gates.
- Write a failing unit test before each new feature, bug fix, refactor, or behavior change.
- Unit tests run with Vitest through `pnpm run test:unit`.
- Coverage evidence runs through `pnpm run test:unit:coverage`; new or modified behavior targets 80% coverage as a review gate.
- Current code slices require unit/local verification only. Do not run integration or endpoint E2E after every small implementation slice.
- Integration verification runs through `pnpm run test:integration` only after a large feature boundary is complete.
- Release verification runs through `pnpm run verify:release` after the large feature boundary has passed integration and is ready for staging/release review.
- Isolate test mock databases from staging/production configurations.
- Placeholder pass-only scripts such as `node -e "... pass"` are forbidden.

## Large Feature Boundary Rule
- A large feature boundary is a feature-complete milestone whose behavior crosses modules, routes, app surfaces, or runtime processes.
- Examples include one completed production tab (`Today`, `Matches`, `Bets`, `Bankroll`, or `Miraichi`), a complete local AI training workflow, a complete LLM capability, a complete persistence adapter, or a complete endpoint-backed workflow.
- Before that boundary is complete, run the targeted failing unit test, the passing unit test, and relevant local checks.
- After that boundary is complete, run `pnpm run test:integration`; endpoint E2E belongs here, not inside every small code slice.

## Test Layout
- Unit tests are colocated with the source they verify. Use `*.test.{js,ts}` next to the module, for example `src/foo.test.ts` beside `src/foo.ts` or `src/foo.test.js` beside `src/foo.js`.
- Integration tests belong in `tests/integration/` when they are conventional test-runner suites. Existing project verifiers may remain in `scripts/*integration*` when they orchestrate services or phase checks.
- E2E tests belong in `tests/e2e/` once they cover browser or full user-flow behavior. Existing endpoint smoke verifiers may remain wired through `pnpm run test:e2e` until they are migrated intentionally.
- Shared test helpers and sample data belong in `test-utils/`, `fixtures/`, or `__fixtures__/` under the owning package or app.
- Integration and E2E coverage never replaces the colocated unit test required for a changed behavior.

## TypeScript Test Direction
- ADR-0034 defines TypeScript as the gradual technical direction for typed contracts and domain boundaries.
- Do not perform an unapproved big-bang migration. The owner-approved Phase 6 repo-wide migration moved tracked implementation source under `apps/`, `packages/`, and `scripts/` to TypeScript; future work must keep that source TypeScript-first.
- The `*.test.{js,ts}` pattern remains documented for historical compatibility and external test discovery, but new or modified Miraichi source tests must use `*.test.ts`.
- New tests for TypeScript modules must use `*.test.ts`.
- New app modules must be TypeScript-first.
- New app/package/script implementation modules must be TypeScript-first. For new `apps/`, `packages/`, and `scripts/` implementation code, write `.ts` modules and colocated `*.test.ts` tests unless the owner explicitly approves a compatibility exception.
- Browser `.js` URLs and generated static `.js` artifacts may remain when backed by TypeScript source and covered by verification.
- A future JavaScript migration slice must identify exact files or file groups, expected behavior-preservation tests, runtime strategy, and the verification command before renaming files.
- If a future build bundles application code, exclude `*.test.{js,ts}` from production artifacts explicitly.

## TODO / Next Steps
- [ ] Define code coverage target ratios (e.g. 80% coverage).
