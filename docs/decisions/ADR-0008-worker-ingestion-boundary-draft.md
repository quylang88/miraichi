# ADR-0008: Worker-Based Data Ingestion Boundary

## Status
- **Status**: Accepted
- **Accepted Date**: 2026-06-23
- **Owner Approval**: Approved by project owner
- **Source candidate**: Candidate 006
- **Date**: 2026-06-23

## Context
Miraichi needs a boundary for external data-provider polling, normalization, freshness tracking, and data-quality checks. That boundary must keep provider-specific details out of core user-facing and local AI concepts.

## Decision to Be Made
Decide whether provider ingestion and normalization responsibilities should live behind an `apps/worker` boundary before implementation begins.

## Options Considered
- Use worker-based ingestion for provider polling and normalization.
- Use API-admin ingestion for early manual imports.
- Use manually curated data only until provider relationships are clearer.
- Use hybrid manual import plus worker refresh later.

## Draft Recommendation
Plan a worker boundary for provider-specific ingestion and normalization while deferring queue, scheduler, provider, and schema technology choices.

## Consequences
- Keeps slow or recurring provider work outside user-facing API requests.
- Creates a future home for retries, freshness, data-quality checks, and ingestion history.
- Requires later decisions about queueing, scheduling, monitoring, and provider contracts.

## Risks
- Worker planning can imply queue or scheduler choices too early.
- Manual-only data may hide ingestion failure modes.
- Provider-specific fields may leak into shared concepts if normalization rules are weak.

## Open Questions
- Which provider categories are needed first?
- Which failures should block predictions versus mark data as stale?
- What ingestion history must be audit-visible?

## Owner Approval
Approved by project owner. This decision guides future implementation plans but does not authorize or implement any code by itself.

## Implementation Status
- **Implementation status**: Not started
