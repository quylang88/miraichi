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
8. As of 2026-07-01, API-Football free-tier usage is removed from the active roadmap. Existing API-Football code and plans are legacy debt to remove during the next non-AI app completion phase, not a valid future dependency.

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

### Phase 8: Historical Model Training and Prediction Engine R&D
- **Goal**: Research and prototype owner-only, free-tier model training approaches through World Cup and national-team competition datasets first, then leakage-safe feature specs, chronological evaluation, and model comparison reports before any real inference runtime is selected. Club competitions are expansion scope after the national-team-first path is reviewed.
- **Deliverables**: Phase 8 owner-only R&D subphase plan, World Cup/national-team dataset snapshot and provenance plan, feature spec and leakage audit plan, evaluation harness and baseline reports, candidate model bake-off report, owner-approved model-selection ADR, and optional runtime packaging plan only if evidence justifies it.
- **Status**: Paused/Superseded as the active phase on 2026-07-01. Phase 8 evidence remains historical R&D, but AI training/runtime work is no longer the next priority.

### Phase 9: Non-AI App Completion, Local Data API, Cloud Persistence, and Release Readiness
- **Goal**: Urgently make the app usable across the four non-AI tabs (`Today`, `Matches`, `Bets`, `Bankroll`) before returning to Miraichi AI. Match data must come from an owner-controlled local/manual snapshot pipeline, not API-Football free tier. Bankroll/capital workflows and cloud database persistence must work smoothly without approving prediction, stake sizing, Kelly, ROI, CLV, or automated betting advice.
- **Deliverables**: API-Football removal plan and code slices, local finished/scheduled match data API, national-team-first manual update workflow, World Cup 2026 first data coverage, Euro latest/past backfill path, cloud database provider ADR, cloud persistence implementation plan, four-tab app completion implementation slices, local/integration/staging verification evidence, and a disabled or honest unavailable state for `Miraichi AI`.
- **Status**: Active.

### Phase 10: Final Miraichi AI Training and Runtime
- **Goal**: Resume national-team-first model training only after Phase 9 has delivered a working non-AI app with cloud persistence and verified local/manual match data. This phase may revisit Phase 8 R&D evidence, improve datasets, run model training, and decide whether a runtime prediction surface is justified.
- **Deliverables**: Updated dataset evidence, leakage audit, evaluation harness, model-selection ADR update, training run reports, runtime packaging plan if approved, `Miraichi AI` tab integration, and final release gating.
- **Status**: Deferred. Do not start until Phase 9 passes staging and the owner explicitly approves returning to AI training.

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
- [x] Owner review Phase 8.0 R&D boundary split before Phase 8.1 implementation planning.
  - **Result**: Owner confirmed the Phase 8 subphase drift and approved returning to the Phase 8.0 boundary check. Phase 8 remains owner-only R&D: no public prediction surface, no production model mode, no betting recommendation, no model artifact promotion, and national-team competitions remain before club expansion.
- [x] Create `phase:implementation-plan Phase 8.1 Dataset Snapshot and Provenance`.
- [x] Complete Phase 8.1 reproducible offline dataset snapshot and data quality report.
- [x] Review and correct Phase 8.1 to make World Cup/national-team competitions the explicit first data target before Phase 8.2.
- [x] Create `phase:implementation-plan Phase 8.2 Feature Spec and Leakage Audit`.
- [x] Complete Phase 8.2 Feature Spec and Leakage Audit.
- [x] Create `phase:implementation-plan Phase 8.3 Evaluation Harness and Baselines`.
- [x] Complete Phase 8.3 Evaluation Harness and Baselines, using pure TypeScript metric functions in `apps/local-ai` for Brier, Calibration/ECE, and log loss, reporting sample count and bookmaker/simple baseline comparison without blocking harness construction on additional national-team competitions.
- [x] Create `phase:implementation-plan Phase 8.3A National-Team Dataset Expansion`.
- [x] Complete Phase 8.3A National-Team Dataset Expansion before Phase 8.4, with provider-confirmed national-team competitions and aggregate evaluation readiness evidence.
- [x] Create `phase:implementation-plan Phase 8.4 Candidate Model Bake-Off`.
- [x] Complete Phase 8.4 Candidate Model Bake-Off before selecting any real model.
  - **Result**: Candidate comparison report generated for the aggregate World Cup + Euro national-team dataset. No model selected.
  - **Blocker**: Lifted (Phase 8.3A completed with World Cup and Euro datasets, total test sample count = 107). Club/Premier League expansion remains blocked.
  - **Constraints**: Do not treat high-variance Phase 8.4 outcomes as model-selection evidence due to sample size limits and missing bookmaker baseline. Do not create runtime prediction routes, model artifacts, betting recommendations, or club competition support.
