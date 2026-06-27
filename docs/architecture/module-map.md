# Module Map

Code file mapping guidelines.

## Purpose
Specifies where components and modules belong in the monorepo.

## Status
- **Status**: Active

## Scope
File structures for packages and applications.

## Directory Mapping
- Common DB Entities -> `packages/shared/types`
- Global Feature Flag Toggles -> `packages/config/feature-flags`
- Styled Buttons/Modals -> `packages/ui`
- Scheduled Ingestion tasks -> `apps/worker`

## Test Placement
- Unit tests stay beside the module they verify as `*.test.{js,ts}`.
- Integration tests live in `tests/integration/` or remain as explicit `scripts/*integration*` verifiers when they orchestrate phase checks.
- E2E tests live in `tests/e2e/` once they represent browser or user-flow behavior.
- Fixtures and shared helpers belong in the owning package or app under `fixtures/`, `__fixtures__/`, or `test-utils/`.
- Normal code slices use colocated unit tests and relevant local checks. Integration and endpoint E2E are large feature boundary gates, not per-slice requirements.

## TypeScript migration order
1. `packages/shared`: typed contracts, pure shared helpers, domain-safe interfaces.
2. `packages/config`: feature flags, environment config, registries, and static config surfaces.
3. Validators and pure helpers in apps/packages.
4. App routes and UI modules after their contracts are typed.
5. Runtime entrypoints and operational scripts last.

New application modules must be TypeScript-first.

The Phase 6 owner-approved repo-wide migration has already moved tracked implementation source under `apps/`, `packages/`, and `scripts/` to TypeScript. The order above remains useful for future type hardening: contracts first, runtime boundaries last.

New application and package implementation modules must be TypeScript-first. Create new `apps/*/src` and `packages/*/src` implementation modules as `.ts` by default; add tracked `.js` source only when an explicit owner-approved compatibility exception names the file and reason.

Do not run an unapproved big-bang JavaScript-to-TypeScript migration. Browser `.js` URLs and generated `.js` build artifacts may remain when they are backed by TypeScript source and covered by verification.

## TODO / Next Steps
- [ ] Implement monorepo boundary lints checking rules.
