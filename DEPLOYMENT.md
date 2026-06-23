# Deployment Strategy

High-level outline of deployment environments and targets for Miraichi.

## Purpose
This document provides instructions and conceptual designs for delivering apps to staging and production.

## Status
- **Status**: Draft

## Scope
Applies to deployments of `apps/web`, `apps/api`, `apps/local-ai`, and `apps/worker`.

## Deployment Guidelines
- All deployment environments must be configured using dynamic environment variables.
- Deployments should be fully automated via CI/CD pipelines specified in ops/ci/.

## TODO / Next Steps
- [ ] Define staging and production server infrastructure.
- [ ] Implement Docker orchestration scripts under ops/docker/.
