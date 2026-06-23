# Phase 1 ADR Candidate Review

## Purpose
Review and classify the Phase 1 ADR candidates before any candidate becomes a Draft or Accepted ADR.

## Status
- **Status**: Draft
- **Review date**: 2026-06-23

## Scope
This review covers [ADR-CANDIDATES-PHASE-1.md](file:///c:/CODE/miraichi/docs/decisions/ADR-CANDIDATES-PHASE-1.md) only. It classifies candidate readiness and does not accept, reject, implement, or convert any ADR.

## Summary
The Phase 1 ADR candidate set is useful and mostly well scoped. Most candidates preserve the discovery intent of Phase 1, avoid premature implementation, and keep Miraichi competition-agnostic. The strongest ready candidates are boundary and governance decisions that can be drafted without choosing a final framework, database, queue, model runtime, prediction algorithm, betting formula, or production schema.

Several candidates should remain research topics or be split before becoming ADR drafts. Storage and deployment need more input because they depend on privacy, local AI runtime, data-provider access, and audit requirements. Betting/bankroll/responsible-use and security/privacy/audit each combine multiple decisions and should be split into smaller ADRs.

No ADR is accepted by this review. No implementation should start from this review.

## Candidate Classification Table

| Candidate | Problem clear | Scope fit | Options, trade-offs, risks | Open questions | Guardrail review | Classification |
| --- | --- | --- | --- | --- | --- | --- |
| 001 | Yes | Yes, if limited to the first planning target | Fair options, clear trade-offs, and risks documented | Yes | Avoids implementation, preserves competition-agnostic design, and requires owner approval | READY_FOR_DRAFT |
| 002 | Yes | Yes, if deployment topology remains deferred | Fair options, clear trade-offs, and risks documented | Yes | Avoids runtime lock-in, preserves competition-agnostic boundaries, and requires owner approval | READY_FOR_DRAFT |
| 003 | Yes | Yes, if protocol details remain deferred | Fair options, clear trade-offs, and risks documented | Yes | Avoids implementation, protects mediation boundaries, and requires owner approval | READY_FOR_DRAFT |
| 004 | Yes | Yes, if algorithms and final schemas remain out of scope | Fair options, clear trade-offs, and risks documented | Yes | Avoids model/runtime lock-in, keeps predictions traceable, and requires owner approval | READY_FOR_DRAFT |
| 005 | Yes | Mostly; chat persistence may need a later split | Fair options, clear trade-offs, and risks documented | Yes | Avoids invented predictions, preserves local AI authority, and requires owner approval | READY_FOR_DRAFT |
| 006 | Yes | Yes, if queue and scheduler choices remain deferred | Fair options, clear trade-offs, and risks documented | Yes | Avoids provider-specific schema lock-in, preserves generic data flow, and requires owner approval | READY_FOR_DRAFT |
| 007 | Yes | Not yet; depends on unresolved data and audit needs | Options are fair, but trade-offs need more evidence | Yes | Avoids premature database choice and requires owner approval | NEEDS_MORE_RESEARCH |
| 008 | Yes | Yes | Fair options, clear trade-offs, and risks documented | Yes | Strongly preserves competition-agnostic design and requires owner approval | READY_FOR_DRAFT |
| 009 | Yes | No; combines several betting and responsible-use decisions | Options are fair, but trade-offs span multiple ADR-sized problems | Yes | Avoids calculations, but needs split before owner approval | TOO_BROAD_SPLIT |
| 010 | Yes | Not yet; depends on runtime, hosting, privacy, and provider constraints | Options are fair, but trade-offs need more research | Yes | Avoids deployment lock-in and requires owner approval | NEEDS_MORE_RESEARCH |
| 011 | Yes | No; combines security, privacy, audit, retention, secrets, and chat data | Options are fair, but trade-offs span multiple control areas | Yes | Avoids implementation, but needs split before owner approval | TOO_BROAD_SPLIT |
| 012 | Yes | Yes | Fair options, clear trade-offs, and risks documented | Yes | Avoids implementation, supports competition-agnostic review, and requires owner approval | READY_FOR_DRAFT |
| 013 | Yes | Yes, if limited to ADR promotion and handoff governance | Fair options, clear trade-offs, and risks documented | Yes | Avoids implementation governance creep and requires owner approval | READY_FOR_DRAFT |

## READY_FOR_DRAFT List

- **Candidate 001: Product Boundary for the First Planning Target**: Ready because the problem is clear, the scope is limited to first planning target boundaries, and it requires owner approval before acceptance.
- **Candidate 002: App and Service Boundary Model**: Ready because it can decide source-level versus runtime boundary strategy without choosing deployment technology.
- **Candidate 003: API Mediation and Client Access Boundary**: Ready because it frames access control and mediation without forcing protocol details.
- **Candidate 004: Local AI Invocation and Prediction Output Contract**: Ready because traceability and availability can be drafted before model or algorithm choices.
- **Candidate 005: LLM Role, Refusal Behavior, and Chat Persistence**: Ready if the draft focuses on LLM role and refusal behavior, with chat persistence left as an unresolved sub-question.
- **Candidate 006: Worker-Based Data Ingestion Boundary**: Ready because worker ownership can be decided without queue, scheduler, provider, or schema lock-in.
- **Candidate 008: Competition Configuration and Registry Boundary**: Ready because it directly preserves competition-agnostic design and does not require final storage or schema decisions.
- **Candidate 012: Testing and Competition-Agnostic Verification Strategy**: Ready because it establishes review strategy without implementing tests yet.
- **Candidate 013: Agent Workflow and Handoff Governance**: Ready because it defines decision governance and owner review before acceptance.

## NEEDS_MORE_RESEARCH List

- **Candidate 007: Storage Responsibility and Persistence Strategy**: Research required on sensitive data categories, immutability, retention, audit trails, prediction output storage, chat handling, and what can remain swappable for Phase 2.
- **Candidate 010: Deployment and Environment Strategy**: Research required on local versus hosted local AI, provider credential handling, privacy constraints, required environments, and operational expectations.

## TOO_BROAD_SPLIT List

- **Candidate 009: Betting History, Bankroll, Risk Rule, and Responsible-Use Boundary**: Split into at least two ADRs: one for bet history/audit scope and one for bankroll/risk/responsible-use boundaries. Betting calculations must remain out of scope until explicitly approved.
- **Candidate 011: Security, Privacy, and Audit Boundary**: Split into smaller ADRs such as sensitive data classification, secrets handling, retention/privacy, audit trail requirements, and chat privacy.

## DUPLICATE_MERGE List

- None recommended. Some candidates overlap intentionally, but each currently frames a distinct decision area.

## REJECT_RECOMMENDED List

- None recommended. No candidate is clearly invalid, implementation-heavy, or incompatible with competition-agnostic planning.

## Recommended Next Actions

- Promote READY_FOR_DRAFT candidates into separate Draft ADRs only with project owner approval.
- Keep NEEDS_MORE_RESEARCH candidates as research tasks until their unresolved dependencies are clearer.
- Split TOO_BROAD_SPLIT candidates before drafting so each ADR accepts only one decision.
- Keep DUPLICATE_MERGE and REJECT_RECOMMENDED empty unless future review finds overlap or invalid scope.
- Maintain explicit candidate, draft, and accepted states in every decision document.
- Continue competition-agnostic review before any ADR moves from Candidate to Draft or from Draft to Accepted.

## Explicit Non-Acceptance Note

No ADR is accepted yet. All reviewed items remain candidates unless the project owner explicitly approves promotion to Draft or Accepted status in a later step.

## Explicit No-Implementation Note

No implementation should start yet from these ADR candidates. This review does not authorize business logic, frontend/backend/AI production code, prediction algorithms, betting calculation logic, production database schemas, secrets, or competition-specific core behavior.
