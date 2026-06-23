# ADR-0009: Competition Configuration and Registry Boundary

## Status
- **Status**: Draft
- **Source candidate**: Candidate 008
- **Date**: 2026-06-23

## Context
Miraichi must support multiple competitions over time without hard-coding competition names, phases, formats, or rules into core application logic. Core concepts should remain generic across competition, season, team, match, player, market, prediction, bet, bankroll, and risk rule boundaries.

## Decision to Be Made
Decide where competition-specific metadata belongs and how core application boundaries should consume it without becoming competition-specific.

## Options Considered
- Use configuration-driven competition metadata.
- Use provider-data-driven competition metadata.
- Use a database-managed competition registry.
- Use hybrid configuration plus provider data, with core code using generic concepts only.

## Draft Recommendation
Keep core concepts generic and place competition-specific metadata in configuration or provider data rather than app logic. Defer final storage and validation shape to later decisions.

## Consequences
- Preserves competition-agnostic architecture.
- Makes competition-specific assumptions easier to review.
- Requires clear review rules so configuration does not become hidden business logic.

## Risks
- Configuration can become an unreviewed place for business logic.
- Provider data can leak inconsistent naming into shared concepts.
- Early examples can become implicit defaults if review checks are weak.

## Open Questions
- Which competition details belong in configuration versus provider data?
- What generic vocabulary is mandatory across app and package boundaries?
- What review checks should block hard-coded competition assumptions?

## Owner Approval Required
Project owner approval is required before this ADR can become Accepted or authorize implementation planning.

## Implementation Status
- **Implementation status**: Not started
