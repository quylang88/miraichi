# Shared Types Design

Common data model interfaces and definitions.

## Purpose
Defines interfaces for Match, Player, Market, Prediction, and Bet Slips.

## Status
- **Status**: Active

## Scope
Governs data modeling and type safety across all apps.

## Key Types
- `Match`: id, competitionId, seasonId, homeTeam, awayTeam, startTime, status.
- `Market`: id, matchId, type (e.g. 1X2, OverUnder), odds, status.
- `Prediction`: id, matchId, predictedOutcome, confidenceScore, modelName.
- `Bet`: id, userId, selection, stake, payout, status.

## TODO / Next Steps
- [ ] Implement TypeScript interface files.
