# Serving Match Store

This directory is the app API serving projection for match data.

## Source Of Truth

The serving store is not raw evidence and not an AI training dataset.

The required flow is:

1. Provider raw payloads are archived under `apps/api/data/providers/<provider>/raw/`.
2. Provider normalizers write canonical warehouse JSONL under `apps/api/data/warehouse/`.
3. `pnpm run data:build:serving:matches` materializes API serving partitions under this directory.
4. API routes read this serving store through `ServingMatchStoreRepository`.

AI training must read canonical warehouse and build a separate leakage-safe dataset. It must not train from this serving projection.

## Layout

```text
apps/api/data/serving/
  manifest.json
  versions/<version>/
    indexes/match-id.json
    scope=national-team/
      by-date/YYYY-MM-DD.json
      by-competition/<competitionId>/<season>.json
```

`scope=club` is reserved for a future club expansion. Phase 9 app data remains national-team only.

## Commands

```bash
pnpm run data:normalize:sportmonks:warehouse
pnpm run data:build:serving:matches
pnpm run data:validate:serving:matches
pnpm run data:sync:serving:cloud
```

Do not recreate `apps/api/data/local-match-snapshots/`, `national-team-matches.json`, or `national-team-matches.seed.json`. That single-file path has been removed.
