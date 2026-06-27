# Production Deployment Plan

Live release procedures and target scaling parameters.

## Purpose
Establishes the steps for zero-downtime rolling releases of application images.

## Status
- **Status**: Draft
- **Review Status**: Deferred until Phase 6 planning.

## Scope
Directly plans live system releases, failovers, and backup schemes.

## Production Guidelines
- Follow `.agent/skills/miraichi-delivery-lifecycle/SKILL.md` before any production action.
- Production promotion is blocked until staging smoke checks pass and the owner gives explicit approval.
- Local verification alone is not production approval.
- Releases must use tag versions (e.g. `v1.0.0`) approved in staging.
- Set up automatic database backup before running schema migrations.
- Phase 5.11 Cloudflare Pages staging target selection does not select a production target.
- Do not promote Phase 5.11 to production until a real staging URL exists, smoke checks pass, and owner approval is explicit.

## TODO / Next Steps
- [ ] Configure manual approval gates for production runs.
