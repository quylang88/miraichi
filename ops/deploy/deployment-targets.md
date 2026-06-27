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
- **Web App Staging**: Railway project `miraichi-staging`, service `miraichi-web-staging`.
- **Web App Production**: Deferred until staging smoke evidence and owner approval.
- **Backend API & Workers**: AWS ECS / GCP Cloud Run / VPS.
- **Local AI Inference**: Dedicated GPU instance (AWS EC2 / RunPod) or serverless CPU environments.

## Phase 5.11 Staging Target Decision

Railway is selected as the Phase 5.11 staging target for the web/PWA surface.

Rationale:

- Phase 5.11 persistence is local-first browser storage, so staging does not need a server database.
- The current web app is served by a Node HTTP process, not a static build artifact.
- Railway supports shared JavaScript monorepos and custom start commands, which matches the current pnpm workspace setup.
- A dedicated staging project avoids mixing preview/staging URLs with future production.
- Railway can stage the existing `apps/web` service without forcing a frontend build pipeline migration.

Constraints:

- The staging target covers `apps/web` only.
- API, local-ai, worker, database, auth, and cloud sync remain out of scope.
- The project owner must provide Railway account access and deployment token before deployment can run.
- Production target selection remains separate and requires explicit owner approval.

## TODO / Next Steps
- [x] Select Railway for Phase 5.11 web staging.
- [ ] Create Railway project `miraichi-staging`.
- [ ] Create Railway service `miraichi-web-staging`.
- [ ] Configure `RAILWAY_TOKEN` outside the repository when using CLI/CI deployment.
- [ ] Record the actual Railway public domain after first deployment.
