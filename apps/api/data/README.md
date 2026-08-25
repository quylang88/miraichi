# Local API data

This directory contains local runtime state. Generated provider payloads, quota state, warehouse runs, and serving versions are intentionally not committed.

## API-Football runtime files

- `api-football/usage-ledger.json` is required at runtime. It durably reserves and reconciles the free-plan request budget across worker/CLI restarts.
- `api-football/usage-ledger.json.lock` is transient and exists only while one process updates the ledger.
- `api-football/usage-ledger.json.backup` and `usage-ledger.json.tmp.*` are transient crash-recovery files.

The worker creates these files only after receiving an explicit `dataRoot`. Unit and integration tests must use temporary directories and must never write them here.

Do not delete the current-day usage ledger before running with a real API key: doing so loses local quota history and can cause the free-plan limit to be exceeded. A genuinely stale lock may be recovered automatically after its owner process exits.

## Provider-neutral stores

- `warehouse/` retains immutable canonical runs.
- `serving/` retains the current provider-neutral snapshot consumed by the Miraichi API.

The tracked `.gitkeep` and README files preserve directory structure and operating guidance; they are not legacy match data.