- [x] Create `phase:implementation-plan Phase 8.5 Owner-Only Experimental Report Surface`.
- [x] Complete Phase 8.5 Owner-Only Experimental Report Surface before Phase 8.6 Model Selection ADR.
  - **Result**: Owner-only experimental JSON/Markdown report surface generated from Phase 8.4 evidence. No model selected and no runtime prediction surface created.
  - **Constraints**: The report surface remains owner-only and experimental. It does not expose public predictions, `engineMode: production`, recommendation labels, stake advice, bankroll advice, ROI, CLV, Kelly logic, or club competition expansion.
- [x] Create Phase 8.6 Model Selection ADR only after dataset, leakage, baseline, and candidate comparison evidence exists.
  - **Result**: Owner approved ADR-0041 on 2026-06-29, confirming the decision to select no model yet.
- [x] Phase 8.6A: National-Team Dataset Expansion for Model Selection Evidence.
  - **Goal**: Expand World Cup and Euro history to increase out-of-sample test count and check for bookmaker odds/implied probability baselines, then rerun the model R&D pipeline.
  - **Result**: Narrow expansion completed for World Cup + Euro, increasing scored aggregate test count to 214. Candidate bake-off still selected no model.
  - **Limitation**: Bookmaker baseline remains unavailable, and Phase 8.6A provider discovery was too narrow because it only proved AFCON/Copa America/AFC Asian Cup/CONCACAF Gold Cup unavailable through the current FBref path, not through Sofascore direct tournament ids.
- [x] Create `phase:plan Phase 8.6B Sofascore National-Team Source Discovery and Odds Baseline Discovery`.
  - **Result**: Draft design spec created to investigate Sofascore direct tournament-id discovery for AFCON, Copa America, AFC Asian Cup, CONCACAF Gold Cup, UEFA Nations League, World Cup, and Euro, plus a separate odds/bookmaker source discovery.
  - **Constraints**: Do not merge Sofascore fixtures into the main training dataset, do not fake bookmaker baselines, do not add API keys/secrets/paid providers, do not add club competitions, and do not revisit model selection before Phase 8.6B evidence exists.
- [x] Create `phase:implementation-plan Phase 8.6B Sofascore National-Team Source Discovery and Odds Baseline Discovery`.
  - **Result**: Implementation plan created with TDD slices for the Sofascore discovery registry, quality gates, odds baseline source matrix, phase verifier, generated artifacts, and closeout evidence.
  - **Next**: Start with `phase:code-slice Phase 8.6B Sofascore Discovery Registry And Validation`.
- [x] Complete Phase 8.6B Sofascore National-Team Source Discovery and Odds Baseline Discovery.
  - **Result**: Sofascore direct tournament-id discovery report generated for World Cup, Euro, AFCON, Copa America, AFC Asian Cup, CONCACAF Gold Cup, and UEFA Nations League.
  - **Evidence**: See `apps/local-ai/reports/phase-8-6b-sofascore-national-team-source-discovery.json`, `apps/local-ai/reports/phase-8-6b-odds-baseline-source-discovery.json`, and `docs/data/PHASE-8-6B-SOFASCORE-NATIONAL-TEAM-SOURCE-DISCOVERY.md`.
