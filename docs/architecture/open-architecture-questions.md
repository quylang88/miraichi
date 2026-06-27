# Open Architecture Questions

## Purpose
Collect the major questions Miraichi must answer before implementation begins. The questions are intentionally open-ended so later decisions can be made with context rather than locked during planning.

## Status
- **Status**: Closed
- **Phase**: Phase 1 - Architecture Planning
- **Date**: 2026-06-23

## Scope
This document covers architecture discovery questions only. It does not define final product scope, database schemas, API contracts, deployment targets, model choices, betting formulas, or competition-specific rules.

## Product Boundaries
- Which user workflows belong in the first planning target: prediction browsing, chat explanation, bet history, bankroll review, or responsible-use guidance?
- Which workflows must be read-only planning tools before any betting-management behavior is implemented?
- What information should be visible to casual users versus advanced analysts?
- Which outcomes should be considered product success: clarity, traceability, prediction coverage, responsible-use support, or operational reliability?

## App and Service Boundaries
- Should the first implementation keep all deployable apps separate, or should some begin as one process with clear internal boundaries?
- What requests should pass through `apps/api` instead of directly reaching `apps/local-ai` or `apps/worker`?
- Which boundaries need synchronous request/response behavior, and which should be asynchronous?
- What package dependencies are allowed between apps and shared packages?

## Local AI Boundaries
- What inputs should local AI require before it can generate a prediction candidate?
- What trace data should local AI provide so predictions can be reviewed later?
- Should local AI run as a separate service, local process, batch job, or candidate module at first?
- What counts as "prediction unavailable" versus "prediction generated with low confidence"?

## LLM and Chat Boundaries
- Which user intents should the LLM answer directly, route to API data, or refuse because local AI has not produced a prediction?
- How should the LLM explain uncertainty without inventing missing analysis?
- What evidence must be attached before the LLM summarizes a prediction?
- Should chat sessions be persisted, summarized, or treated as transient?

## Data Ingestion Boundaries
- Which provider categories should be evaluated first: fixtures, results, team stats, player stats, odds, or market movement?
- What ingestion responsibilities belong in workers versus API-admin workflows?
- How should provider-specific fields be normalized without leaking provider assumptions into core concepts?
- What retry, rate-limit, and data-quality policies need ADRs later?

## Betting, History, and Bankroll Boundaries
- Which bet history fields are required for auditability before calculations exist?
- Which bankroll and risk-rule concepts should be planned as user configuration versus system guidance?
- What responsible-use boundaries should prevent the app from presenting deterministic financial advice?
- How should historical accuracy be represented before any betting strategy is selected?

## Storage Options
- Which storage responsibilities are needed first: operational app state, ingestion history, prediction outputs, audit logs, chat context, or configuration?
- What data should be immutable once recorded?
- What retention and deletion requirements are likely to matter for privacy and responsible-use expectations?
- Which storage choices need to remain swappable until later ADRs?

## Deployment Options
- Which components need to run locally for development and which may later be hosted?
- What operational boundaries should exist between web, API, worker, local AI, and data storage?
- What environments are needed before production: local, test, staging, demo, or production?
- Which deployment constraints depend on model runtime, data provider access, or user privacy?

## Security and Privacy
- What user data categories are sensitive: identity, betting history, bankroll settings, chat content, prediction notes, or provider credentials?
- Which secrets and provider credentials must never enter docs, prompts, or client-visible code?
- What audit trail is needed before users can rely on predictions or bankroll history?
- What authorization boundaries should exist between user data, admin data, and agent workflows?

## Testing Strategy
- What should be validated with documentation checks during Phase 1?
- Which later tests should cover boundary contracts, ingestion normalization, prediction traceability, and LLM refusal behavior?
- What fixtures can demonstrate competition-agnostic behavior without hard-coding one competition?
- What acceptance tests should block implementation if a core concept becomes competition-specific?

## Competition-Agnostic Design
- What is the minimum generic vocabulary for competition, season, team, match, player, market, prediction, bet, bankroll, and risk rule?
- Which competition-specific properties belong in configuration or provider data rather than core logic?
- How should different competition formats be represented without branching core code by competition name?
- What review checks should flag accidental World Cup assumptions?

## Agent Workflow
- Which agent owns architecture planning updates, and when should work be handed to specialist agents?
- What structured handoff fields are required for architecture, frontend, backend, AI/data, QA, DevOps, and docs tasks?
- How should open questions become later ADRs, tickets, or implementation plans?
- What validation must agents perform before marking Phase 1 docs ready for owner review?
