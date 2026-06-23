# ADR Review: ADR-0003 Through ADR-0011

## Purpose
Review ADR-0003 through ADR-0011 before any draft is promoted to Proposed or Accepted status.

## Status
- **Status**: Completed
- **Review date**: 2026-06-23
- **Owner Approval Date**: 2026-06-23
- **Owner Decision**: Approved ADR-0002, 0004-0011 as Accepted. Retained ADR-0003 as Proposed.

## Scope
This review covers ADR-0003 through ADR-0011. It records the final decisions made by the project owner and does not implement any business logic or code.

## Summary
On 2026-06-23, the project owner approved the promotion of the Phase 1 ADRs. Based on this approval:
- **ADR-0002, ADR-0004, ADR-0005, ADR-0006, ADR-0007, ADR-0008, ADR-0009, ADR-0010, ADR-0011** are promoted to **Accepted** status.
- **ADR-0003** is promoted to **Proposed** status (kept as Proposed pending owner confirmation of first milestone product scope).

None of the approved ADRs hard-code single-competition logic, introduce business logic, define prediction algorithms, create betting calculations, create production database schemas, add secrets, or start implementation.

## ADR Review Table

| ADR | Topic | Previous status | Final Decision | Review result / Constraints | Required fixes | Owner approval |
| --- | --- | --- | --- | --- | --- | --- |
| ADR-0003 | Product boundary for first planning target | Draft | Proposed | Title, context, scope, options, and trade-offs are clear. Kept as Proposed pending owner confirmation of first milestone product scope. | None. | Yes |
| ADR-0004 | App and service boundary model | Draft | Accepted | Clear source-boundary decision. Defer final runtime/deployment. | None. | Yes (Approved) |
| ADR-0005 | API mediation boundary | Draft | Accepted | API acts as the controlled mediation boundary. Defer exact route contracts. | None. | Yes (Approved) |
| ADR-0006 | Local AI prediction availability and traceable output contract | Draft | Accepted | Focuses on traceability and prediction availability. Defer invocation timing/runtime. | None. | Yes (Approved) |
| ADR-0007 | LLM role and refusal behavior boundary | Draft | Accepted | LLM acts as orchestration/explanation layer. Refusal behavior defined. Defer chat persistence/privacy. | None. | Yes (Approved) |
| ADR-0008 | Worker-based data ingestion boundary | Draft | Accepted | Worker owns ingestion/normalization. Defer queue/scheduler/provider choices. | None. | Yes (Approved) |
| ADR-0009 | Competition configuration and registry boundary | Draft | Accepted | Keep core concepts generic. Defer final storage/validation shape. | None. | Yes (Approved) |
| ADR-0010 | Testing and competition-agnostic verification strategy | Draft | Accepted | Testing strategy defined. Defer implementation of test suites. | None. | Yes (Approved) |
| ADR-0011 | Agent workflow and handoff governance | Draft | Accepted | Governance and handoff flow defined. Defer implementation governance details. | None. | Yes (Approved) |

## ADRs Promoted to Accepted
- **ADR-0002**: Architecture planning approach.
- **ADR-0004**: App and service boundary model.
- **ADR-0005**: API mediation boundary.
- **ADR-0006**: Local AI prediction availability and traceable output contract.
- **ADR-0007**: LLM role and refusal behavior boundary.
- **ADR-0008**: Worker-based data ingestion boundary.
- **ADR-0009**: Competition configuration and registry boundary.
- **ADR-0010**: Testing and competition-agnostic verification strategy.
- **ADR-0011**: Agent workflow and handoff governance.

## ADRs Promoted to Proposed
- **ADR-0003**: Product boundary for first planning target (kept as Proposed pending owner confirmation).

## ADRs Recommended for Deferred
- None among ADR-0003 through ADR-0011. Storage and deployment decisions remain deferred outside this reviewed range because their candidates were not converted to Draft ADRs.

## ADRs Recommended for Rejected
- None.

## Cross-ADR Conflicts or Overlaps
- **ADR-0005 and ADR-0007** overlap on LLM access to application data. ADR-0005 should own API mediation; ADR-0007 should own LLM role and refusal behavior.
- **ADR-0005 and ADR-0008** overlap on worker/API boundaries. ADR-0005 should own client-facing mediation; ADR-0008 should own background provider ingestion.
- **ADR-0006 and ADR-0007** overlap on prediction availability. Post-fix ownership is clearer: ADR-0006 defines local AI availability and traceability expectations; ADR-0007 defines how the LLM behaves when that output is unavailable.
- **ADR-0009 and ADR-0010** overlap on competition-agnostic review. ADR-0009 should define where competition metadata belongs; ADR-0010 should define how violations are reviewed or checked.
- **ADR-0011 and all other ADRs** overlap on governance. ADR-0011 should govern promotion, ownership, and handoff process, not the substance of each architecture decision.

## Missing ADRs, If Any
- **Storage responsibility and persistence strategy**: Candidate 007 needs research before Draft.
- **Deployment and environment strategy**: Candidate 010 needs research before Draft.
- **Bet history and audit boundary**: Candidate 009 should be split before Draft.
- **Bankroll, risk rule, and responsible-use boundary**: Candidate 009 should be split before Draft.
- **Security, privacy, secrets, retention, and audit boundaries**: Candidate 011 should be split into smaller ADRs before Draft.
- **Chat persistence and privacy**: ADR-0007 now explicitly defers this decision to a future storage/privacy ADR.

## Recommended Next Actions
- Proceed to Phase 1 Completion Review and plan the Phase 2 app skeleton packages.
- Track local AI invocation timing as a future ADR if operational planning requires it.
- Track chat persistence, retention, and privacy as a future storage/privacy ADR.
- Keep implementation blocked until an Accepted ADR or explicit owner instruction authorizes implementation planning.
- Continue competition-agnostic review checks during Phase 2 planning.

## Explicit Non-Acceptance Confirmation
Only the project owner-approved ADRs (ADR-0002, 0004-0011) have been marked as Accepted. ADR-0003 remains in Proposed status pending confirmation of the first milestone product scope.

## Explicit No-Implementation Confirmation
No implementation was started by this review. This review does not authorize business logic, frontend/backend/AI production code, prediction algorithms, betting calculation logic, production database schemas, secrets, or competition-specific core behavior.
