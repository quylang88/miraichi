# ADR-0003: Product Boundary for the First Miraichi Planning Target

## Status
- **Status**: Proposed
- **Note**: Pending owner confirmation of first milestone product scope.
- **Source candidate**: Candidate 001
- **Date**: 2026-06-23

## Context
Miraichi needs a first planning target that is useful without expanding into full betting management too early. Candidate workflows include prediction browsing, chat explanation, bet history, bankroll review, and responsible-use guidance.

Phase 1 must keep the product boundary high-level and avoid business logic, betting calculations, production schemas, and final implementation decisions.

## Decision to Be Made
Decide which user workflows belong in the first Miraichi planning target and which workflows remain deferred until later ADRs.

## Options Considered
- Start with prediction review and explanation only.
- Include bet history and bankroll review as planning surfaces without calculations.
- Include the full prediction, chat, bet history, bankroll, and responsible-use workflow.

## Draft Recommendation
Start with a narrow read-only planning boundary focused on prediction review and explanation, then expand through later ADRs once responsible-use, bet history, bankroll, and risk-rule boundaries are clearer.

## Consequences
- Keeps Phase 1 and early Phase 2 scope easier to review.
- Reduces the chance of introducing betting behavior before guardrails are accepted.
- Defers some user workflows until the owner approves follow-up product decisions.

## Risks
- The first planning target may feel too narrow for users who expect full betting management.
- Deferred workflows may reveal new data or UI requirements later.
- Ambiguous scope could still destabilize API and app boundary decisions if not documented clearly.

## Open Questions
- Which user workflow is required for the first usable milestone?
- Which workflows must remain read-only until betting and bankroll decisions are accepted?
- What user outcome defines success for the first planning target?

## Owner Approval Required
Project owner approval is required before this ADR can become Accepted or authorize implementation planning.

## Implementation Status
- **Implementation status**: Not started
