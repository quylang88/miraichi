# Project Plan

## Current State

- **Status**: Active
- **Completed boundary**: Product Reset — owner-only factual match data, manual bets/odds, and bankroll management.
- **Completed phase**: `phase:integration-test API-Football Correctness, Quota Hardening, And Basic Match Detail` — Slice 9 and the local large-boundary gates passed on 2026-08-26, covering multi-season resume, durable quota, due batching, terminal detail, API serving, endpoint E2E, and PWA verification.
- **Active phase**: `phase:staging API-Football contained live-key smoke` started with explicit owner approval on 2026-08-26. Release/build gates passed, but staging is blocked by provider season entitlement and missing deploy/runtime API configuration.
- **Promotion state**: staging is started but not passed; owner feedback and production are not started or approved.
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

The local integration evidence proves the corrected API-Football boundary locally. It does not prove current-season provider entitlement or a working deployed staging API.

## Staging Evidence — 2026-08-26

- Owner authorized exactly one API-Football request against isolated root `.cache/api-football-smoke`; no active-root hydration or production promotion was authorized.
- `pnpm run verify:staging` passed locally, including 93 unit-test files / 600 tests, API-Football integration, endpoint E2E, PWA verification, and static build.
- `pnpm run build:web-static` passed and generated `apps/web/dist`.
- The single request targeted Premier League league 39, registry current season 2026. The provider rejected it with `Free plans do not have access to this season, try from 2022 to 2024.`
- Isolated ledger evidence is exactly 1 reserved / 1 confirmed request. The failed checkpoint is durable; no warehouse run, serving version, or serving manifest was published.
- Public alias `https://miraichi-staging.pages.dev` is reachable, but it is an older static deployment. The strengthened smoke correctly fails because the root lacks the current import map/runtime environment and Pages fallback HTML is returned for current client modules.
- Local `.env` has no `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, or `STAGING_URL`; `API_URL` is local-only. This machine cannot redeploy a functional web/API staging pair yet.
- The seed CLI now returns a non-zero process code when any target fails. The staging smoke rejects stale SPA fallback responses and local-only API configuration, then requires the configured staging API `/api/v1/health` route to return factual JSON health.

## Later Phases

1. Choose provider scope honestly: keep Free plan for historical 2022-2024 only, or obtain a plan with current-season access before enabling current fixtures/results.
2. Do not make another provider request under the completed one-request approval. If retaining Free plan, authorize a later one-request smoke using explicit season 2024 after quota/approval review.
3. Configure a remotely reachable staging API URL plus Cloudflare credentials, rebuild, deploy the current Pages artifact, and pass the strengthened staging smoke.
4. Final owner feedback and production promotion only after all release and staging gates pass.

All work follows `.agent/skills/miraichi-delivery-lifecycle/SKILL.md`.