- [x] Create `phase:plan Phase 8.6C National-Team Sofascore Dataset Ingestion`.
  - **Result**: Proposed design spec created to ingest historical match events and scores from Sofascore for 7 tournaments, updating `competition-registry.json` splits, and rebuilding offline training/validation splits without odds.
- [x] Complete Phase 8.6C National-Team Sofascore Dataset Ingestion.
  - **Result**: Historical fixture schedules and scores ingested from Sofascore for 7 tournaments, expanding offline dataset to 1,962 matches.
  - **Evidence**: Combined split counts: 1,044 train, 570 validation, and 348 test fixtures. See updated processed JSONL splits under `apps/local-ai/data/processed/`.
  - **Constraint**: Bookmaker baseline remains blocked/unavailable.
- [x] Create `phase:implementation-plan Phase 8.6E API-Football Owner-Only App Live Data`.
  - **Result**: Proposed design spec and implementation plan created to replace visible hardcoded app match feed data with backend-mediated API-Football fixture data, plus cache/quota guard and honest unavailable states.
  - **Evidence**: See `docs/superpowers/specs/2026-06-29-phase-8-6e-api-football-owner-only-app-live-data-design.md` and `docs/superpowers/plans/2026-06-29-phase-8-6e-api-football-owner-only-app-live-data.md`.
  - **Constraints**: No odds, no prediction runtime, no betting recommendation, no provider key in browser code, no public traffic, and no raw CSV ingestion changes in this phase.
- [x] Complete Phase 8.6E API-Football Owner-Only App Live Data.
  - **Result**: `/api/v1/matches` uses backend-mediated API-Football fixture normalization and the web shell renders provider-backed match feed states.
  - **Evidence**: Focused API/web tests, typecheck, lifecycle verification, and `git diff --check` passed. Manual provider smoke requires a local `API_FOOTBALL_KEY` and must not record or expose the key.
  - **Constraint**: Odds, prediction runtime, betting recommendation, public traffic, and raw CSV append-only merge remain out of scope.
- [x] Create `phase:plan Phase 8.6F API-Football National-Team JSONL Snapshot Store`.
  - **Result**: Proposed design spec created for a raw-first, SQL-shaped local JSONL snapshot store for API-Football national-team fixture payloads.
  - **Scope**: National-team competitions only, in owner-approved priority order: World Cup, Euro, Copa America, AFCON, AFC Asian Cup, CONCACAF Gold Cup, and UEFA Nations League.
  - **Constraint**: World Cup 2026 is included first, but only terminal/completed fixtures may be snapshotted while the tournament is active. No live polling, odds, prediction runtime, betting recommendation, club competitions, all-league crawl, or production database schema.
- [x] Create `phase:implementation-plan Phase 8.6F API-Football National-Team JSONL Snapshot Store`.
  - **Result**: Implementation plan created with TDD slices for snapshot schemas, national-team priority queue, provider mapping gates, JSONL storage, raw API-Football client, snapshot runner, CLI/verifier, and closeout evidence.
  - **Plan**: See `docs/superpowers/plans/2026-06-30-phase-8-6f-api-football-national-team-jsonl-snapshot-store.md`.
  - **Next**: Start with `phase:code-slice Phase 8.6F Snapshot Schema And ID Utilities`.
- [x] Pause Phase 8 AI/model-training work as the active roadmap priority on 2026-07-01.
  - **Reason**: The non-AI app is not complete enough to justify spending the next phase on training/runtime work.
  - **Constraint**: Phase 8 R&D artifacts remain historical evidence only. They do not authorize production predictions, the `Miraichi AI` tab, stake advice, bankroll advice, or model runtime routes.
