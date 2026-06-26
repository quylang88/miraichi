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
- **Goal**: Plan and architect data ingestion adapters, quality rules, and abstraction interfaces before live integrations.
- **Deliverables**: Phase 3 planning docs, data guardrails, candidate ADRs, and generic mock ingestion schemas.
- **Status**: Completed.

### Phase 4: Local AI Skeleton
- **Goal**: Hook up LLMs and local AI pipelines to digest generic football statistics.
- **Deliverables**: Inference endpoints, local prediction pipeline tests, and prompt routing logs.
- **Status**: Completed.

### Phase 5: Betting History, Bankroll, Reports, AI Recommendation Boundary, and Extensible Business Logic Discovery
- **Goal**: Gather owner requirements, formulate open questions, design extensible domain boundaries, accept Wave A foundation ADRs, plan future implementation, establish approved TypeScript tooling, add type-only shared contracts, and add static typechecked market config for accepted Wave A boundaries.
- **Deliverables**: Business logic discovery specs, open questions list, extensible boundaries design, candidate ADRs (ADR-0023 to ADR-0032), accepted Phase 5.2 Wave A foundation ADRs, accepted ADR-0034 TypeScript technical direction, Phase 5.3 Wave A implementation planning documents, Phase 5.4 TypeScript tooling setup, Phase 5.5 Typed Shared Domain Contracts, Phase 5.6 Market Catalog and Line Preset Config, and Phase 5.7A provisional Black Apple Ledger PWA UI preview closure.
- **Status**: Active.

### Phase 6: Testing/Deployment
- **Goal**: Perform end-to-end integration, security audits, and production deployments.
- **Deliverables**: Accepted CI/CD workflows, deployment artifacts, and monitoring dashboards.
- **Status**: TODO.

### Phase 7: Real Data Provider, Dataset, and Evaluation Planning
- **Goal**: Plan real provider selection, dataset construction, data quality, evaluation methodology, and governance for future real prediction work.
- **Deliverables**: Owner-approved ADRs for data provider strategy, dataset boundaries, evaluation criteria, and model-readiness gates.
- **Status**: Future.

### Phase 8: Model Training and Prediction Engine R&D
- **Goal**: Research and prototype real model training and prediction engine approaches only after Phase 7 planning is accepted.
- **Deliverables**: Owner-approved R&D plans, model experiment boundaries, evaluation reports, and prediction algorithm ADRs.
- **Status**: Future.

## TODO / Next Steps
- [x] Review Phase 1 architecture planning package.
- [x] Convert approved Phase 1 recommendations into accepted/proposed ADRs.
- [x] Complete Phase 1 completion review.
- [x] Complete Phase 2 App Skeleton and Scaffold.
- [x] Begin Phase 3 Data Ingestion Planning.
- [x] Review and approve Phase 3 Candidate ADRs (ADR-0013 to ADR-0016).
- [x] Implement provider-agnostic parser interfaces and local mock data ingestion in worker.
- [x] Begin Phase 4 Local AI Skeleton planning.
- [x] Approve Phase 4 candidate ADRs (ADR-0017 to ADR-0021).
- [x] Mock-up local-ai service and verify trace metadata pipeline.
- [x] Establish PWA-first client delivery strategy and make web app PWA-ready.
- [x] Begin Phase 5 Betting/History/Bankroll planning and draft candidate ADRs.
- [x] Create Phase 5.2 Wave A ADR planning documents and 6 draft ADRs (ADR-0023, 0024, 0025, 0026, 0031, 0033).
- [x] Accept Phase 5.2 Wave A foundation ADRs and ADR-0034 as architecture/planning boundaries only.
- [x] Begin Phase 5.3 Wave A Implementation Planning without starting implementation.
- [x] Complete Phase 5.4 TypeScript tooling setup execution.
- [x] Complete Phase 5.5 Typed Shared Domain Contracts execution.
- [x] Complete Phase 5.6 Market Catalog and Line Preset Config execution.
- [x] Complete Phase 5.7A Black Apple Ledger PWA UI preview as a provisional preview baseline only.
- [ ] Defer Phase 5.7B PWA Navigation Shell and Forms implementation until the owner explicitly approves a production UI implementation plan.
- [ ] Plan App Settings and Language/i18n, including English and Vietnamese support plus additional owner-requested app settings.
- [ ] Begin Phase 5.8 Local-First Persistence and Backup Planning/Adapter Boundary as the recommended next planning phase.
- [ ] Keep real AI training out of Phase 5.3 and Phase 6; plan it only through future Phase 7 and Phase 8 ADRs.
