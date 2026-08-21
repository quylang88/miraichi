# Project Plan

## Current State

- **Status**: Active
- **Completed boundary**: Product Reset — owner-only factual match data, manual bets/odds, and bankroll management.
- **Completed phase**: `phase:integration-test Core Bet, Bankroll & Psychology Discipline` — the local large-boundary gate passed on 2026-08-21.
- **Active phase**: `phase:integration-test Core Bet, Bankroll & Psychology Discipline` is closed locally; transition to staging has not been approved or started.
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

## Local Integration Evidence — 2026-08-21

- `pnpm run verify:product-boundary` — passed.
- `pnpm run verify:local` — passed with 83 test files and 409 tests at the recorded gate; lifecycle, syntax, typecheck, audit, and type-safety checks also passed.
- `pnpm run test:integration` — passed after updating the E2E/PWA harness to the approved ongoing-bet, backup V2, settlement, and split-screen contracts.
- `pnpm run build:web-static` — passed and produced the local static artifact.
- Browser QA covered 320×568, 390×844, and desktop in EN and VI. Manual Add Bet remained available independently from match feed state; the exercised flow was discipline threshold → cooldown acknowledgement → ongoing bet → settlement preview/confirmation → bankroll/report update.
- `.playwright-cli/` inspection cache and the temporary `output/playwright/` screenshots were removed after QA; the exercised viewport and workflow evidence is recorded above.
- No staging deployment, production migration, production promotion, crawler extension, OpenFootball extension, or live-context work was performed.

OpenFootball remains the only selected external match source family, but all new provider, crawler, and manual-live-context work is pending during this phase. Existing factual snapshots remain read-only context. Manual bet recording must work without a match feed.

## Later Phases

1. Resume Manual Live Bet Context Snapshot planning only after the current core owner workflow closes and the owner explicitly reactivates it.
2. Integration verification for API/web owner-record flows; OpenFootball integration remains unchanged.
3. Staging deployment and smoke evidence.
4. Final owner feedback and production promotion only after all release gates pass.

All work follows `.agent/skills/miraichi-delivery-lifecycle/SKILL.md`.
