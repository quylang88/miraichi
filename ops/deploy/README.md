# Deployment Operations

Configuration templates and environment mappings for staging and production.

## Purpose
Governs deployment targets, ports allocation, environment keys mappings, and staging workflows.

## Status
- **Status**: Active
- **Review Status**: Phase 5.11 Railway staging target selected.

## Scope
Directly plans host infrastructure configurations.

## Guidelines
- Separate staging and production environments clearly (different API endpoints, databases).
- Automate deployment checks before releasing images.
- Phase 5.11 staging target: **Railway**, using a dedicated staging project named `miraichi-staging` and service `miraichi-web-staging`.
- Phase 5.11 staging deployment mode: Git-connected or CLI Railway deployment after `pnpm run verify:release` passes.
- Production deployment remains blocked until staging smoke checks pass and the owner gives explicit approval.
- Do not deploy API, local-ai, worker, database, auth, cloud sync, or production schemas for Phase 5.11 staging.

## TODO / Next Steps
- [x] Select Railway as the Phase 5.11 web/PWA staging target.
- [ ] Create the Railway project `miraichi-staging`.
- [ ] Create the Railway service `miraichi-web-staging`.
- [ ] Configure a Railway project/service token outside the repository.
- [ ] Record the real staging URL after the first successful deployment.
