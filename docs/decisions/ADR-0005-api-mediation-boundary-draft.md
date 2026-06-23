# ADR-0005: API Mediation Boundary

## Status
- **Status**: Draft
- **Source candidate**: Candidate 003
- **Date**: 2026-06-23

## Context
Miraichi needs a controlled boundary between user-facing clients, LLM chat, local AI outputs, workers, and future storage. The API may become that mediation layer, but protocol and implementation details remain undecided.

## Decision to Be Made
Decide which requests must pass through `apps/api` and which direct access patterns should be prohibited between web, LLM, local AI, worker, and storage boundaries.

## Options Considered
- Use an API-first boundary for all client and chat access.
- Allow direct local clients for early prototypes and add the API boundary later.
- Use a hybrid model where API handles user data while some read-only data is accessed directly.

## Draft Recommendation
Use the API as the controlled boundary for user-facing access while deferring exact protocol, route, and contract details.

## Consequences
- Gives web and chat surfaces a consistent access boundary.
- Creates a future home for authorization, prediction availability checks, and audit metadata.
- May require extra planning before prototypes can bypass direct local access.

## Risks
- API-first planning can over-design contracts before data needs stabilize.
- Direct access can bypass authorization, auditability, and prediction availability rules.
- Hybrid access can become confusing without strict boundary rules.

## Open Questions
- Which operations are synchronous API calls versus background tasks?
- Should prediction status be exposed separately from prediction results?
- What audit metadata should API-mediated actions preserve?

## Owner Approval Required
Project owner approval is required before this ADR can become Accepted or authorize implementation planning.

## Implementation Status
- **Implementation status**: Not started
