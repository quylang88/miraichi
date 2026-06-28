# Miraichi

An AI-driven football prediction and betting management application.

## Purpose
Miraichi provides an extensible platform for AI football prediction, betting management, risk limits, bankroll tracking, and collaborative agent workflows.

## Status
- **Status**: Active
- **Current Phase**: Pre-Phase 5.10 - Docs Hygiene Complete, Phase 5.10 Review Pending
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
The first real data and training path targets World Cup and related national-team competitions. Club competitions are later expansion scope.
- World Cup and national-team competition metadata may be explicit in registry/config/data artifacts.
- Do not put World Cup-only assumptions into core parser, route, model, or business logic.
- Treat football competition metadata as dynamic, configurable registry data.
- Football domain concepts (competitions, seasons, teams, matches, markets, bets, bankrolls) are modeled abstractly.

## TODO / Next Steps
- [ ] Review draft Phase 5.10 planning after docs status hygiene cleanup.
- [ ] Use `phase:plan`, `phase:implementation-plan`, `phase:code-slice`, `phase:integration-test`, `phase:staging`, `phase:owner-feedback`, `phase:production`, or `phase:maintenance` to make the active gate explicit.
- [ ] Run `pnpm run verify:release` before staging or production promotion.
