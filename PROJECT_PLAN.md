# Project Plan

Detailed implementation lifecycle and execution phases for Miraichi.

## Purpose
This document provides the roadmap and scope boundaries for all engineering phases from repo bootstrapping to operational deployment.

## Status
- **Status**: Active

## Scope
Defines the sequential milestones and execution rules for developers and autonomous agents working on Miraichi.

## Execution Guidelines
1. No implementation of business logic, prediction algorithms, betting calculations, or production database schemas during Phase 0 or Phase 1.
2. Maintain strict competition-agnostic architecture throughout all phases.
3. Every phase must pass verification guidelines defined in the workflow files.
4. All implementation and release work must follow `.agent/skills/miraichi-delivery-lifecycle/SKILL.md`.
5. `PROJECT_PLAN.md` is the source of truth for the current project phase when root docs disagree.
6. Intermediate phases must close with evidence and a next-phase recommendation, not formal owner-feedback or production promotion. Final owner review and production promotion happen only after all planned release phases are complete or explicitly removed from scope.
7. Guardrail-sensitive decisions still require explicit owner direction before implementation, even when formal owner review is deferred.

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
- **Goal**: Gather owner requirements, formulate open questions, design extensible domain boundaries, accept Wave A foundation ADRs, plan future implementation, establish approved TypeScript tooling, add type-only shared contracts, add static typechecked market config for accepted Wave A boundaries, establish accepted UI design baseline, plan settings/localization/i18n, implement the production PWA shell, clean document statuses before Phase 5.10 starts, close Phase 5.10 Add Bet draft/form-state persistence planning, implement the Phase 5.11 local-first Add Bet draft persistence boundary, and complete Phase 5.12 owner-requested UI/UX quality-up before Phase 5 closeout.
- **Deliverables**: Business logic discovery specs, open questions list, extensible boundaries design, candidate ADRs (ADR-0023 to ADR-0032), accepted Phase 5.2 Wave A foundation ADRs, accepted ADR-0034 TypeScript technical direction, Phase 5.3 Wave A implementation planning documents, Phase 5.4 TypeScript tooling setup, Phase 5.5 Typed Shared Domain Contracts, Phase 5.6 Market Catalog and Line Preset Config, Phase 5.7A Black Apple Ledger PWA UI preview closure, Phase 5.8 App Settings, Language/i18n, and UI Flexibility Planning package, Phase 5.9 Production PWA Shell Implementation, pre-Phase 5.10 document status hygiene, owner-approved Phase 5.10 Add Bet Draft/Form State + Persistence Planning, Phase 5.11 local-first Add Bet draft persistence and backup/import code slices, and Phase 5.12 quality-up UI/UX improvements.
- **Status**: Completed.

### Phase 6: Testing/Deployment Hardening
- **Goal**: Perform end-to-end integration, security audits, staging deployment hardening, CI/CD automation planning, TypeScript strictness hardening, and non-production release readiness work.
- **Deliverables**: Accepted CI/CD workflows, repeatable staging deployment artifacts, smoke-check automation, owner-approved repo-wide JavaScript-to-TypeScript source migration, TypeScript strictness hardening plan and code slices, rollback notes, and monitoring plan drafts.
- **Status**: Completed.

### Phase 7: Real Data Provider, Dataset, and Evaluation Planning
- **Goal**: Plan real provider selection, dataset construction, data quality, evaluation methodology, and governance for future real prediction work. The first provider target may be full FIFA World Cup fixture coverage, but implementation must remain competition-agnostic and adapter-based.
- **Deliverables**: Owner-approved ADRs for data provider strategy, full World Cup fixture source coverage, dataset boundaries, evaluation criteria, provider adapter contracts, and model-readiness gates.
- **Status**: Completed.

