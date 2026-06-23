# ADR-0011: Agent Workflow and Handoff Governance

## Status
- **Status**: Accepted
- **Accepted Date**: 2026-06-23
- **Owner Approval**: Approved by project owner
- **Source candidate**: Candidate 013
- **Date**: 2026-06-23

## Context
Miraichi uses specialist agent roles and agent-protocol documentation to coordinate planning, implementation, review, and handoff work. Architecture questions need a governance path from open question to ADR candidate, Draft ADR, owner approval, and later implementation planning.

## Decision to Be Made
Decide how open architecture questions move into ADRs, specialist handoffs, tickets, and implementation plans.

## Options Considered
- Let the project owner manually promote open questions to ADRs.
- Let the Planner Agent maintain a decision backlog with specialist handoffs.
- Let each specialist agent own ADR candidates for its domain.
- Use hybrid governance with Planner Agent coordination and specialist review.

## Draft Recommendation
Use Planner Agent coordination with specialist-owner review before any ADR is accepted. Keep owner approval as the required gate for acceptance.

## Consequences
- Gives Phase 1 decisions a clear promotion path.
- Helps prevent specialist agents from silently expanding scope.
- Requires consistent updates across agent, workflow, and decision documents.

## Risks
- Unowned candidates can stall Phase 2.
- Specialist agents may expand scope without handoff controls.
- Accepted decisions may not reach roadmap, workflow, or architecture docs if governance is informal.

## Open Questions
- Who can promote an open question to an ADR candidate?
- What evidence is required before an ADR candidate can become Draft or Accepted?
- How should accepted decisions be propagated to root docs and specialist docs?

## Owner Approval
Approved by project owner. This decision guides future implementation plans but does not authorize or implement any code by itself.

## Implementation Status
- **Implementation status**: Not started
