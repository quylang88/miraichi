# Architecture Options

## Purpose
Describe candidate architecture options for Miraichi without choosing a final architecture. These options are planning inputs for later owner decisions and ADRs.

## Status
- **Status**: Closed
- **Phase**: Phase 1 - Architecture Planning
- **Date**: 2026-06-23

## Scope
This document compares high-level architecture options only. It does not select a final framework, database, queue, deployment model, model runtime, API format, prediction algorithm, or betting strategy.

## Candidate Option: Monorepo With Modular Apps

### Summary
Keep Miraichi in one monorepo with separate app boundaries for web, API, local AI, and worker responsibilities, plus shared packages for common types, configuration, UI, and agent protocol documents.

### Benefits
- Keeps planning, docs, and shared concepts visible in one repository.
- Supports clear ownership boundaries while the project is still early.
- Makes competition-agnostic vocabulary easier to review across apps and packages.

### Risks
- Shared packages can become too broad if ownership rules are weak.
- App boundaries may blur if early implementation reaches across folders directly.
- Monorepo convenience can hide deployment and runtime differences.

### When This Option Makes Sense
- The project needs coordinated docs, shared concepts, and agent handoffs.
- Early implementation should stay lightweight while boundaries are refined.
- The owner wants one source of truth for architecture and workflow decisions.

### When This Option Should Be Avoided
- Individual services need fully independent release cycles immediately.
- Runtime or security constraints require hard isolation from the beginning.
- The team cannot maintain package ownership rules.

### Open Questions
- Which shared concepts belong in packages versus app-specific docs?
- What import and dependency rules should be enforced later?
- Which apps should become independently deployable first?

## Candidate Option: API-First Architecture

### Summary
Route user-facing and agent-facing operations through an API boundary that mediates access to storage, local AI, workers, and user-facing clients.

### Benefits
- Gives the web UI and LLM layer one controlled boundary for application data.
- Helps keep local AI and worker internals out of user-facing surfaces.
- Creates a natural place for authorization, auditability, and request validation later.

### Risks
- The API boundary can become too large if it absorbs domain logic too early.
- Early API contracts may be over-designed before data and prediction needs are clear.
- Synchronous API flows may not fit slower ingestion or analysis tasks.

### When This Option Makes Sense
- The project needs a clear control plane between UI, chat, storage, and analysis.
- Authorization and auditability are likely to matter early.
- Multiple clients may need consistent access to the same planning data later.

### When This Option Should Be Avoided
- The first implementation is purely local and does not need network boundaries.
- Local AI experimentation needs to move faster than API contract design.
- The team is not ready to define even draft request/response boundaries.

### Open Questions
- Which operations should be synchronous API calls versus queued work?
- Should the API expose prediction status separately from prediction results?
- What minimum audit metadata should API-mediated actions preserve?

## Candidate Option: Local-First AI Engine

### Summary
Treat structured football analysis and prediction generation as a local AI boundary that can run independently from the LLM chat experience.

### Benefits
- Keeps prediction generation separate from conversational explanation.
- Supports traceable inputs and outputs for review.
- Reduces the risk that LLM responses become the source of prediction truth.

### Risks
- Local runtime choices may affect deployment and developer setup later.
- Structured analysis may need more data-quality gates before useful outputs exist.
- Separating local AI too early can add integration overhead.

### When This Option Makes Sense
- Prediction traceability and explainability are core product requirements.
- The owner wants LLMs to route and explain, not invent prediction outputs.
- The project expects model experimentation independent from web or API work.

### When This Option Should Be Avoided
- The first milestone only needs static planning examples.
- No reliable data inputs exist for local analysis yet.
- Runtime constraints make local processing impractical for target users.

### Open Questions
- What minimum input bundle is required before local AI may emit a prediction?
- What trace fields should accompany every prediction candidate later?
- Should local AI be invoked on demand, on schedule, or both?

## Candidate Option: Worker-Based Data Ingestion

### Summary
Use a worker boundary for provider polling, normalization, scheduled refreshes, and background data-quality checks.

### Benefits
- Keeps slow or recurring provider work outside user-facing API requests.
- Creates a natural place for retries, rate-limit handling, and ingestion audit logs later.
- Helps provider-specific details stay outside core product and AI boundaries.

### Risks
- Queue and scheduling choices can become premature stack decisions.
- Background jobs can hide failures unless monitoring is planned.
- Normalization rules may drift into business logic if not reviewed.

### When This Option Makes Sense
- Data providers have latency, rate limits, changing feeds, or scheduled updates.
- Prediction freshness depends on repeatable ingestion.
- Provider-specific mapping needs a controlled boundary.

### When This Option Should Be Avoided
- Initial data is manually curated for planning only.
- There is no provider relationship or feed shape to evaluate.
- The project cannot yet define operational monitoring needs.

### Open Questions
- Which data sources require scheduled ingestion versus manual import?
- What failures should block predictions versus mark data as stale?
- What ingestion history must be visible for audit and debugging?

## Candidate Option: LLM as Orchestration and Chat Layer Only

### Summary
Constrain the LLM layer to conversation, explanation, routing, summarization, and user interaction while keeping prediction truth in structured local AI outputs.

### Benefits
- Reduces hallucination risk for predictions and betting-related guidance.
- Makes the LLM role easier to test through refusal and routing scenarios.
- Preserves a clear distinction between generated explanation and generated prediction.

### Risks
- Users may expect the chat layer to answer when structured outputs are unavailable.
- The LLM needs strong context boundaries to avoid overstating uncertainty.
- Chat experience may feel limited until local AI outputs are available.

### When This Option Makes Sense
- Traceability and responsible-use behavior are more important than conversational boldness.
- The project needs explainable prediction summaries.
- The owner wants LLMs to improve UX without becoming the prediction engine.

### When This Option Should Be Avoided
- The product goal is an unconstrained conversational assistant.
- The project has no structured prediction source and no plan to create one.
- Users do not need chat or explanation surfaces in the first version.

### Open Questions
- What exact refusal message should appear when no local AI prediction exists?
- What evidence should the LLM cite or summarize for prediction explanations?
- Should LLM chat state be stored, summarized, or discarded?

## Candidate Option: Configuration-Driven Competition Model

### Summary
Represent competition-specific details as configuration or provider data so core logic uses generic concepts such as competition, season, team, match, player, market, prediction, bet, bankroll, and risk rule.

### Benefits
- Keeps the architecture extensible beyond the first use case.
- Makes competition-specific assumptions easier to review and change.
- Supports multiple competitions without changing core app boundaries.

### Risks
- Configuration can become complex if format differences are not modeled carefully.
- Too much configuration can hide business meaning from reviewers.
- Early examples can accidentally become implicit defaults.

### When This Option Makes Sense
- Miraichi must support multiple competitions and seasons over time.
- Competition format details vary enough to require data-driven behavior.
- Architecture reviews need a clear place to look for competition-specific settings.

### When This Option Should Be Avoided
- The product is intentionally limited to one competition forever.
- The team cannot maintain review rules for configuration changes.
- Configuration starts encoding prediction or betting logic instead of metadata.

### Open Questions
- Which competition details belong in configuration versus provider data?
- How should competition format variation be validated later?
- What review checks should prevent initial-use-case examples from becoming core assumptions?