- [x] Supersede the Phase 8.6F API-Football National-Team JSONL Snapshot Store before code-slice execution.
  - **Reason**: Owner explicitly rejected the API-Football free-tier path on 2026-07-01.
  - **Replacement**: Use Phase 9 local/manual data ingestion and a replaceable source registry.
- [x] Create ADR-0042 to remove API-Football free-tier usage and select a local/manual snapshot API strategy.
- [x] Create `phase:plan Phase 9 Non-AI App Completion, Local Data API, Cloud Persistence, and Release Readiness`.
  - **Plan**: See `docs/product/PHASE-9-NON-AI-APP-COMPLETION-LOCAL-DATA-API-PLAN.md`.
- [x] Create `phase:implementation-plan Phase 9 API-Football Removal and Local Data API`.
  - **Plan**: See `docs/superpowers/plans/2026-07-01-phase-9-api-football-removal-local-data-api.md`.
- [x] Complete `phase:code-slice Phase 9 API-Football removal from API routes, web tests, environment assumptions, and endpoint smoke checks`.
- [x] Complete `phase:code-slice Phase 9 local/manual national-team match snapshot store`.
- [x] Complete `phase:code-slice Phase 9 local data API for finished and scheduled fixtures`.
- [x] Complete `phase:code-slice Phase 9 manual daily update command for World Cup 2026 first, then Euro latest/past backfill`.
- [x] Complete `phase:code-slice Phase 9 Local Data API Closeout Fixes - integration verifier, idempotent verification, UI copy, and snapshot status contract`.
  - **Evidence**: Focused closeout tests, `pnpm run phase9:local-data-api-verify`, `pnpm run verify:local`, and `pnpm run test:integration` passed on 2026-07-02.
- [x] Run `phase:integration-test Phase 9 API-Football Removal and Local Data API`.
  - **Result**: The local data API boundary passed integration. This does not close Phase 9 Non-AI App Completion, because cloud persistence and the four non-AI tab workflows remain pending.
- [x] Create owner-approved cloud database provider ADR before implementing production cloud persistence.
  - **Decision**: ADR-0043 accepted on 2026-07-02. Supabase hosted Postgres is the Phase 9 cloud persistence provider.
  - **Boundary**: `apps/web -> apps/api -> Supabase Postgres`; no direct browser Supabase client, no browser secrets, owner-only persistence, no public auth in this phase.
  - **ADR**: See `docs/decisions/ADR-0043-phase-9-cloud-database-provider.md`.
- [x] Create `phase:implementation-plan Phase 9 Cloud Persistence for four non-AI tabs`.
  - **Plan**: See `docs/superpowers/plans/2026-07-02-phase-9-cloud-persistence-four-non-ai-tabs.md`.
  - **Scope**: Server-only Supabase Postgres adapter, private schema, manual snapshot cloud sync/fallback, durable Bets and Bankroll workflows, backup/import/export, and non-AI closeout verification.
  - **Next**: Start `phase:code-slice Phase 9 Cloud Persistence Contracts and Server-Only Configuration`.
- [ ] Complete `Today` and `Matches` tab flows against the local/cloud match API with loading, empty, stale-data, and unavailable states.
- [ ] Complete `Bets` tab real draft/history workflows without automated betting, ROI, CLV, Kelly, or stake recommendation logic.
- [ ] Complete `Bankroll` capital-management workflows as owner-entered ledger/account records only, with no automated risk or stake allocation formulas.
- [ ] Run `phase:integration-test Phase 9 Non-AI App Completion` only after the four non-AI tabs and persistence boundary are feature-complete.
- [ ] Run `phase:staging Phase 9 Non-AI App Completion` and record smoke evidence.
- [ ] Keep `Miraichi AI` disabled or honest-unavailable until Phase 10.
- [ ] Start Phase 10 AI training/runtime only after Phase 9 staging passes and the owner explicitly approves returning to AI.