### Phase 8: Model Training and Prediction Engine R&D
- **Goal**: Research and prototype owner-only, free-tier model training approaches through World Cup and national-team competition datasets first, then leakage-safe feature specs, chronological evaluation, and model comparison reports before any real inference runtime is selected. Club competitions are expansion scope after the national-team-first path is reviewed.
- **Deliverables**: Phase 8 owner-only R&D subphase plan, World Cup/national-team dataset snapshot and provenance plan, feature spec and leakage audit plan, evaluation harness and baseline reports, candidate model bake-off report, owner-approved model-selection ADR, and optional runtime packaging plan only if evidence justifies it.
- **Status**: Active.

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
- [x] Complete Phase 5.7A Black Apple Ledger PWA UI preview as a provisional preview baseline only (adjustable).
- [x] Defer Phase 5.7B PWA Navigation Shell and Forms implementation until the owner explicitly approves a production UI implementation plan.
- [x] Plan App Settings and Language/i18n, including English and Vietnamese support plus additional owner-requested app settings (Phase 5.8).
- [x] Complete Phase 5.9 Production PWA Shell Implementation, using production-baseline Black Apple Ledger structure with TypeScript-first shell modules.
- [x] Start pre-Phase 5.10 document status hygiene cleanup.
- [x] Complete Phase 1, Phase 3, Phase 4, app/package, and ops docs hygiene slices.
- [x] Complete owner-approved Phase 5.10 Add Bet Draft/Form State + Persistence Planning.
- [x] Create Phase 5.11 Local-First Add Bet Draft Persistence Implementation Plan.
- [x] Owner review Phase 5.11 implementation plan before `phase:code-slice`.
- [x] Complete Phase 5.11 Local-First Add Bet Draft Persistence code slices.
- [x] Run `phase:integration-test Phase 5.11` before staging.
- [x] Run `phase:staging Phase 5.11` and record closeout evidence before the next phase.
- [x] Create/link Cloudflare Pages project `miraichi-staging`, deployment token, Pages URL, and smoke-check evidence.
- [x] Defer formal owner-feedback and production promotion until all planned release phases are complete.
- [x] Complete `phase:quality-up ui-ux-improve Phase 5.12 Owner Requested Shell Cleanup` staging redeploy before Phase 5 closeout.
- [x] After Phase 5.12 staging passes, decide whether Phase 5 can close or whether another explicit Phase 5 quality-up item exists.
- [x] Close Phase 5 with staging smoke evidence and recommend Phase 6 planning.
- [x] Start `phase:plan Phase 6 Testing/Deployment Hardening` only after Phase 5 closeout.
- [x] Owner review Phase 6 Testing/Deployment Hardening Plan before implementation planning.
- [x] Create `phase:implementation-plan Phase 6 CI/CD and Staging Smoke Automation`.
- [x] Owner review Phase 6 CI/CD and Staging Smoke Automation implementation plan before `phase:code-slice`.
- [x] Complete `phase:code-slice Phase 6 staging smoke-check script`.
- [x] Complete `phase:code-slice Phase 6 CI check workflow`.
- [x] Complete owner-requested `phase:code-slice Phase 6 repo-wide JavaScript-to-TypeScript migration`.
- [x] Create `phase:implementation-plan Phase 6 TypeScript Strictness Hardening`.
- [x] Start `phase:code-slice Phase 6 type-safety audit gate`.
- [x] Run `phase:staging Phase 6 hardened staging process` only after TypeScript strictness hardening passes local and integration verification.
- [x] Keep real AI training out of Phase 6; plan it only through future Phase 7 and Phase 8 ADRs.
- [x] Open Phase 7 planning and draft candidate ADRs.
- [x] Split Phase 7 ADR candidates into standalone draft ADR files and record draft review.
- [x] Accept ADR-0036, ADR-0037, ADR-0038, and ADR-0039 as Phase 7 planning boundaries only.
- [x] Complete owner review for ADR-0035 provider strategy, with owner-only free-tier provider confirmation before acceptance.
- [x] Complete owner review for ADR-0040 model-readiness gates, with Phase 8 evidence or narrower owner-only R&D report authority before acceptance.
- [x] Complete Phase 7 Real Data Provider, Dataset, and Evaluation Planning only after owner-approved ADRs exist.
- [x] Create Phase 8 Owner-Only Model R&D plan and split Phase 8 into smaller gated subphases.
- [ ] Owner review Phase 8.0 R&D boundary split before Phase 8.1 implementation planning.
- [x] Create `phase:implementation-plan Phase 8.1 Dataset Snapshot and Provenance`.
- [x] Complete Phase 8.1 reproducible offline dataset snapshot and data quality report.
- [x] Review and correct Phase 8.1 to make World Cup/national-team competitions the explicit first data target before Phase 8.2.
- [x] Create `phase:implementation-plan Phase 8.2 Feature Spec and Leakage Audit`.
- [ ] Complete Phase 8.2 Feature Spec and Leakage Audit.
- [ ] Create and complete Phase 8.3 Evaluation Harness and Baselines, including Brier, Calibration/ECE, log loss, sample count, and bookmaker/simple baseline comparison.
- [ ] Create and complete Phase 8.4 Candidate Model Bake-Off before selecting any real model.
- [ ] Create Phase 8.6 Model Selection ADR only after dataset, leakage, baseline, and candidate comparison evidence exists.
- [ ] Defer ONNX/runtime packaging until Phase 8.7 and only after owner-approved model-selection evidence.
