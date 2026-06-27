# Deployment Operations

Configuration templates and environment mappings for staging and production.

## Purpose
Governs deployment targets, ports allocation, environment keys mappings, and staging workflows.

## Status
- **Status**: Active
- **Review Status**: Phase 5.11 Cloudflare Pages staging target selected.

## Scope
Directly plans host infrastructure configurations.

## Guidelines
- Separate staging and production environments clearly (different API endpoints, databases).
- Automate deployment checks before releasing images.
- Phase 5.11 staging target: **Cloudflare Pages**, using a dedicated staging project named `miraichi-staging`.
- Phase 5.11 staging deployment mode: Direct Upload with Wrangler after `pnpm run verify:release` and `pnpm run build:web-static` pass.
- Production deployment remains blocked until all planned release phases are complete, staging smoke checks pass, and the owner gives explicit final-release approval.
- Do not deploy API, local-ai, worker, database, auth, cloud sync, or production schemas for Phase 5.11 staging.

## TODO / Next Steps
- [x] Select Cloudflare Pages as the Phase 5.11 web/PWA staging target.
- [x] Add `apps/web` static export for Cloudflare Pages.
- [x] Create the Cloudflare Pages project `miraichi-staging`.
- [x] Configure `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` outside the repository.
- [x] Record the real staging URL after the first successful deployment: `https://eff8f868.miraichi-staging.pages.dev`.
- [x] Defer formal owner-feedback and production promotion until all planned release phases are complete.
