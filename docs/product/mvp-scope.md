# MVP Scope

Requirements and scope boundaries for the initial release.

## Purpose
Specifies the minimal set of features required to validate the application.

## Status
- **Status**: Draft

## Scope
Defines the functional limits of the first deployable version.

## MVP Features
- Four working non-AI tabs: `Today`, `Matches`, `Bets`, and `Bankroll`.
- Local/manual national-team match data API for finished and scheduled fixtures.
- World Cup 2026 first, then Euro latest/past backfill.
- Cloud persistence for user-owned app data after an owner-approved provider ADR.
- User bankroll/capital tracking board as manual ledger records only.
- `Miraichi AI` tab disabled or honest-unavailable until the final AI phase.

## Deferred From MVP
- API-Football free-tier usage.
- Live polling.
- Odds ingestion.
- Local AI match outcome prediction runner.
- Betting recommendations.
- Stake sizing, Kelly, ROI, CLV, yield, or automated bankroll/risk calculations.

## TODO / Next Steps
- [ ] Create Phase 9 implementation plan for API-Football removal and local data API.
- [ ] Approve cloud database provider ADR before persistence implementation.
