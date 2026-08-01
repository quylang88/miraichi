# Serving Match Store

This directory is the app API serving projection for match data.

## Source Of Truth

The serving store is a materialized API projection, not raw source evidence.

The OpenFootball flow is:

1. The tracked club and national-team allowlist defines the only permitted repository/ref/file targets.
2. The worker performs due-gated conditional capture; it cannot bypass the six-hour minimum interval.
3. Every changed UTF-8 response is archived exactly under `<data-root>/providers/openfootball/raw/` before parsing.
4. The strict Football.TXT parser and OpenFootball adapter produce provider-neutral canonical records.
5. The complete validated candidate is written as an immutable run-scoped warehouse under `<data-root>/warehouse/runs/<run-id>/`.
6. Version files are materialized under this directory and `manifest.json` is replaced last, making the serving version atomic.

Any enabled-source fetch, parse, mapping, count, or publication failure retains its raw and manifest evidence without changing the last valid serving version.

OpenFootball is a periodic fixture/result source, not a live feed, and supplies no odds. Owner-entered live-bet context snapshots are a separate feature and are not part of this pipeline.

## Layout

```text
apps/api/data/serving/
  manifest.json
  versions/<version>/
    indexes/match-id.json
    scope=configured-competitions/
      by-date/YYYY-MM-DD.json
      by-competition/<competitionId>/<season>.json
```

The configured competition allowlist may include both club and national-team competitions.

## Commands

```bash
pnpm run data:build:serving:matches
pnpm run data:validate:serving:matches
pnpm run data:sync:serving:cloud
pnpm run openfootball:verify
pnpm run openfootball:integration
```

Do not recreate `apps/api/data/local-match-snapshots/`, `national-team-matches.json`, or `national-team-matches.seed.json`. That single-file path has been removed.
