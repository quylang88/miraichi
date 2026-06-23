# ADR-0006: Local AI Prediction Availability and Traceable Output Contract

## Status
- **Status**: Accepted
- **Accepted Date**: 2026-06-23
- **Owner Approval**: Approved by project owner
- **Source candidate**: Candidate 004
- **Date**: 2026-06-23

## Context
Miraichi needs local AI outputs to be traceable before user-facing systems explain or display them. This ADR draft focuses on prediction availability and traceability expectations only.

Invocation timing is intentionally out of scope. Whether local AI later runs on demand, on a schedule, in batches, or through a hybrid model should be decided in a separate ADR after data freshness and operational needs are clearer.

## Decision to Be Made
Decide the minimum availability, output evidence, traceability, and unavailable-state expectations for local AI prediction candidates before implementation begins.

## Options Considered
- Define prediction availability and traceability expectations now while deferring invocation timing.
- Defer all local AI output expectations until model runtime and invocation timing are chosen.
- Define detailed trace fields now before enough data and review requirements are known.

## Draft Recommendation
Define minimum prediction availability and traceability expectations now, while deferring invocation timing, model runtime, algorithms, feature engineering, and exact trace-field schemas to later ADRs.

## Consequences
- Helps prevent the API or LLM layer from implying predictions that do not exist.
- Gives later local AI work a reviewable output boundary.
- Keeps invocation timing, runtime, algorithm, and schema decisions open.
- Creates a future dependency for LLM explanation, API mediation, and testing decisions.

## Risks
- Traceability requirements may be too vague without example data.
- Over-specifying output expectations can become a hidden schema decision.
- Deferring invocation mode may leave operational planning incomplete until a later ADR.
- If unavailable-state wording is unclear, user-facing layers may still overstate prediction availability.

## Open Questions
- What input bundle is required before local AI may emit a prediction candidate?
- What categories of trace evidence must accompany every prediction candidate without becoming a final schema?
- What distinguishes unavailable output from low-confidence output?
- Which later ADR should decide on-demand, scheduled, batch, or hybrid invocation timing?

## Owner Approval
Approved by project owner. This decision guides future implementation plans but does not authorize or implement any code by itself.

## Implementation Status
- **Implementation status**: Not started
