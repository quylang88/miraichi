# Project Plan

## Current State

- **Status**: Active
- **Completed boundary**: Product Reset — owner-only factual match data, manual bets/odds, and bankroll management.
- **Completed phase**: `phase:integration-test API-Football Correctness, Quota Hardening, And Basic Match Detail` — Slice 9 and the local large-boundary gates passed on 2026-08-26, covering multi-season resume, durable quota, due batching, terminal detail, API serving, endpoint E2E, and PWA verification.
- **Active phase**: Local integration is closed; `phase:staging` and its one-request contained live-key smoke are blocked until explicit owner approval.
- **Promotion state**: staging, owner feedback, and production are not started or approved.
- **Current lifecycle source of truth**: this file.

## Product Boundary

Miraichi has exactly four primary tabs: `Today`, `Matches`, `Bets`, and `Bankroll`.

The application may store and display factual fixtures, schedules, results, statuses, teams, competitions, events, lineups, and odds. Bet records, odds, stake points, settlements, notes, and bankroll ledger entries are entered or managed by the owner. The product does not generate picks, confidence scores, expected goals, stake recommendations, or automated betting calculations.

Competitions are configured through an allowlist and may be either `club` or `national-team`. Neither type has priority in core code.

## Completed Work

- [x] Preserve Git history while removing the superseded runtime and generated data.
- [x] Keep the production web shell owner-only with four primary tabs.
- [x] Retain factual match contracts, serving-store projection, API routes, manual bet records, bankroll ledger, backups, and Supabase persistence.
- [x] Make match and serving contracts provider-neutral and competition-agnostic.
- [x] Add `verify:product-boundary` so removed runtime paths, commands, routes, and navigation cannot silently return.
- [x] Complete local code and documentation reset under ADR-0044.

## Active Work

- [x] Compare GitHub community sources, access boundaries, coverage, freshness, and maintenance risk.
- [x] Owner selected A+: OpenFootball non-live match data plus manual live-bet context snapshots.
- [x] Record the source decision in ADR-0045 and split the two implementation tracks into separate specs.
- [x] Owner reviewed the committed written specs and closed `phase:plan Website Source Selection And Crawler Boundary`.
- [x] Write the TDD implementation plan for the OpenFootball match source.
- [x] Owner selected Subagent-Driven Execution for the OpenFootball code slices.
- [x] Complete the OpenFootball TDD code slices and prove club plus national-team raw-to-serving publication with last-good preservation.
- [x] Pause OpenFootball follow-up and Manual Live Bet Context Snapshot work without removing their completed contracts or history.
- [x] Reject and replace the incomplete core bet/bankroll/psychology plan from commit `598ba33`.
- [x] Record the owner-approved settlement, discipline, bankroll, reporting, UI, and i18n boundary in ADR-0046.
- [x] Write the exact TDD implementation plan for Core Bet, Bankroll & Psychology Discipline.
- [x] Implement the shared contracts, versioned migration, backup V2 compatibility, and persistence transaction boundary.
- [x] Implement discipline challenges, manual bet recording, settlement/correction, bankroll summary, and weekly/monthly reports.
- [x] Complete the web screens in order: Bets, Bankroll, Today, Matches while preserving the Black Apple/OLED baseline.
- [x] Split EN/VI into parity-tested JSON catalogs and remove raw domain enum labels from the owner workflow.
- [x] Prove responsive layout, core owner-flow integration, product boundaries, and all local large-boundary gates.
- [x] Accept ADR-0047 superseding ADR-0045: Integrate API-Football as single competition-agnostic match provider.
- [x] Create extensible 50-competition registry in `packages/config` with zero hardcoded tournament biases.
- [x] Implement API-Football client with Daily Quota Guard (85 req/day ceiling + 15 reserve).
- [x] Implement multi-season historical hydration job with idempotent checkpoint resume.
- [x] Implement the initial Smart Window Polling boundary, later corrected to the owner-approved best-effort SLO <= 5 minutes with quota/coverage deferrals.
- [x] Completely eradicate OpenFootball registries, parsers, capture scripts, and fixtures.
- [x] End-to-end integration test proving hydration, daily sync, fast poll, and API serving across 50 leagues.
- [x] Review commits `92e7eca` and `b14bdea`; identify snapshot replacement, non-durable quota, repeated daily sync, season/identity drift, fixed hydration order, unbounded ID batches, and empty match-detail blockers.
- [x] Owner approved a best-effort result SLO <= 5 minutes, terminal-only result/detail publication plus lazy completed-history detail cache, and `club | national-team` registry support. Provider live responses are polling control only and are not persisted or published.
- [x] Write the exact TDD implementation plan at `docs/superpowers/plans/2026-08-25-api-football-correctness-quota-match-detail.md`.
- [x] Complete Slice 1: correct registry type, target-season validation, canonical identity, terminal-only status/score projection, and provider fixture lookup through source refs.
- [x] Complete Slice 2: replace in-memory quota tracking with one durable ledger shared by worker/CLI, reconcile provider headers, and keep generated API-Football runtime state out of Git and test source paths.
- [x] Complete Slice 3: merge complete warehouse snapshots, enforce monotonic terminal status, fail-closed checkpoints, and publish before checkpointing under an exclusive publication job lease.
- [x] Complete Slice 4: hydrate all 50 competitions fairly by season layer, auto-resume 51st+ additions from checkpoints, and strictly validate the historical seed CLI.
- [x] Complete Slice 5: normalize and atomically cache provider-neutral factual match details with terminal events and two-team basic statistics.
- [x] Complete Slice 6: enforce one owner-local daily sync, provider-timezone requests, durable next-due result polling, 20-ID chunks, and terminal-only public-store mutation.
- [x] Complete Slice 7: queue only completed historical cache misses, lazily refresh detail in 20-ID provider batches, and terminally cache explicit coverage warnings.
- [x] Complete Slice 8: render basic factual match detail context, score breakdown, events timeline, team statistics, unavailable/pending states, and EN/VI catalogs without betting advice.
- [x] Complete Slice 9: prove the corrected large boundary through integration tests, documentation closeout, and local lifecycle verification.
- [x] Prove complete-snapshot preservation, durable quota across restarts, one daily sync, 20-ID chunking, fair 50/51+ hydration, extended terminal polling, and cached match detail.

