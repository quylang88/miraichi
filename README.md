# Miraichi

Miraichi is an owner-only web application for factual football match data, manual bet/odds records, and bankroll management.

## Current Product

- `Today`: daily factual match context.
- `Matches`: browse configured club and national-team competitions.
- `Bets`: create and manage manual drafts and bet records.
- `Bankroll`: manage point accounts, ledger entries, and backups.

The current repository has no selected live website source. Until a new crawler source is approved, match routes read the local serving store and may fall back to the configured cloud snapshot. Missing data must be reported honestly.

## Architecture

```text
apps/web -> apps/api -> local serving store
                    -> Supabase snapshot fallback/persistence

future approved source -> apps/worker crawler -> provider-neutral warehouse -> serving store
```

`apps/worker` remains an ingestion scaffold. Selecting and implementing a website crawler is the next planning phase, not part of the completed reset.

## Commands

```bash
pnpm install
pnpm run dev:web
pnpm run dev:api
pnpm run verify:product-boundary
pnpm run verify:local
pnpm run test:integration
```

Generic data projection commands:

```bash
pnpm run data:build:serving:matches
pnpm run data:validate:serving:matches
pnpm run data:sync:serving:cloud
```

See `PROJECT_PLAN.md` for the active phase and `ARCHITECTURE.md` for boundaries.
