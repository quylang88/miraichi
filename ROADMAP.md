# Roadmap

Milestones and timeline for the development of Miraichi.

## Purpose
This document provides visibility into planned feature rollouts and releases.

## Status
- **Status**: Active

## Scope
Outlines high-level roadmap milestones across multiple phases.

## Roadmap Guidelines
- All milestones must follow the architectural patterns laid out in ARCHITECTURE.md.
- Ensure competition-agnostic support is built into every feature.

## Milestones

### Milestone 1: Monorepo Foundation & Docs
- Complete directory bootstrapping.
- Define agent roles and protocol interfaces.
- Create initial architecture and deployment planning drafts.

### Milestone 2: Phase 1 Architecture Planning (Completed)
- Explore open architecture questions.
- Compare candidate architecture options.
- Draft system boundaries, data flow, and LLM/local AI responsibilities.
- Review competition-agnostic risks before implementation.

### Milestone 3: Skeletal Connectivity & Scaffold (Completed)
- Define app boundaries, package boundaries, mock contracts, and exit criteria.
- Establish basic API, Web, Worker, and local-ai connectivity.
- Verify communication paths via mock endpoints.

### Milestone 4: Sports Data Ingestion Planning (Completed)
- Establish provider-agnostic parser interfaces and mock feed adapters.
- Define data quality rules and generic schema validation contracts.
- Implement mock-only ingestion processing in apps/worker (database storage deferred).

### Milestone 5: Predictive Inference, Agent Handoffs & PWA Client (Completed)
- Integrate local AI mock model predictions and mediation proxies.
- Establish PWA shell caching and mobile-first responsive layout.
- Run basic agent coordination scenarios.

### Milestone 6: Betting Accounts & Bankroll Strategy Planning (Completed)
- Establish specifications for simulated wagers, history, reports, and limits.
- Formulate adapter contracts for owner-controlled betting logic.
- Accept Phase 5.2 Wave A foundation ADRs and ADR-0034 as architecture/planning boundaries only.
- Start Phase 5.3 Wave A Implementation Planning without starting implementation.
- Complete Phase 5.4 TypeScript tooling setup for future typed contracts.
- Complete Phase 5.5 Typed Shared Domain Contracts as type-only shared boundaries.
- Complete Phase 5.6 Market Catalog and Line Preset Config as static typechecked config.
- Complete Phase 5.7A Black Apple Ledger PWA UI preview as an adjustable production baseline direction.
- Defer Phase 5.7B production UI implementation until separately approved.
- Plan future app settings and language/i18n support, including English and Vietnamese (Phase 5.8).
- Complete Phase 5.9 Production PWA Shell Implementation using TypeScript-first shell modules and production-baseline Black Apple Ledger structure.
- Complete document status hygiene before Phase 5.10.
- Complete owner-approved Phase 5.10 Add Bet Draft/Form State + Persistence Planning.
- Complete Phase 5.11 Local-First Add Bet Draft Persistence code slices for shared contracts, form state, memory persistence, IndexedDB persistence, and versioned draft backup/import helpers.
- Complete Phase 5.12 owner-requested UI/UX quality-up, staging redeploy, and Phase 5 closeout.

### Milestone 7: Testing/Deployment Hardening (Completed)
- Plan CI/CD workflow hardening and staging deployment automation.
- Plan security and secrets checks without committing credentials.
- Draft repeatable smoke-check automation, rollback notes, and monitoring plans.
- Complete the owner-approved repo-wide JavaScript-to-TypeScript source migration while preserving browser `.js` compatibility URLs.
- Harden TypeScript strictness so future source code cannot regress to explicit `any`, tracked `.js` source, or TypeScript suppression comments.
- Keep production promotion blocked until final-release owner approval.

### Milestone 8: Real Data Provider, Dataset, and Evaluation Planning (Completed)
- Plan real data provider selection and dataset boundaries.
- Use full FIFA World Cup fixture coverage as the first provider target while keeping the ingestion adapter competition-agnostic.
- Define model evaluation criteria before any real training.
- Accept ADR-0035 through ADR-0040 as Phase 7 planning boundaries only.

### Milestone 9: Model Training and Prediction Engine R&D (Active)
- Split Phase 8 into owner-only R&D subphases before training implementation.
- Build reproducible offline datasets, leakage-safe feature specs, chronological evaluation, and baseline reports before selecting any model.
- Compare simple baselines, Elo/Poisson-style models, calibrated logistic regression, LightGBM, CatBoost, and XGBoost before model selection.
- Draft a model-selection ADR before any runtime packaging such as ONNX.
- Keep betting recommendation and stake advice separate from prediction model R&D.

## TODO / Next Steps
- [x] Complete Phase 1 architecture planning milestones.
- [x] Align on specific target dates for Milestones 3 through 5.
- [x] Complete Phase 2 app skeleton planning and scaffolding.
- [x] Begin Phase 3 data ingestion planning.
- [x] Approve Phase 3 candidate ADRs.
- [x] Build parser stubs and mock ingestion worker flow.
- [x] Open Phase 4 planning and draft candidate ADRs.
- [x] Review Phase 4 candidate ADRs (ADR-0017 to ADR-0021).
- [x] Implement Phase 4 local-ai mock inference endpoints and client proxy.
- [x] Align client app as PWA-first and defer native iOS.
- [x] Begin Phase 5 planning for betting rules, history tracking, and risk limits.
- [x] Draft Phase 5.2 Wave A ADRs (ADR-0023, 0024, 0025, 0026, 0031, 0033).
- [x] Accept Phase 5.2 Wave A foundation ADRs and ADR-0034.
- [x] Begin Phase 5.3 Wave A Implementation Planning without starting implementation.
- [x] Complete Phase 5.4 TypeScript tooling setup execution.
- [x] Complete Phase 5.5 Typed Shared Domain Contracts execution.
- [x] Complete Phase 5.6 Market Catalog and Line Preset Config execution.
- [x] Complete Phase 5.7A Black Apple Ledger PWA UI preview as a provisional preview baseline only (adjustable).
- [x] Defer Phase 5.7B PWA Navigation Shell and Forms implementation until the owner explicitly approves a production UI implementation plan.
- [x] Plan App Settings and Language/i18n, including English and Vietnamese support plus additional owner-requested app settings (Phase 5.8).
- [x] Complete Phase 5.9 Production PWA Shell Implementation using TypeScript-first shell modules and production-baseline Black Apple Ledger structure.
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
- [x] Keep real AI training out of Phase 6; reserve it for future Phase 7 and Phase 8 planning.
- [x] Open Phase 7 planning and draft candidate ADRs.
- [x] Split Phase 7 ADR candidates into standalone draft ADR files and record draft review.
- [x] Accept ADR-0036, ADR-0037, ADR-0038, and ADR-0039 as Phase 7 planning boundaries only.
- [x] Complete owner review for ADR-0035 provider strategy, starting with owner-only free-tier usage.
- [x] Complete owner review for ADR-0040 model-readiness gates before Phase 8 model R&D.
- [x] Complete Phase 7 after owner-approved ADRs exist.
- [x] Create Phase 8 Owner-Only Model R&D plan and split Phase 8 into smaller gated subphases.
- [ ] Owner review Phase 8.0 R&D boundary split before Phase 8.1 implementation planning.
