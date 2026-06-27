# Production Deployment Plan

Live release procedures and target scaling parameters.

## Purpose
Establishes the steps for zero-downtime rolling releases of application images.

## Status
- **Status**: Draft

## Scope
Directly plans live system releases, failovers, and backup schemes.

## Production Guidelines
- Follow `.agent/skills/miraichi-delivery-lifecycle/SKILL.md` before any production action.
- Production promotion is blocked until staging smoke checks pass and the owner gives explicit approval.
- Local verification alone is not production approval.
- Releases must use tag versions (e.g. `v1.0.0`) approved in staging.
- Set up automatic database backup before running schema migrations.

## TODO / Next Steps
- [ ] Configure manual approval gates for production runs.
