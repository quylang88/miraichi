# Staging Deployment Plan

Validation target configurations for testing.

## Purpose
Establishes the parameters for automated deployment of PRs to a staging environment.

## Status
- **Status**: Draft
- **Review Status**: Deferred until Phase 6 planning.

## Scope
Maps sandbox URLs, mock databases, and staging test suites.

## Staging Rules
- Follow `.agent/skills/miraichi-delivery-lifecycle/SKILL.md` before any staging action.
- `pnpm run verify:release` must pass before staging deployment.
- If staging targets, credentials, or sandbox URLs are not configured, fail fast and report the missing target instead of pretending a deployment happened.
- Trigger staging deployments on any merge to the release integration branch.
- Execute validation test runs on staging before promoting to production.
- Prepare an owner review pack with changed scope, test evidence, staging URL, known risks, and rollback notes.

## TODO / Next Steps
- [ ] Setup testing database container configs for staging.
