# Miraichi

Miraichi is an owner-only web application for factual football match data, manual bet/odds records, and bankroll management.

## Current Product

- `Today`: daily factual match context.
- `Matches`: browse configured club and national-team competitions, toggle LIVE, and open factual
  match detail. Information refreshes only the selected match on an explicit user action.
- `Bets`: create and manage manual drafts and bet records.
- `Bankroll`: manage point accounts, ledger entries, and backups.

The Frankfurt staging app uses the existing approved FotMob, SportScore widget and OpenFootball
source boundaries. Hosted refresh reads and publishes canonical data in PostgreSQL; match detail
uses a separate durable cache. Missing or conflicting provider detail remains unavailable. Source
decisions and current phase evidence are recorded in `PROJECT_PLAN.md` and the ADR index.

## Architecture

```text
browser -> Cloudflare Worker (static app + owner gateway)
        -> Supabase Edge API -> private PostgreSQL canonical data / detail cache / owner records

approved providers -> bounded hosted refresh and explicit per-match detail
owner-local hydration -> provider-neutral warehouse -> serving store / approved cloud sync
```

Provider requests stay behind the API. Match detail has no cron, polling, prefetch or focus refresh.
Production and historical-season hydration require separate owner decisions.

## Commands

```bash
pnpm install
pnpm run dev:web
pnpm run dev:api
pnpm run verify:product-boundary
pnpm run verify:local
pnpm run test:integration
pnpm run verify:staging
pnpm run detail:local-browser-smoke
pnpm run detail:local-sql-smoke
pnpm run verify:staging:hosted
```

Generic data projection commands:

```bash
pnpm run data:build:serving:matches
pnpm run data:validate:serving:matches
pnpm run data:sync:serving:cloud
```

See `PROJECT_PLAN.md` for the active phase and `ARCHITECTURE.md` for boundaries.
See [the hosting runbook](docs/operations/SUPABASE-EDGE-CLOUDFLARE-OWNER-HOSTING.md) for the exact
Frankfurt target, saved local credentials, deployment, E2E and rollback procedure.
