# ADR-0004: App and Service Boundary Model

## Status
- **Status**: Accepted
- **Accepted Date**: 2026-06-23
- **Owner Approval**: Approved by project owner
- **Source candidate**: Candidate 002
- **Date**: 2026-06-23

## Context
Miraichi is organized around app boundaries for web, API, local AI, and worker responsibilities. The repository needs a clear source-level boundary model before implementation begins, while deployment topology can remain undecided.

## Decision to Be Made
Decide whether Miraichi should preserve separate source-level app boundaries for `apps/web`, `apps/api`, `apps/local-ai`, and `apps/worker` from the first implementation.

## Options Considered
- Keep `apps/web`, `apps/api`, `apps/local-ai`, and `apps/worker` as separate app boundaries.
- Start with fewer runtime processes but keep source boundaries documented.
- Collapse early implementation into one application and split later.

## Draft Recommendation
Preserve source-level boundaries for web, API, local AI, and worker responsibilities while deferring final runtime and deployment topology decisions.

## Consequences
- Clarifies ownership before production code exists.
- Lets teams and agents plan against stable boundaries.
- Avoids forcing separate deployable services before operational requirements are known.

## Risks
- Source-level boundaries may drift without dependency rules.
- Separate boundaries can add integration overhead when implementation starts.
- Deferring deployability can leave some operational assumptions unresolved.

## Open Questions
- Which boundaries require independent runtime isolation?
- Which boundaries can be source-only during Phase 2?
- What dependency rules should prevent direct cross-boundary calls?

## Owner Approval
Approved by project owner. This decision guides future implementation plans but does not authorize or implement any code by itself.

## Implementation Status
- **Implementation status**: Not started
