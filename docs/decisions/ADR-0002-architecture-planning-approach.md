# ADR-0002: Architecture Planning Approach

## Purpose
Record the decision to treat Phase 1 as architecture discovery rather than final architecture locking.

## Status
- **Status**: Accepted
- **Accepted Date**: 2026-06-23
- **Owner Approval**: Approved by project owner
- **Date**: 2026-06-23
- **Author**: Codex

## Scope
This ADR covers the planning approach for Phase 1. It does not choose a final architecture, framework, database, queue, deployment model, model runtime, prediction algorithm, betting calculation, or production schema.

## Context
Miraichi is an AI football prediction and betting management app. The project may validate early workflows with a World Cup use case, but the architecture must support many competitions, seasons, teams, matches, players, markets, predictions, bets, bankroll settings, and risk rules over time.

Phase 0 established repository structure and draft documentation. Phase 1 now needs a planning package that helps the owner compare architecture options and open questions before implementation begins.

## Decision
Phase 1 will be treated as an architecture discovery phase. The project will produce draft planning documents, open questions, candidate options, system-boundary drafts, data-flow drafts, and competition-agnostic review notes.

Phase 1 will not finalize production schemas, API contracts, infrastructure choices, framework choices, model runtime choices, prediction algorithms, betting calculations, or competition-specific behavior.

## Consequences
- Later implementation phases should rely on Phase 1 docs as planning context, not as final architecture approval.
- Final decisions should be recorded in later ADRs when enough information is available.
- Root planning docs should avoid language that implies final schema, runtime, or stack choices.
- Agents must keep documentation high-level and competition-agnostic during this phase.

## Alternatives Considered
- **Lock the final architecture in Phase 1**: Rejected for now because the product, data, local AI, storage, deployment, and responsible-use boundaries still need owner review.
- **Proceed directly to app skeletons**: Rejected for now because core boundaries and open questions need to be visible before code appears.
- **Plan only one initial competition**: Rejected because Miraichi must remain competition-agnostic and support multiple competitions later.

## Open Questions
- Which architecture options should become accepted ADRs before app skeleton work begins?
- What minimum data and prediction traceability requirements must exist before local AI implementation?
- Which storage and deployment choices can remain deferred without blocking Phase 2?
- What competition-agnostic review checks should be automated later?

## Owner Approval
Approved by project owner. This decision guides future implementation plans but does not authorize or implement any code by itself.

## Implementation Status
- **Implementation status**: Not started
