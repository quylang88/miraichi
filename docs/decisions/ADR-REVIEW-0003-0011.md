# ADR Review: ADR-0003 Through ADR-0011

## Purpose
Review ADR-0003 through ADR-0011 before any draft is promoted to Proposed or Accepted status.

## Status
- **Status**: Draft
- **Review date**: 2026-06-23

## Scope
This review covers ADR-0003 through ADR-0011 only. It classifies review readiness and does not accept, reject, or implement any ADR.

## Summary
ADR-0003 through ADR-0011 are all currently marked Draft, explicitly require owner approval before Accepted, and state that implementation has not started. None of the reviewed ADRs hard-code single-competition logic, introduce business logic, define prediction algorithms, create betting calculations, create production database schemas, add secrets, or start implementation.

Post-fix update: ADR-0006 was narrowed to local AI prediction availability and traceable output expectations, with invocation timing deferred. ADR-0007 was narrowed to LLM role and refusal behavior, with chat persistence/privacy deferred. ADR-0003 through ADR-0011 are now review-ready for owner consideration as Proposed, but none have been promoted or accepted by this review.

No ADR was marked Accepted by this review. No implementation should start from this review.

## ADR Review Table

| ADR | Topic | Current status | Recommended status | Review result | Required fixes | Owner approval required |
| --- | --- | --- | --- | --- | --- | --- |
| ADR-0003 | Product boundary for first planning target | Draft | Proposed | Title, context, scope, options, trade-offs, consequences, risks, and open questions are clear. Avoids implementation and preserves competition-agnostic design. | None before Proposed. Before Accepted, owner must confirm first milestone workflow and read-only betting boundary. | Yes |
| ADR-0004 | App and service boundary model | Draft | Proposed | Clear source-boundary decision. Options are fair and consequences are realistic. Avoids runtime and deployment lock-in. | None before Proposed. Before Accepted, owner must confirm source-only versus runtime boundary expectations for Phase 2. | Yes |
| ADR-0005 | API mediation boundary | Draft | Proposed | Clear mediation decision with realistic risks. Avoids protocol, route, and schema details. Preserves controlled access between web, LLM, local AI, worker, and storage boundaries. | None before Proposed. Before Accepted, owner must confirm whether any early read-only paths may bypass API. | Yes |
| ADR-0006 | Local AI prediction availability and traceable output contract | Draft | Proposed | Revised to focus on traceability and prediction availability. Invocation timing, runtime, algorithms, and exact trace schemas remain deferred. | None before Proposed. Before Accepted, owner must confirm availability wording and trace-evidence categories. | Yes |
| ADR-0007 | LLM role and refusal behavior boundary | Draft | Proposed | Revised to focus on LLM role and refusal behavior. Chat persistence, retention, and privacy are explicitly deferred to a future storage/privacy ADR. | None before Proposed. Before Accepted, owner must confirm refusal expectations and evidence requirements. | Yes |
| ADR-0008 | Worker-based data ingestion boundary | Draft | Proposed | Clear worker ownership decision. Options are fair, risks are documented, and queue/scheduler/provider/schema choices remain deferred. | None before Proposed. Before Accepted, owner must confirm whether manual curated data is allowed before worker ingestion exists. | Yes |
| ADR-0009 | Competition configuration and registry boundary | Draft | Proposed | Clear competition-agnostic architecture decision. Options are fair and risks are realistic. Keeps core concepts generic and defers final storage/validation shape. | None before Proposed. Before Accepted, owner must confirm where competition metadata may live during early phases. | Yes |
| ADR-0010 | Testing and competition-agnostic verification strategy | Draft | Proposed | Clear verification strategy. Options are fair, consequences are realistic, and it avoids implementing tests while planning future checks. | None before Proposed. Before Accepted, owner must confirm whether automated checks are required before Phase 2 or deferred. | Yes |
| ADR-0011 | Agent workflow and handoff governance | Draft | Proposed | Clear governance decision. Options are fair and risks are documented. Preserves owner approval and avoids implementation governance creep. | None before Proposed. Before Accepted, owner must confirm who can promote candidates and what evidence is required. | Yes |

## ADRs Ready for Proposed
- **ADR-0003**: Product boundary for first planning target.
- **ADR-0004**: App and service boundary model.
- **ADR-0005**: API mediation boundary.
- **ADR-0006**: Local AI prediction availability and traceable output contract.
- **ADR-0007**: LLM role and refusal behavior boundary.
- **ADR-0008**: Worker-based data ingestion boundary.
- **ADR-0009**: Competition configuration and registry boundary.
- **ADR-0010**: Testing and competition-agnostic verification strategy.
- **ADR-0011**: Agent workflow and handoff governance.

## ADRs Needing Revision
- None after the post-fix update.

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
- Move ADR-0003 through ADR-0011 to Proposed only if the project owner approves Proposed status.
- Track local AI invocation timing as a future ADR if operational planning requires it.
- Track chat persistence, retention, and privacy as a future storage/privacy ADR.
- Keep all ADRs out of Accepted status until explicit owner approval is given.
- Keep implementation blocked until an Accepted ADR or explicit owner instruction authorizes implementation planning.
- Continue competition-agnostic review before any status promotion.

## Explicit Non-Acceptance Confirmation
No ADR was marked Accepted by this review. Accepted status requires explicit owner approval after review.

## Explicit No-Implementation Confirmation
No implementation was started by this review. This review does not authorize business logic, frontend/backend/AI production code, prediction algorithms, betting calculation logic, production database schemas, secrets, or competition-specific core behavior.
