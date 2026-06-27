# System Monitoring

Observability, log collectors, metric summaries, and slack/pager alerts.

## Purpose
Ensures that server exceptions, slow routes, or ML prediction errors are caught.

## Status
- **Status**: Draft
- **Review Status**: Deferred until Phase 6 planning.

## Scope
Directly plans monitoring structures, tracking metrics, and alert routing levels.

## Guidelines
- Mask personal user betting information and passwords inside server logs.
- Group metrics by application tags (web, api, worker, local-ai).

## TODO / Next Steps
- [ ] Connect monitor services (e.g. Sentry, Datadog).
