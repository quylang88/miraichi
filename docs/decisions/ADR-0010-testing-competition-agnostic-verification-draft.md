# ADR-0010: Testing and Competition-Agnostic Verification Strategy

## Status
- **Status**: Accepted
- **Accepted Date**: 2026-06-23
- **Owner Approval**: Approved by project owner
- **Source candidate**: Candidate 012
- **Date**: 2026-06-23

## Context
Miraichi needs verification practices that prevent architecture, data, and betting concepts from becoming competition-specific or untraceable. Phase 1 can define verification expectations without implementing test suites yet.

## Decision to Be Made
Decide what verification strategy should govern competition-agnostic architecture, boundary contracts, traceability, and refusal behavior before implementation begins.

## Options Considered
- Use manual documentation review only during Phase 1.
- Add automated checks for competition-specific naming and final-decision language.
- Plan boundary contract tests for API, ingestion, source provenance, and owner persistence behavior.
- Use a combined manual and automated verification strategy.

## Draft Recommendation
Use manual review during Phase 1 and define future automated checks before implementation broadens. Separate documentation guardrails from later code-level tests.

## Consequences
- Supports Phase 1 guardrails without introducing production code.
- Creates a path for later automated checks and boundary tests.
- Requires careful handling of false positives from keyword-based checks.

## Risks
- Manual-only review may miss repeated coupling patterns.
- Automated keyword checks may produce false positives without context.
- Missing boundary tests can allow later implementation to drift from planning docs.

## Open Questions
- Which competition-specific patterns should be blocked automatically?
- Which boundary contracts need tests before Phase 2 or Phase 3?
- How should false positives be reviewed without weakening the guardrail?

## Owner Approval
Approved by project owner. This decision guides future implementation plans but does not authorize or implement any code by itself.

## Implementation Status
- **Implementation status**: Not started
