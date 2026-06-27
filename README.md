# Miraichi

An AI-driven football prediction and betting management application.

## Purpose
Miraichi provides an extensible platform for AI football prediction, betting management, risk limits, bankroll tracking, and collaborative agent workflows.

## Status
- **Status**: Draft
- **Current Phase**: Phase 5 - Betting History, Bankroll, Reports, AI Recommendation Boundary, and Extensible Business Logic Discovery
- **Phase Source of Truth**: `PROJECT_PLAN.md`

## Scope
This repository houses the entire monorepo system, including frontend, backend API, local AI modules, worker queues, and operational files. 

> [!IMPORTANT]
> Miraichi work must follow `.agent/skills/miraichi-delivery-lifecycle/SKILL.md`.
> Business logic, production database schemas, prediction algorithms, betting calculations, secrets, and hard-coded competition logic still require explicit owner-approved ADRs and implementation plans before coding.

## Main Folder Structure
The repository keeps a clean root structure with exactly 4 main folders:
- **`apps/`**: Deployable applications (web client, backend API, local AI service, background worker).
- **`packages/`**: Shared libraries and monorepo packages (shared types, global configs, UI library, agent protocols).
- **`docs/`**: General documentation, architectural design records (ADRs), betting/bankroll plans, and agent workflow specifications.
- **`ops/`**: Operational, deployment, docker, CI/CD pipelines, scripts, and monitoring infrastructure.

## Competition-Agnostic Principle
While the initial launch targets World Cup use cases, the domain language, data contracts, predictions pipeline, and backend services must remain **strictly competition-agnostic**.
- Do not hard-code World Cup logic, rules, or identifiers anywhere in the codebase.
- Treat football competition metadata as dynamic, configurable registry data.
- Football domain concepts (competitions, seasons, teams, matches, markets, bets, bankrolls) are modeled abstractly.

## TODO / Next Steps
- [ ] Continue Phase 5 execution only through approved lifecycle phases.
- [ ] Use `phase:plan`, `phase:implementation-plan`, `phase:code-slice`, `phase:integration-test`, `phase:staging`, `phase:owner-feedback`, `phase:production`, or `phase:maintenance` to make the active gate explicit.
- [ ] Run `pnpm run verify:release` before staging or production promotion.
