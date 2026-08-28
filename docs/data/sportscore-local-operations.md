# Season Hydration Local Operations

## Boundary

Season hydration is provider-neutral and owner-local. The only executable full-season source in
this slice is OpenFootball's public-domain `football.json` season file. The runtime does not
import SportScore's client, does not call SportScore `/api/v1`, and does not poll live matches.

The active data root remains `apps/api/data`. Existing serving and warehouse snapshots are
merged, not deleted or replaced with an empty dataset. Raw OpenFootball season files are stored
under `providers/openfootball/raw`; provider-neutral checkpoints are stored separately under
`providers/season-hydration/state`. The old SportScore date-hydration ledger is preserved but is
never interpreted as a season checkpoint.

Coverage evidence and all 50 mappings are in
[`season-source-coverage-matrix.md`](./season-source-coverage-matrix.md).

## Coverage that can actually run

As verified on 2026-08-28:

- 9/50 competitions have a current OpenFootball JSON season file.
- Only Premier League has an exact kickoff time for every current row.
- 24/50 have a verified OpenFootball past-1 file; 17/50 have past-2.
- football-data.org covers 10/50 on its free tier but requires an owner token and is not
  implemented or enabled in this slice.
- Valid free match-detail coverage is 0/50.

The registry therefore reports 1 supported, 24 partial, and 25 unsupported competitions. A
date-only raw row is retained but is not published with an invented `00:00Z` kickoff.

## Inspect active data

```powershell
pnpm run sportscore:status
```

This command is read-only. It reports the current 41-match active snapshot, the legacy SportScore
daily ledger, and the separate provider-neutral season checkpoint totals.

## Run one bounded season batch

Use the owner's IANA timezone. If `--date` is omitted, the runtime derives the current local date.

```powershell
pnpm run data:hydrate:season:batch -- --timezone Asia/Tokyo --confirm-network SEASON_HYDRATION_NETWORK
```

A deterministic reference date:

```powershell
pnpm run data:hydrate:season:batch -- --date 2026-08-28 --timezone Asia/Tokyo --max-requests 9 --request-interval-ms 2000 --confirm-network SEASON_HYDRATION_NETWORK
```

The planner enforces a hard season barrier:

1. All executable current-season targets in exact registry order.
2. Only after every current target is checkpointed, all available past-1 targets in registry order.
3. Only after past-1 completes, all available past-2 targets.

A deferred current target blocks past seasons; the planner does not skip the barrier. If a newly
mapped competition 51/52 gains an executable current source, its current target appears before
past work resumes.

Each checkpoint key is `provider|competition|season` and stores completion time plus ETag/cursor
when available. One batch may fetch several season files, but it writes at most one merged
warehouse/serving snapshot. This avoids the prior repeated full-snapshot I/O pattern.

## Daily results and detail

There is intentionally no local scheduler in this slice.

- Full-season hydration is not a live or daily polling loop.
- Daily result ingestion needs a separate approved source and ledger.
- football-data.org is the recommended free delayed-result candidate for its 10 covered
  competitions, but using it requires explicit owner approval for a local token and a new TDD
  slice.
- Match detail remains lazy and unavailable until a lawful detail source is approved.
- Existing SportScore-attributed records remain attributed in the UI; retaining those records
  does not authorize new SportScore `/api/v1` requests.

## Verification

```powershell
pnpm run season:integration
pnpm run verify:release
git diff --check
```

Local verification is not staging or production approval. No cloud deployment or provider
promotion is authorized by these commands.
