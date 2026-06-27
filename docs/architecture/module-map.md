# Module Map

Code file mapping guidelines.

## Purpose
Specifies where components and modules belong in the monorepo.

## Status
- **Status**: Draft

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

## TypeScript migration order
1. `packages/shared`: typed contracts, pure shared helpers, domain-safe interfaces.
2. `packages/config`: feature flags, environment config, registries, and static config surfaces.
3. Validators and pure helpers in apps/packages.
4. App routes and UI modules after their contracts are typed.
5. Runtime entrypoints and operational scripts last.

Do not run a big-bang JavaScript-to-TypeScript migration. Existing JavaScript remains valid until the owning module is part of an approved code slice.

## TODO / Next Steps
- [ ] Implement monorepo boundary lints checking rules.
