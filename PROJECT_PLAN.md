# Project Plan

## Current State

- **Status**: Active
- **Completed boundary**: Product Reset — owner-only factual match data, manual bets/odds, and bankroll management.
- **Active phase**: Website Source Selection And Crawler Boundary — A+ approved; written-spec review pending.
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

## Next Phase

- [x] Compare GitHub community sources, access boundaries, coverage, freshness, and maintenance risk.
- [x] Owner selected A+: OpenFootball non-live match data plus manual live-bet context snapshots.
- [x] Record the source decision in ADR-0045 and split the two implementation tracks into separate specs.
- [ ] Owner reviews the committed written specs and closes `phase:plan Website Source Selection And Crawler Boundary`.

OpenFootball is the only selected external match source family. It provides periodic fixture/result data, not live data or odds. Live score, minute, period, line, odds, and corner context at bet placement are owner-entered and immutable.

## Later Phases

1. `phase:implementation-plan OpenFootball Match Source` for allowlist, fetch, raw cache, Football.TXT parsing, normalization, and atomic serving publication.
2. TDD code slices for the OpenFootball source plan.
3. `phase:implementation-plan Manual Live Bet Context Snapshot` for shared contracts, drafts, API, persistence, backup, and UI.
4. TDD code slices for the manual live-bet context plan.
5. Integration verification for worker/API/web and owner-record flows.
6. Staging deployment and smoke evidence.
7. Final owner feedback and production promotion only after all release gates pass.

All work follows `.agent/skills/miraichi-delivery-lifecycle/SKILL.md`.
