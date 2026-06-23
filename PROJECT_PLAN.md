# Project Plan

Detailed implementation lifecycle and execution phases for Miraichi.

## Purpose
This document provides the roadmap and scope boundaries for all engineering phases from repo bootstrapping to operational deployment.

## Status
- **Status**: Draft

## Scope
Defines the sequential milestones and execution rules for developers and autonomous agents working on Miraichi.

## Execution Guidelines
1. No implementation of business logic, prediction algorithms, or database schemas during Phase 0.
2. Maintain strict competition-agnostic architecture throughout all phases.
3. Every phase must pass verification guidelines defined in the workflow files.

## Project Phases

### Phase 0: Repo Bootstrap and Docs
- **Goal**: Establish monorepo workspace and initial docs.
- **Deliverables**: Directory trees, placeholder config files, agent rules, work-flow definitions, and ADRs.
- **Status**: In Progress.

### Phase 1: Architecture Planning
- **Goal**: Create concrete technical plans, route maps, design system definition, and API schemas.
- **Deliverables**: Finalized API schemas, database schemas plans, design patterns, and local AI interface models.
- **Status**: TODO.

### Phase 2: App Skeleton
- **Goal**: Deploy running skeleton code for all major applications and packages.
- **Deliverables**: Hello-world servers, frontend setup with UI packages, local AI server with mock responses, and worker stub with Redis setup.
- **Status**: TODO.

### Phase 3: Data Ingestion Skeleton
- **Goal**: Ingest external football matches and odds feeds dynamically.
- **Deliverables**: Workers to poll, transform, and store generic sports data.
- **Status**: TODO.

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
- **Deliverables**: GitHub Actions, Docker images, and monitoring dashboards.
- **Status**: TODO.

## TODO / Next Steps
- [ ] Transition project status to Phase 1 upon approval of bootstrap deliverables.
