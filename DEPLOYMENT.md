# Deployment Strategy

High-level outline of deployment environments and targets for Miraichi.

## Purpose
This document provides instructions and conceptual designs for delivering apps to staging and production.

## Status
- **Status**: Draft

## Scope
Applies to deployments of `apps/web`, `apps/api`, `apps/local-ai`, and `apps/worker`.

## Deployment Guidelines
- All deployment work must follow `.agent/skills/miraichi-delivery-lifecycle/SKILL.md`.
- Run `pnpm run verify:release` before staging.
- Production promotion requires staging smoke evidence and explicit owner approval.
- If staging or production targets are not configured, fail fast and report the missing target.
- All deployment environments must be configured using dynamic environment variables.
- Deployments should be fully automated via CI/CD pipelines specified in ops/ci/.

## TODO / Next Steps
- [ ] Define staging and production server infrastructure.
- [ ] Implement Docker orchestration scripts under ops/docker/.
