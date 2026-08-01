# Architecture

## System Boundary

Miraichi is an owner-only TypeScript monorepo with four retained runtime areas:

- `apps/web`: PWA shell and owner workflows.
- `apps/api`: factual match, bet, bankroll, backup, and persistence endpoints.
- `apps/worker`: provider-neutral ingestion scaffold for a future approved crawler.
- `packages/*`: shared contracts, configuration, UI primitives, and agent protocol.

## Runtime Flow

The browser calls only Miraichi API routes. It never scrapes third-party websites directly and never receives database credentials.

The API prefers the local versioned serving store. If that store is missing, it may use the cloud match snapshot repository. Invalid local data is an error and is not hidden by fallback behavior.

Future ingestion must follow:

```text
approved website source
  -> worker adapter and raw cache
  -> provider-neutral canonical warehouse
  -> configured-competition serving projection
  -> API repository
  -> web UI
```

No website source has been approved yet.

## Data Boundary

Allowed factual data includes fixtures, schedules, results, statuses, teams, competitions, events, lineups, and odds. Source IDs and provider links are provenance, never canonical entity IDs.

`LocalCompetitionType` supports `club` and `national-team`. The serving scope is `configured-competitions`, backed by an owner-managed allowlist.

## Owner Data

Manual bet drafts, bet records, odds, stake points, settlements, notes, bankroll accounts, ledger entries, and backups may persist through the API and Supabase adapter. The browser must not access Supabase secrets directly.

## Explicit Exclusions

- automated advisory runtimes;
- automated picks, expected-goals features, stake sizing, Kelly, ROI, CLV, or risk formulas;
- public accounts, multi-tenancy, or direct browser scraping;
- a crawler source without a new accepted ADR.

ADR-0044 is the current product-reset decision.
