# Alerting Strategy

Rules for notifying developers on errors and downtime events.

## Purpose
Establishes the severity levels and pager routing for exceptions.

## Status
- **Status**: Draft
- **Review Status**: Phase 6 planning active; alert routing pending owner approval.

## Scope
Directly plans pager channels and alert parameters.

## Alerting Levels
- **P1 - Critical**: Staging smoke check cannot load the web/PWA shell after deployment.
- **P2 - Warning**: Service worker marker mismatch or manifest unavailable on staging.
- **P3 - Info**: Manual QA finding or non-blocking console warning.

## TODO / Next Steps
- [ ] Decide whether alerts stay manual in Phase 6 or use a provider after owner approval.