## Local Integration Evidence — 2026-08-26

- `pnpm run api-football:verify` — passed across 12 test files, 130 tests covering registry, adapter, client, checkpoints, leases, ledger, schedule planner, hydration, snapshot merge, ingestion, and match detail jobs.
- `pnpm run api-football:integration` — passed all 9 tests across 3 integration suites:
  - `tests/integration/api-football-rapid-match-source.test.ts` (multi-season hydration, daily sync, window poll, club + national-team).
  - `tests/integration/api-football-quota-resume.test.ts` (multi-season checkpoint resume across process restarts, durable quota ceiling, 20-ID chunking, rolling rate limiter pacing).
  - `tests/integration/api-football-match-detail.test.ts` (202 pending -> worker refresh -> 200 cached detail, provider credential/fixture ID leak prevention, scheduled non-enqueueing).
- `pnpm run verify:product-boundary` — passed; four primary tabs strictly maintained, zero betting advice or AI paths.
- `pnpm run verify:local` — passed across all 93 test files (596 tests), syntax linting, TypeScript base typecheck, audit rules, and type safety audits.
- `pnpm run test:integration` — passed across phase3 verify, api-football integration, test endpoints E2E, and PWA verify.
- `git diff --check` — passed with 0 whitespace issues.

The local integration evidence proves the corrected API-Football boundary locally. Live provider key and staging deployment remain subject to owner authorization.

## Later Phases

1. Owner explicitly approves `phase:staging API-Football contained live-key smoke` and the single provider request against the isolated `.cache/api-football-smoke` root.
2. Run the contained smoke, record quota/serving evidence, then run staging build/deployment/smoke gates.
3. Final owner feedback and production promotion only after all release gates pass.

All work follows `.agent/skills/miraichi-delivery-lifecycle/SKILL.md`.
