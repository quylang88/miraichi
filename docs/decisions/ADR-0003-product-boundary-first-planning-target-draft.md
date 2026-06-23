# ADR-0003: Product Boundary for the First Miraichi Planning Target

## Status
- **Status**: Accepted
- **Accepted Date**: 2026-06-23
- **Owner Approval**: Approved by project owner
- **Source candidate**: Candidate 001

## Context
Miraichi needs a first planning target that is useful without expanding into full betting management too early. Candidate workflows include prediction browsing, chat explanation, bet history, bankroll review, and responsible-use guidance.

Phase 1 must keep the product boundary high-level and avoid business logic, betting calculations, production schemas, and final implementation decisions.

## Decision to Be Made
Decide which user workflows belong in the first Miraichi planning target and which workflows remain deferred until later ADRs.

## Options Considered
- Start with prediction review and explanation only.
- Include bet history and bankroll review as planning surfaces without calculations.
- Include the full prediction, chat, bet history, bankroll, and responsible-use workflow.

## Decision & Recommendation
Phase 2 will scaffold prediction review, LLM explanation, and read-only bet history placeholders.

## Explicit Exclusions
The following workflows and features are strictly excluded from the Phase 2 target:
- No active bet placement (no bet slips or active submission mechanisms).
- No bankroll logic (no simulated account balances or currency math).
- No risk-limit logic (no wagering ceiling validations or budget enforcement).
- No betting calculations (no payout projections or odds multipliers).
- No production database schema (no relational or document schema definition for betting records).
- No real bet persistence (all bet logs are read-only and ephemeral in-memory placeholders).

## Consequences
- Keeps Phase 1 and early Phase 2 scope easier to review.
- Reduces the chance of introducing betting behavior before guardrails are accepted.
- Defers some user workflows until the owner approves follow-up product decisions.

## Risks
- The first planning target may feel too narrow for users who expect full betting management.
- Deferred workflows may reveal new data or UI requirements later.
- Ambiguous scope could still destabilize API and app boundary decisions if not documented clearly.

## Open Questions
- Which user outcome defines success for the first planning target?
- When should the bankroll and risk-limit rules be promoted to ADR candidates?

## Implementation Status
- **Implementation status**: Not started
- **Note**: This ADR guides Phase 2 scaffolding only and does not authorize business logic implementation.
