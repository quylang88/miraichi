# Miraichi

An AI-driven football prediction and betting management application.

## Purpose
Miraichi provides an extensible platform for AI football prediction, betting management, risk limits, bankroll tracking, and collaborative agent workflows.

## Status
- **Status**: Draft
- **Current Phase**: Phase 0 - Repository Bootstrap & Documentation Only

## Scope
This repository houses the entire monorepo system, including frontend, backend API, local AI modules, worker queues, and operational files. 

> [!IMPORTANT]
> **No business logic, database schemas, prediction algorithms, or real app code is implemented in this bootstrap phase.**
> All code directories contain only placeholder structures and guides.

## Main Folder Structure
The repository keeps a clean root structure with exactly 4 main folders:
- **`apps/`**: Deployable applications (web client, backend API, local AI service, background worker).
- **`packages/`**: Shared libraries and monorepo packages (shared types, global configs, UI library, agent protocols).
- **`docs/`**: General documentation, architectural design records (ADRs), betting/bankroll plans, and agent workflow specifications.
- **`ops/`**: Operational, deployment, docker, CI/CD pipelines, scripts, and monitoring infrastructure.

## Competition-Agnostic Principle
While the initial launch targets World Cup use cases, the domain model, database contracts, predictions pipeline, and backend services must remain **strictly competition-agnostic**.
- Do not hard-code World Cup logic, rules, or identifiers anywhere in the codebase.
- Treat football competition metadata as dynamic, configurable registry data.
- Football domain concepts (competitions, seasons, teams, matches, markets, bets, bankrolls) are modeled abstractly.

## TODO / Next Steps
- [ ] Implement packages/config competition registry schema
- [ ] Initialize apps/api server skeleton
- [ ] Set up apps/web client skeleton
- [ ] Build data ingestion pipelines under apps/worker
