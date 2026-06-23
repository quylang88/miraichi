# Miraichi

An AI-driven football prediction and betting management application.

## Purpose
Miraichi provides an extensible platform for AI football prediction, betting management, risk limits, bankroll tracking, and collaborative agent workflows.

## Status
- **Status**: Draft
- **Current Phase**: Phase 1 - Architecture Planning

## Scope
This repository houses the entire monorepo system, including frontend, backend API, local AI modules, worker queues, and operational files. 

> [!IMPORTANT]
> **No business logic, production database schemas, prediction algorithms, betting calculations, or real app code is implemented in Phase 1.**
> Current work is limited to architecture discovery, open questions, candidate options, draft boundaries, and planning documents.

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
- [ ] Review the Phase 1 architecture planning package.
- [ ] Decide which architecture options need follow-up ADRs.
- [ ] Approve implementation boundaries before starting app skeleton work.
