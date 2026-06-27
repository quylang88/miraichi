# System Boundaries Draft

## Purpose
Draft high-level ownership boundaries for Miraichi apps and packages. These boundaries are planning inputs and should be refined before implementation.

## Status
- **Status**: Closed
- **Phase**: Phase 1 - Architecture Planning
- **Date**: 2026-06-23

## Scope
This document describes responsibilities, inputs, outputs, and prohibited responsibilities. It does not define implementation details, APIs, schemas, runtime technologies, or deployment topology.

## Boundary Principles
- Apps own user-facing or runtime responsibilities.
- Packages own shared language, configuration, UI primitives, or agent communication standards.
- Core concepts must remain competition-agnostic.
- Draft boundaries should prevent direct coupling between UI, local AI internals, provider-specific ingestion, and future storage choices.

## `apps/web`
- **Ownership**: User-facing interface for browsing, reviewing, and interacting with Miraichi workflows.
- **Responsibilities**: Present predictions, history, explanations, settings, and chat surfaces once upstream data exists.
- **Inputs**: Public API responses, UI package assets, shared display terms, and user interactions.
- **Outputs**: User requests, view state, form submissions, and chat or review actions routed through the API.
- **Must Not Do**: Fetch provider data directly, run prediction logic, calculate bankroll strategy, store secrets, or bypass API boundaries.

## `apps/api`
- **Ownership**: Application boundary between clients, storage, local AI, worker outputs, and agent-facing workflows.
- **Responsibilities**: Coordinate requests, enforce authorization later, expose controlled data access, and mediate prediction availability.
- **Inputs**: Web requests, chat routing requests, worker-produced data, local AI outputs, shared types, and configuration.
- **Outputs**: Client-facing responses, local AI requests, worker commands, audit-ready events, and status information.
- **Must Not Do**: Embed provider-specific ingestion logic, run local AI models directly, hard-code competition rules, or invent predictions.

## `apps/local-ai`
- **Ownership**: Structured football analysis and prediction-generation boundary.
- **Responsibilities**: Consume validated football data, produce traceable prediction candidates, and expose explainable analysis outputs later.
- **Inputs**: Normalized match, team, player, market, and historical context supplied through controlled boundaries.
- **Outputs**: Prediction candidates, confidence notes, trace references, and analysis status.
- **Must Not Do**: Handle user chat, manage bankroll decisions, fetch provider data directly, store secrets in prompts, or create competition-specific core behavior.

## `apps/worker`
- **Ownership**: Background ingestion, normalization, scheduled jobs, and future long-running task orchestration.
- **Responsibilities**: Coordinate provider polling, normalize provider data into generic concepts, and track data freshness or ingestion status.
- **Inputs**: Provider responses, configuration, scheduled triggers, and future queue messages.
- **Outputs**: Normalized records, ingestion logs, freshness signals, and task status updates.
- **Must Not Do**: Serve user UI requests, generate predictions directly, calculate bets, or expose provider-specific shapes as core concepts.

## `packages/shared`
- **Ownership**: Shared vocabulary, reusable planning types, naming conventions, and utility guidance.
- **Responsibilities**: Define generic language for competition, season, team, match, player, market, prediction, bet, bankroll, and risk rule.
- **Inputs**: Architecture decisions, domain model reviews, and app boundary needs.
- **Outputs**: Shared terms, future type candidates, and cross-app conventions.
- **Must Not Do**: Own app-specific behavior, provider integrations, persistence decisions, or competition-specific defaults.

## `packages/config`
- **Ownership**: Configuration conventions, feature flags, environment strategy, and competition registry planning.
- **Responsibilities**: Hold candidate places for competition metadata, feature toggles, and environment rules.
- **Inputs**: Architecture decisions, deployment constraints, competition metadata needs, and security guidance.
- **Outputs**: Draft configuration contracts, registry guidance, and environment planning notes.
- **Must Not Do**: Encode prediction algorithms, betting formulas, provider secrets, or hard-coded first-use-case behavior in core config.

## `packages/ui`
- **Ownership**: Shared user interface primitives and design-system guidance.
- **Responsibilities**: Provide reusable UI language, component rules, and visual consistency once implementation begins.
- **Inputs**: Product requirements, accessibility expectations, and web app needs.
- **Outputs**: UI guidelines, candidate components, tokens, and design-system documentation.
- **Must Not Do**: Own product logic, fetch data, calculate predictions or bets, or encode competition-specific labels as defaults.

## `packages/agent-protocol`
- **Ownership**: Communication schema and handoff rules for Miraichi subagents.
- **Responsibilities**: Define how agents pass tasks, status, decisions, open questions, changed files, and verification results.
- **Inputs**: Agent workflow requirements and specialist handoff needs.
- **Outputs**: Agent message formats, handoff rules, and coordination guidance.
- **Must Not Do**: Make architecture decisions, run implementation workflows, bypass scope guardrails, or silently expand task boundaries.
