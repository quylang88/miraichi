# Project Plan

Detailed implementation lifecycle and execution phases for Miraichi.

## Purpose
This document provides the roadmap and scope boundaries for all engineering phases from repo bootstrapping to operational deployment.

## Status
- **Status**: Draft

## Scope
Defines the sequential milestones and execution rules for developers and autonomous agents working on Miraichi.

## Execution Guidelines
1. No implementation of business logic, prediction algorithms, betting calculations, or production database schemas during Phase 0 or Phase 1.
2. Maintain strict competition-agnostic architecture throughout all phases.
3. Every phase must pass verification guidelines defined in the workflow files.

## Project Phases

### Phase 0: Repo Bootstrap and Docs
- **Goal**: Establish monorepo workspace and initial docs.
- **Deliverables**: Directory trees, placeholder config files, agent rules, work-flow definitions, and ADRs.
- **Status**: Completed.

### Phase 1: Architecture Planning
- **Goal**: Explore architecture questions, trade-offs, draft boundaries, and planning options before implementation.
- **Deliverables**: Phase 1 planning package, open architecture questions, candidate options, draft system boundaries, draft data flow, LLM/local AI boundary notes, competition-agnostic review, and ADR-0002.
- **Status**: Completed.

### Phase 2: App Skeleton and Scaffold
- **Goal**: Define boundaries, mock contracts, and deploy running skeleton code for all major applications and packages.
- **Deliverables**: Minimal app skeletons, frontend setup with UI package integration, local AI boundary stub, and worker boundary stub using technology choices accepted in later ADRs.
- **Status**: Completed.

### Phase 3: Data Ingestion Planning
- **Goal**: Ingest external football matches and odds feeds dynamically.
- **Deliverables**: Workers to poll, transform, and store generic sports data.
- **Status**: Ready for Planning.

### Phase 4: Local AI Skeleton
- **Goal**: Hook up LLMs and local AI pipelines to digest generic football statistics.
- **Deliverables**: Inference endpoints, local prediction pipeline tests, and prompt routing logs.
- **Status**: TODO.

### Phase 5: Betting/History/Bankroll Modules
- **Goal**: Implement betting rules, audit logs, and bankroll tracking logic.
- **Deliverables**: Prediction accuracy evaluations, bankroll adjustments, risk limit checks.
- **Status**: TODO.

### Phase 6: Testing/Deployment
- **Goal**: Perform end-to-end integration, security audits, and production deployments.
- **Deliverables**: Accepted CI/CD workflows, deployment artifacts, and monitoring dashboards.
- **Status**: TODO.

## TODO / Next Steps
- [x] Review Phase 1 architecture planning package.
- [x] Convert approved Phase 1 recommendations into accepted/proposed ADRs.
- [x] Complete Phase 1 completion review.
- [x] Complete Phase 2 App Skeleton and Scaffold.
- [ ] Begin Phase 3 Data Ingestion Planning.
