# Production Deployment Plan

Live release procedures and target scaling parameters.

## Purpose
Establishes the steps for zero-downtime rolling releases of application images.

## Status
- **Status**: Draft
- **Review Status**: Deferred until final-release review after all planned phases are complete.

## Scope
Directly plans live system releases, failovers, and backup schemes.

## Production Guidelines
- Follow `.agent/skills/miraichi-delivery-lifecycle/SKILL.md` before any production action.
- Production promotion is blocked until all planned release phases are complete, staging smoke checks pass, and the owner gives explicit final-release approval.
- Local verification alone is not production approval.
- Releases must use tag versions (e.g. `v1.0.0`) approved in staging.
- Set up automatic database backup before running schema migrations.
- Phase 5.11 Cloudflare Pages staging target selection does not select a production target.
- Do not promote Phase 5.11 or any later intermediate phase to production. Production is a final-release phase only.

## TODO / Next Steps
- [ ] Configure manual approval gates for production runs.
- [ ] Define the final-release owner review checklist after all planned phases are complete.
