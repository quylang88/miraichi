# Phase 1 ADR Candidates

## Purpose
Extract candidate architecture decision records from the reviewed Phase 1 Architecture Planning package so the project owner can choose which decisions to formalize later.

## Status
- **Status**: Closed
- **Phase**: Phase 1 - Architecture Planning
- **Date**: 2026-06-23

## Scope
This document lists candidate ADRs only. It does not accept, reject, or implement any architecture decision. It does not define final frameworks, databases, queues, deployment targets, production schemas, prediction algorithms, betting calculations, or competition-specific core logic.

## Source Documents
- [phase-1-architecture-planning.md](file:///c:/CODE/miraichi/docs/architecture/phase-1-architecture-planning.md)
- [open-architecture-questions.md](file:///c:/CODE/miraichi/docs/architecture/open-architecture-questions.md)
- [architecture-options.md](file:///c:/CODE/miraichi/docs/architecture/architecture-options.md)
- [system-boundaries-draft.md](file:///c:/CODE/miraichi/docs/architecture/system-boundaries-draft.md)
- [data-flow-draft.md](file:///c:/CODE/miraichi/docs/architecture/data-flow-draft.md)
- [llm-local-ai-boundary.md](file:///c:/CODE/miraichi/docs/architecture/llm-local-ai-boundary.md)
- [competition-agnostic-review.md](file:///c:/CODE/miraichi/docs/architecture/competition-agnostic-review.md)
- [ADR-0002-architecture-planning-approach.md](file:///c:/CODE/miraichi/docs/decisions/ADR-0002-architecture-planning-approach.md)

## Candidate 001: Product Boundary for the First Planning Target

- **Proposed ADR title**: Product Boundary for the First Miraichi Planning Target
- **Problem/question**: Which workflows should be included first: prediction browsing, chat explanation, bet history, bankroll review, responsible-use guidance, or some smaller read-only subset?
- **Options considered**:
  - Start with prediction review and explanation only.
  - Include bet history and bankroll review as planning surfaces without calculations.
  - Include the full prediction, chat, bet history, bankroll, and responsible-use workflow.
- **Recommendation, if any**: Draft recommendation to start with a narrow read-only planning boundary, then expand through later ADRs.
- **Risks**:
  - Starting too broad may imply betting calculations before responsible-use boundaries are ready.
  - Starting too narrow may miss important data and UX requirements.
  - Ambiguous product scope can make app and API boundaries unstable.
- **Decision owner**: Project owner with Planner Agent and Product Research Agent input.
- **Status**: Candidate
- **Files that would be affected later**:
  - `docs/product/mvp-scope.md`
  - `docs/product/feature-map.md`
  - `docs/architecture/phase-1-architecture-planning.md`
  - `PROJECT_PLAN.md`
  - `ROADMAP.md`
- **Questions that must be answered before accepting**:
  - Which user workflow is required for the first usable milestone?
  - Which workflows must remain read-only until betting and bankroll decisions are accepted?
  - What user outcome defines success for the first planning target?

## Candidate 002: App and Service Boundary Model

- **Proposed ADR title**: App and Service Boundary Model for Web, API, Local AI, and Worker
- **Problem/question**: Should Miraichi preserve separate deployable app boundaries from the first implementation, or begin with fewer runtime units while maintaining clear internal boundaries?
- **Options considered**:
  - Keep `apps/web`, `apps/api`, `apps/local-ai`, and `apps/worker` as separate app boundaries.
  - Start with fewer runtime processes but keep source boundaries documented.
  - Collapse early implementation into one application and split later.
- **Recommendation, if any**: Draft recommendation to preserve source-level app boundaries while deferring final deployability decisions.
- **Risks**:
  - Separate boundaries may add integration overhead early.
  - Collapsed boundaries may make later extraction harder.
  - Weak ownership rules may blur responsibilities across apps.
- **Decision owner**: Architect Agent with Backend Agent, AI/Data Agent, Frontend Agent, and DevOps Agent input.
- **Status**: Candidate
- **Files that would be affected later**:
  - `docs/architecture/system-boundaries-draft.md`
  - `docs/architecture/app-boundaries.md`
  - `ARCHITECTURE.md`
  - `apps/web/README.md`
  - `apps/api/README.md`
  - `apps/local-ai/README.md`
  - `apps/worker/README.md`
- **Questions that must be answered before accepting**:
  - Which boundaries require independent runtime isolation?
  - Which boundaries can be source-only during Phase 2?
  - What dependency rules should prevent direct cross-boundary calls?

## Candidate 003: API Mediation and Client Access Boundary

- **Proposed ADR title**: API Mediation Boundary for Clients, Local AI, Workers, and Storage
- **Problem/question**: Which requests must pass through `apps/api`, and what should be prohibited from direct web, LLM, local AI, or worker access?
- **Options considered**:
  - API-first boundary for all client and chat access.
  - Direct local clients for early prototypes with API boundary added later.
  - Hybrid model where API handles user data while some read-only data is accessed directly.
- **Recommendation, if any**: Draft recommendation to use the API as the controlled boundary for user-facing access while deferring exact protocol format.
- **Risks**:
  - API-first work can over-design contracts before data needs are stable.
  - Direct access can bypass authorization, auditability, and prediction availability rules.
  - A hybrid model can be confusing without strict rules.
- **Decision owner**: Architect Agent with Backend Agent and Security/QA input.
- **Status**: Candidate
- **Files that would be affected later**:
  - `apps/api/docs/api-architecture.md`
  - `apps/api/docs/route-map.md`
  - `docs/architecture/system-boundaries-draft.md`
  - `docs/architecture/data-flow-draft.md`
  - `docs/llm/prompt-routing-plan.md`
- **Questions that must be answered before accepting**:
  - Which operations are synchronous API calls versus background tasks?
  - Should prediction status be exposed separately from prediction results?
  - What audit metadata should API-mediated actions preserve?

## Candidate 004: Local AI Invocation and Prediction Output Contract

- **Proposed ADR title**: Local AI Invocation and Traceable Prediction Output Contract
- **Problem/question**: What minimum inputs, outputs, traceability fields, and unavailable states should local AI define before implementation?
- **Options considered**:
  - On-demand local AI invocation.
  - Scheduled or batch prediction generation.
  - Hybrid on-demand and scheduled generation.
  - Defer invocation mode but define availability and traceability expectations first.
- **Recommendation, if any**: Draft recommendation to define minimum availability and traceability rules before choosing runtime or invocation mode.
- **Risks**:
  - Choosing runtime or model shape too early may constrain experimentation.
  - Vague outputs may let the LLM or API imply predictions that do not exist.
  - Missing traceability may block review and user trust later.
- **Decision owner**: AI/Data Agent with Architect Agent and QA Agent input.
- **Status**: Candidate
- **Files that would be affected later**:
  - `docs/architecture/llm-local-ai-boundary.md`
  - `apps/local-ai/docs/ai-architecture.md`
  - `apps/local-ai/docs/data-contracts.md`
  - `apps/local-ai/docs/model-boundaries.md`
  - `packages/shared/docs/shared-types.md`
- **Questions that must be answered before accepting**:
  - What input bundle is required before local AI may emit a prediction candidate?
  - What trace fields must accompany every prediction candidate?
  - What distinguishes unavailable output from low-confidence output?

## Candidate 005: LLM Role, Refusal Behavior, and Chat Persistence

- **Proposed ADR title**: LLM Role, Refusal Behavior, and Chat Persistence Boundary
- **Problem/question**: How should the LLM route, explain, refuse, and optionally persist chat interactions without becoming the prediction source?
- **Options considered**:
  - LLM as orchestration and explanation layer only.
  - LLM as a broader assistant that can provide unsupported guidance.
  - LLM disabled until local AI output exists.
  - Persist chat sessions, summarize them, or treat them as transient.
- **Recommendation, if any**: Draft recommendation to keep the LLM as orchestration and explanation only, with explicit refusal when local AI output is unavailable.
- **Risks**:
  - Users may expect answers when no structured prediction exists.
  - Persisting chat increases privacy and retention responsibilities.
  - Weak refusal wording may create implied betting or prediction advice.
- **Decision owner**: Architect Agent with AI/Data Agent, Product Research Agent, and QA Agent input.
- **Status**: Candidate
- **Files that would be affected later**:
  - `docs/architecture/llm-local-ai-boundary.md`
  - `docs/llm/llm-role.md`
  - `docs/llm/chat-boundaries.md`
  - `docs/llm/local-ai-handoff.md`
  - `docs/llm/safety-rules.md`
- **Questions that must be answered before accepting**:
  - What exact user-facing wording should appear when no prediction is available?
  - What evidence must the LLM cite before explaining a prediction?
  - Should chat content be persisted, summarized, or discarded?

## Candidate 006: Worker-Based Data Ingestion Boundary

- **Proposed ADR title**: Worker-Based Data Ingestion and Provider Normalization Boundary
- **Problem/question**: Should provider polling, normalization, freshness tracking, and data-quality checks live behind a worker boundary?
- **Options considered**:
  - Worker-based ingestion for provider polling and normalization.
  - API-admin ingestion for early manual imports.
  - Manual curated data only until provider relationships are clearer.
  - Hybrid manual import plus worker refresh later.
- **Recommendation, if any**: Draft recommendation to keep provider-specific work out of user-facing API paths and plan a worker boundary, while deferring queue and scheduler technology.
- **Risks**:
  - Worker planning may imply queue choices too early.
  - Manual-only data may hide ingestion failure modes.
  - Provider-specific fields may leak into shared concepts if normalization rules are weak.
- **Decision owner**: Backend Agent with DevOps Agent, AI/Data Agent, and Architect Agent input.
- **Status**: Candidate
- **Files that would be affected later**:
  - `docs/architecture/data-flow-draft.md`
  - `docs/data/data-ingestion-plan.md`
  - `docs/data/data-source-plan.md`
  - `apps/worker/docs/worker-architecture.md`
  - `apps/worker/docs/queue-plan.md`
- **Questions that must be answered before accepting**:
  - Which provider categories are needed first?
  - Which failures should block predictions versus mark data as stale?
  - What ingestion history must be audit-visible?

## Candidate 007: Storage Responsibility and Persistence Strategy

- **Proposed ADR title**: Storage Responsibility and Persistence Strategy
- **Problem/question**: Which storage responsibilities must be planned first, and which storage choices can remain swappable?
- **Options considered**:
  - Single application database for initial app state, ingestion data, and prediction outputs.
  - Separate stores by responsibility, such as operational state, analytics, logs, and chat history.
  - Local-first storage for early development with hosted storage deferred.
  - Documentation-only storage boundary until concrete requirements are accepted.
- **Recommendation, if any**: No final recommendation yet. Candidate decision should define responsibilities before selecting technology.
- **Risks**:
  - Choosing a database early may force premature schemas.
  - Deferring storage too long may block API, ingestion, and audit decisions.
  - Mixing chat, betting history, prediction outputs, and provider data may complicate privacy and retention.
- **Decision owner**: Architect Agent with Backend Agent, DevOps Agent, and QA Agent input.
- **Status**: Candidate
- **Files that would be affected later**:
  - `docs/architecture/data-flow-draft.md`
  - `docs/data/football-domain-model.md`
  - `docs/data/privacy-and-retention.md`
  - `apps/api/docs/api-architecture.md`
  - `packages/shared/docs/shared-types.md`
- **Questions that must be answered before accepting**:
  - Which records need immutability or audit history?
  - Which data categories have retention or deletion requirements?
  - Which storage choice, if any, must be accepted before Phase 2?

## Candidate 008: Competition Configuration and Registry Boundary

- **Proposed ADR title**: Competition Configuration and Registry Boundary
- **Problem/question**: How should competition-specific metadata be represented without hard-coding competition names, phases, or rules in core application logic?
- **Options considered**:
  - Configuration-driven competition metadata.
  - Provider-data-driven competition metadata.
  - Database-managed competition registry.
  - Hybrid config plus provider data, with core code using generic concepts only.
- **Recommendation, if any**: Draft recommendation to keep core concepts generic and place competition-specific metadata in configuration or provider data, not app logic.
- **Risks**:
  - Configuration can become an unreviewed place for business logic.
  - Provider data can leak inconsistent naming into shared concepts.
  - Early examples can become implicit defaults if review checks are weak.
- **Decision owner**: Architect Agent with AI/Data Agent, Backend Agent, and Product Research Agent input.
- **Status**: Candidate
- **Files that would be affected later**:
  - `docs/architecture/competition-agnostic-review.md`
  - `docs/architecture/competition-agnostic-design.md`
  - `docs/data/competition-registry.md`
  - `packages/config/docs/competition-config.md`
  - `packages/shared/docs/naming-conventions.md`
- **Questions that must be answered before accepting**:
  - Which competition details belong in configuration versus provider data?
  - What generic vocabulary is mandatory across app and package boundaries?
  - What review checks should block hard-coded competition assumptions?

## Candidate 009: Betting, Bet History, Bankroll, and Responsible-Use Boundary

- **Proposed ADR title**: Betting History, Bankroll, Risk Rule, and Responsible-Use Boundary
- **Problem/question**: Which betting-related concepts should Miraichi plan before any calculations, and how should the app avoid deterministic financial advice?
- **Options considered**:
  - Read-only bet history planning only.
  - Bet history plus bankroll settings without stake recommendations.
  - Full bankroll and risk-rule behavior after responsible-use boundaries are accepted.
  - Defer all betting workflow decisions until prediction traceability exists.
- **Recommendation, if any**: Draft recommendation to plan audit and responsible-use boundaries before accepting calculation or strategy decisions.
- **Risks**:
  - Betting calculations could appear before risk and responsible-use constraints are clear.
  - Poorly scoped bankroll language may imply financial advice.
  - Historical accuracy and confidence may be misunderstood without careful UX and data definitions.
- **Decision owner**: Product Research Agent with Architect Agent, QA Agent, and Backend Agent input.
- **Status**: Candidate
- **Files that would be affected later**:
  - `docs/betting/betting-domain-overview.md`
  - `docs/betting/bet-history-plan.md`
  - `docs/betting/bankroll-management-plan.md`
  - `docs/betting/risk-limit-plan.md`
  - `docs/betting/responsible-use.md`
- **Questions that must be answered before accepting**:
  - Which bet history fields are required for auditability before calculations?
  - Which bankroll concepts are user settings versus system guidance?
  - What wording or product limits prevent deterministic financial advice?

## Candidate 010: Deployment and Environment Strategy

- **Proposed ADR title**: Deployment and Environment Strategy for Web, API, Worker, Local AI, and Storage
- **Problem/question**: Which components should run locally, which may later be hosted, and which environments are needed before production?
- **Options considered**:
  - Local-only development until architecture stabilizes.
  - Separate hosted services for each app boundary.
  - Hybrid deployment where local AI can remain local while web/API/worker are hosted later.
  - Defer deployment technology while defining environment responsibilities.
- **Recommendation, if any**: No final recommendation yet. Candidate decision should define environment responsibilities before selecting deployment targets.
- **Risks**:
  - Deployment decisions may be constrained by model runtime, provider credentials, and privacy requirements.
  - Local AI deployment can be costly or difficult if chosen too late.
  - Hosted environments can expose secrets or user data if security boundaries are incomplete.
- **Decision owner**: DevOps Agent with Architect Agent, Backend Agent, and AI/Data Agent input.
- **Status**: Candidate
- **Files that would be affected later**:
  - `DEPLOYMENT.md`
  - `ops/deploy/deployment-targets.md`
  - `ops/deploy/staging-plan.md`
  - `ops/deploy/production-plan.md`
  - `packages/config/docs/environment-strategy.md`
- **Questions that must be answered before accepting**:
  - Which environments are required before production?
  - Which components must support local execution?
  - Which deployment constraints depend on local AI runtime or provider access?

## Candidate 011: Security, Privacy, and Audit Boundary

- **Proposed ADR title**: Security, Privacy, and Audit Boundary for Prediction, Betting, Chat, and Provider Data
- **Problem/question**: What data categories are sensitive, what audit trail is required, and how should secrets and user data be protected before implementation?
- **Options considered**:
  - Minimal security planning until code exists.
  - Early classification of sensitive data and secrets before app skeleton work.
  - Full threat model before Phase 2.
  - Incremental security ADRs by area: auth, secrets, retention, audit, and chat privacy.
- **Recommendation, if any**: Draft recommendation to classify sensitive data and audit needs before app skeleton work, then split detailed controls into later ADRs.
- **Risks**:
  - Delayed privacy decisions can force rework in storage and chat design.
  - Provider credentials or user betting data can be exposed by weak boundaries.
  - Audit gaps can reduce trust in prediction and bankroll history later.
- **Decision owner**: QA Agent with Architect Agent, Backend Agent, and DevOps Agent input.
- **Status**: Candidate
- **Files that would be affected later**:
  - `SECURITY.md`
  - `docs/data/privacy-and-retention.md`
  - `apps/api/docs/auth-plan.md`
  - `docs/llm/safety-rules.md`
  - `packages/config/docs/environment-strategy.md`
- **Questions that must be answered before accepting**:
  - Which user and provider data categories are sensitive?
  - What audit trail is required before users can rely on prediction or bankroll history?
  - Which secrets must never enter docs, prompts, client code, or logs?

## Candidate 012: Testing and Competition-Agnostic Verification Strategy

- **Proposed ADR title**: Testing and Competition-Agnostic Verification Strategy
- **Problem/question**: What verification must block implementation if architecture, data, local AI, LLM, or betting concepts become competition-specific or untraceable?
- **Options considered**:
  - Manual documentation review only during Phase 1.
  - Automated checks for competition-specific naming and final-decision language.
  - Future boundary contract tests for API, ingestion, local AI, and LLM refusal behavior.
  - Combined manual and automated verification strategy.
- **Recommendation, if any**: Draft recommendation to use manual review during Phase 1 and define future automated checks before implementation broadens.
- **Risks**:
  - Manual-only review may miss repeated coupling patterns.
  - Automated keyword checks may produce false positives without context.
  - Missing boundary tests can allow later implementation to drift from planning docs.
- **Decision owner**: QA Agent with Architect Agent and Docs Maintainer Agent input.
- **Status**: Candidate
- **Files that would be affected later**:
  - `docs/workflows/testing-workflow.md`
  - `docs/workflows/pr-checklist.md`
  - `docs/architecture/competition-agnostic-review.md`
  - `WORKFLOW.md`
  - `SECURITY.md`
- **Questions that must be answered before accepting**:
  - Which competition-specific patterns should be blocked automatically?
  - Which boundary contracts need tests before Phase 2 or Phase 3?
  - How should false positives be reviewed without weakening the guardrail?

## Candidate 013: Agent Workflow and Handoff Governance

- **Proposed ADR title**: Agent Workflow and Handoff Governance for Architecture Decisions
- **Problem/question**: How should open questions move from planning docs into ADRs, tickets, specialist agent handoffs, and implementation plans?
- **Options considered**:
  - Project owner manually promotes open questions to ADRs.
  - Planner Agent maintains a decision backlog with specialist handoffs.
  - Each specialist agent owns ADR candidates for its domain.
  - Hybrid governance with Planner Agent coordination and specialist review.
- **Recommendation, if any**: Draft recommendation to use Planner Agent coordination with specialist-owner review before any ADR is accepted.
- **Risks**:
  - Unowned candidates can stall Phase 2.
  - Specialist agents may expand scope without handoff controls.
  - Accepted decisions may not reach roadmap, workflow, or architecture docs if governance is informal.
- **Decision owner**: Planner Agent with Project Owner and Docs Maintainer Agent input.
- **Status**: Candidate
- **Files that would be affected later**:
  - `AGENTS.md`
  - `docs/workflows/agent-handoff-workflow.md`
  - `packages/agent-protocol/docs/agent-communication.md`
  - `packages/agent-protocol/docs/handoff-rules.md`
  - `docs/agents/planner-agent.md`
- **Questions that must be answered before accepting**:
  - Who can promote an open question to an ADR candidate?
  - What evidence is required before an ADR candidate can become Draft or Accepted?
  - How should accepted decisions be propagated to root docs and specialist docs?
