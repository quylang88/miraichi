# Bet History Auditing Plan

Recording and displaying historical user bets.

## Purpose
Plans how user-entered betting history can be displayed, grouped, and audited without authorizing persistence implementation.

## Status
- **Status**: Draft

## Scope
Documentation-level planning for match-grouped betting history and dashboard UI components. Production storage, table definitions, query endpoints, and migrations are deferred to owner-approved ADRs.

## Auditing Guidelines
- Multiple bets from the same match must appear under the same `matchGroupId`.
- Users must be able to edit/correct settlement status.
- Daily, weekly, and monthly report planning must use owner-approved candidate fields only.

## TODO / Next Steps
- [ ] Draft owner-approved ADRs before implementing bet history storage or query endpoints.
