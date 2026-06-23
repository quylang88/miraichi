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

## TODO / Next Steps
- [ ] Implement monorepo boundary lints checking rules.
