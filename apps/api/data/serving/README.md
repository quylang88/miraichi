# Serving Match Store

This directory is the app API serving projection for match data.

## Source Of Truth

The serving store is a materialized API projection, not raw source evidence.

The required flow is:

1. An approved crawler archives raw payloads under `apps/api/data/providers/<provider>/raw/`.
2. Provider adapters write canonical warehouse JSONL under `apps/api/data/warehouse/`.
3. `pnpm run data:build:serving:matches` materializes API serving partitions under this directory.
4. API routes read this serving store through `ServingMatchStoreRepository`.

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
```

Do not recreate `apps/api/data/local-match-snapshots/`, `national-team-matches.json`, or `national-team-matches.seed.json`. That single-file path has been removed.
