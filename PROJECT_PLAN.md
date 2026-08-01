# Project Plan

## Current State

- **Status**: Active
- **Completed boundary**: Product Reset — owner-only factual match data, manual bets/odds, and bankroll management.
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

- [ ] `phase:plan Website Source Selection And Crawler Boundary`

This phase must compare candidate public websites, access terms, stability, rate limits, factual field coverage, and operational risk. It must produce a new source ADR before crawler implementation. No source is currently selected or implied.

## Later Phases

1. `phase:implementation-plan` for the approved crawler adapter and normalized ingestion flow.
2. TDD code slices for crawler, cache, normalization, allowlist filtering, and serving-store publication.
3. Integration verification for worker/API/web data flow.
4. Staging deployment and smoke evidence.
5. Final owner feedback and production promotion only after all release gates pass.

All work follows `.agent/skills/miraichi-delivery-lifecycle/SKILL.md`.
