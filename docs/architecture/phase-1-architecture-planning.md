# Phase 1 Architecture Planning

## Purpose
Define Phase 1 as an architecture discovery phase for Miraichi. This document explains what the project should explore before implementation, what remains intentionally undecided, and which planning deliverables should guide later decisions.

## Status
- **Status**: Closed
- **Phase**: Phase 1 - Architecture Planning
- **Date**: 2026-06-23

## Scope
This document covers high-level architecture planning only. It applies to docs and decision records for the Miraichi monorepo and does not authorize production code, business logic, database schemas, prediction algorithms, betting calculations, secrets, or final technology stack choices.

## Phase Goal
Phase 1 should help the project owner compare options and understand trade-offs before committing to implementation. The first version may use a World Cup scenario as an initial use case, but core architecture must remain competition-agnostic and support future competitions, seasons, teams, matches, markets, predictions, bets, bankroll rules, and risk rules.

## What Will Be Explored
- Product boundaries between prediction support, betting management, responsible-use guidance, and user-facing workflows.
- Candidate boundaries for `apps/web`, `apps/api`, `apps/local-ai`, `apps/worker`, and shared packages.
- Draft data flow from external data providers through ingestion, storage, analysis, API access, web UI, and LLM chat.
- Candidate responsibilities for the LLM layer versus the local AI engine.
- Storage, deployment, testing, security, privacy, and agent workflow trade-offs.
- Competition-agnostic modeling principles and risks.

## What Will Not Be Decided Yet
- Final frontend, backend, local AI, queue, storage, database, or deployment technology.
- Production database tables, migrations, indexes, or retention rules.
- Prediction algorithms, model runtimes, feature engineering formulas, or evaluation thresholds.
- Betting calculations, bankroll formulas, stake sizing rules, or risk-rule enforcement logic.
- Final API contracts, event contracts, package interfaces, or agent protocol implementations.
- Any competition-specific core logic.

## Expected Deliverables
- Open architecture questions grouped by decision area.
- Candidate architecture options with benefits, risks, fit signals, avoidance signals, and open questions.
- Draft system boundaries for apps and packages.
- Draft generic data flow.
- Draft LLM/local AI responsibility boundary.
- Competition-agnostic architecture review.
- ADR-0002 documenting Phase 1 as discovery rather than final architecture locking.

## Draft Exit Criteria
Phase 1 can be considered ready for owner review when:
- Major architecture questions are visible and grouped.
- Candidate options are documented without forcing a final choice.
- System and data-flow boundaries are drafted at a high level.
- Competition-agnostic risks are reviewed.
- Follow-up decisions are clearly deferred to later ADRs or implementation phases.
