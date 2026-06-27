# Deployment Targets

Cloud platforms and host instances layout.

## Purpose
Specifies hosting services, load balancers, and network structures.

## Status
- **Status**: Active
- **Review Status**: Phase 5.11 web staging target selected.

## Scope
Infrastructure details for web, api, local-ai, and background workers.

## Target Architecture
- **Web App Staging**: Cloudflare Pages project `miraichi-staging`.
- **Web App Production**: Deferred until all planned release phases are complete and final owner approval is explicit.
- **Backend API & Workers**: AWS ECS / GCP Cloud Run / VPS.
- **Local AI Inference**: Dedicated GPU instance (AWS EC2 / RunPod) or serverless CPU environments.

## Phase 5.11 Staging Target Decision

Cloudflare Pages is selected as the Phase 5.11 staging target for the web/PWA surface.

Rationale:

- Phase 5.11 persistence is local-first browser storage, so staging does not need a server database.
- The web surface has a static export artifact at `apps/web/dist`, rebuilt by `pnpm run verify:staging` before staging deployment.
- Cloudflare Pages Free fits a static PWA staging target without paid server runtime.
- A dedicated staging project avoids mixing preview/staging URLs with future production.
- Direct Upload keeps staging independent from a full CI/CD workflow while production deployment remains deferred.

Constraints:

- The staging target covers `apps/web` only.
- API, local-ai, worker, database, auth, and cloud sync remain out of scope.
- The project owner must provide Cloudflare account access and deployment token before deployment can run.
- Production target selection remains separate and requires explicit final-release owner approval.

## TODO / Next Steps
- [x] Select Cloudflare Pages for Phase 5.11 web staging.
- [x] Add static export artifact generation through `pnpm run verify:staging` and `pnpm run deploy:staging`.
- [x] Create Cloudflare Pages project `miraichi-staging`.
- [x] Configure `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` outside the repository.
- [x] Record the actual Pages URL after first deployment: `https://eff8f868.miraichi-staging.pages.dev`.
