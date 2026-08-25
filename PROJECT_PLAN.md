# Project Plan

## Current State

- **Status**: Active
- **Completed boundary**: Product Reset — owner-only factual match data, manual bets/odds, and bankroll management.
- **Completed phase**: `phase:code-slice API-Football Correctness, Quota Hardening, And Basic Match Detail — Slice 2` — durable daily/per-minute quota reservation, header reconciliation, fail-closed locking, explicit runtime data roots, and quota CLI wiring were completed locally on 2026-08-25.
- **Active phase**: Slice 2 is closed locally; Slice 3 complete-snapshot merge work has not been started.
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
- [x] Implement Smart Window Polling (SLA <= 5 min for FT results) and publication validator.
- [x] Completely eradicate OpenFootball registries, parsers, capture scripts, and fixtures.
- [x] End-to-end integration test proving hydration, daily sync, fast poll, and API serving across 50 leagues.
- [x] Review commits `92e7eca` and `b14bdea`; identify snapshot replacement, non-durable quota, repeated daily sync, season/identity drift, fixed hydration order, unbounded ID batches, and empty match-detail blockers.
- [x] Owner approved a best-effort result SLO <= 5 minutes, terminal-only result/detail publication plus lazy completed-history detail cache, and `club | national-team` registry support. Provider live responses are polling control only and are not persisted or published.
- [x] Write the exact TDD implementation plan at `docs/superpowers/plans/2026-08-25-api-football-correctness-quota-match-detail.md`.
- [x] Complete Slice 1: correct registry type, target-season validation, canonical identity, terminal-only status/score projection, and provider fixture lookup through source refs.
- [x] Complete Slice 2: replace in-memory quota tracking with one durable ledger shared by worker/CLI, reconcile provider headers, and keep generated API-Football runtime state out of Git and test source paths.
- [ ] Execute API-Football correctness and quota-hardening Slices 3–9 in order; do not run a real provider key against the active serving root before local integration passes.
- [ ] Prove complete-snapshot preservation, durable quota across restarts, one daily sync, 20-ID chunking, fair 50/51+ hydration, extended terminal polling, and cached match detail.

## Local Integration Evidence — 2026-08-25

- `pnpm run verify:product-boundary` — passed; OpenFootball paths and legacy AI paths strictly forbidden.
- `pnpm run verify:local` — passed across shared, config, worker, api, and web packages.
- `pnpm run test:integration` — passed covering API-Football multi-season hydration, daily sync, smart window polling, and serving store publication.
- Quota guard protects free tier (100 req/day) with 85 req ceiling and 15 reserve.

The 2026-08-25 commit review invalidated the API-Football-specific conclusions above as release evidence: the commands passed, but their tests did not cover repeated snapshot preservation, process restarts, real due gating, provider header reconciliation, batches above 20 IDs, or non-empty match detail. The evidence remains historical local command output and is not staging approval.

## Later Phases

1. Start `phase:code-slice API-Football Correctness, Quota Hardening, And Basic Match Detail` with Slice 3 from the approved implementation plan.
2. Run a fresh `phase:integration-test` only after all nine slices pass their focused gates.
3. Request staging approval before any live-key smoke or initial historical hydration.
4. Staging deployment and smoke evidence.
5. Final owner feedback and production promotion only after all release gates pass.

All work follows `.agent/skills/miraichi-delivery-lifecycle/SKILL.md`.
