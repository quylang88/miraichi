# Data Source Plan

External sports data providers integration guidelines.

## Purpose
Identifies criteria for selecting future sports APIs (odds, fixtures, stats) and details abstraction design.

## Status
- **Status**: Active

## Scope
Guidelines for provider selection and mock data adapter specifications.

## Data Providers
- **Primary Fixtures/Odds Feeds**: Deferred. A public website source requires a new owner-approved ADR. No production credentials or connectivity code is authorized by this document.
- **Phase 3 Local Source**: A static, generic mock JSON fixture source mimicking real-world payload structures. All identifiers use generic terms (e.g., `competition-alpha`, `team-alpha`, `match-alpha-001`).

## TODO / Next Steps
- [ ] Align provider evaluation matrix against source selection criteria.
- [ ] Implement local mock provider adapters.
