# Deployment Strategy

High-level outline of deployment environments and targets for Miraichi.

## Purpose
This document provides instructions and conceptual designs for delivering apps to staging and production.

## Status
- **Status**: Frankfurt staging is configured. Follow the current
  [Supabase Edge + Cloudflare runbook](docs/operations/SUPABASE-EDGE-CLOUDFLARE-OWNER-HOSTING.md)
  and `PROJECT_PLAN.md` for exact candidate evidence. Production remains unapproved.

## Scope
Applies to deployments of `apps/web`, `apps/api`, and approved `apps/worker` ingestion jobs.

## Deployment Guidelines
- All deployment work must follow `.agent/skills/miraichi-delivery-lifecycle/SKILL.md`.
- Run `pnpm run verify:staging`, the actual local Edge/SQL gates and artifact checks before staging.
- Run the committed `pnpm run test:e2e:staging` after each deployment, then
  `pnpm run verify:staging:hosted` after restoration. Local verification is not hosted evidence.
- Production promotion requires staging smoke evidence and explicit owner approval.
- If staging or production targets are not configured, fail fast and report the missing target.
- All deployment environments must be configured using dynamic environment variables.
- Deployments should be fully automated via CI/CD pipelines specified in ops/ci/.

## Next Steps
- Close the active phase using its fresh hosted evidence and owner feedback.
- Create or promote production only after an explicit owner decision; do not reuse staging approval.
