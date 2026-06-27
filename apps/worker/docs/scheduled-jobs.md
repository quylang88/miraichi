# Scheduled Jobs Registry

Planned cron jobs, trigger schedules, and batch definitions.

## Purpose
Visualizes background intervals for feeds fetching, audit compilation, and database cleanup.

## Status
- **Status**: Active

## Scope
Schedules, intervals, execution times, and target task names in apps/worker.

## Planned Schedules
- **Match Odds Sync**: Run every 30 minutes to fetch latest odds.
- **Fixture Update**: Run every 6 hours to fetch new matches.
- **Bankroll Audit**: Run daily at 00:00 UTC to verify account balances and risks.
- **Model Recalibration trigger**: Run weekly on Tuesday at 02:00 UTC.

## TODO / Next Steps
- [ ] Implement local cron runner configurations.
- [ ] Connect scheduled jobs with error notification reporting.
