# Current-Season Hydration Local Operations

## Boundary

Season hydration is provider-neutral and owner-local. FotMob unofficial is the primary executable
current-season source under the owner-accepted ADR-0049 risk boundary. ESPN remains disabled and
OpenFootball remains a provider-neutral fallback where an exact season file is registered.

The runtime does not import the SportScore client, does not call SportScore `/api/v1`, does not poll
live matches, and does not implement anti-bot circumvention. A FotMob `403` or `429` opens the
circuit breaker; stop the run instead of changing identity, proxying, or simulating a browser.

The active data root is `apps/api/data`. Existing serving and warehouse snapshots are merged, never
deleted or replaced with an empty dataset. Provider-neutral checkpoints live under
`providers/season-hydration/state` and are keyed by provider, competition, and canonical season.

Coverage evidence and all exact mappings are in
[`fotmob-unofficial-coverage-matrix.md`](./fotmob-unofficial-coverage-matrix.md).

## Current verified state

Verified locally on 2026-08-31:

- Exact FotMob mappings: 50/50.
- Executable current editions: 45/50.
- Current checkpoints: 45.
- Serving snapshot: 10,899 valid matches across 45 competition partitions.
- Historical checkpoints: 0.
- Five current editions are unavailable or unpublished: Club World Cup, FA Cup, Copa del Rey,
  Coupe de France, and KNVB Beker.
- Two in-play provider rows were excluded from canonical and serving data.
- Three old mismatch failures remain as forensic ledger evidence; they are no longer executable
  targets and do not authorize deletion.
- The exact Step 3 command was replayed after completion and returned `status: idle`, zero requests,
  zero publications, 45 completed targets, 10,899 matches, and `fresh` serving state.

This is all data currently published by the provider for the verified editions. It is not a
guarantee that staged cup competitions have published every future round.

## Historical-season hard stop

Historical-season hydration is **PENDING by owner decision on 2026-08-31**.

- The command-line runtime defaults to `--past-seasons 0`.
- Any value above zero is rejected.
- Do not edit the ledger, registry, or runtime to bypass this stop.
- Reopening past-1 or past-2 requires a new `phase:plan` with exact provider-season evidence.

## Standard current-season runbook

Run every command from PowerShell. Stop immediately when a command exits non-zero.

### Step 1 — enter the workspace and confirm the code revision

```powershell
Set-Location C:\CODE\miraichi
git status --short
git branch --show-current
git log -1 --oneline
```

`git status --short` must be empty. Generated data under `apps/api/data` is gitignored and does not
make the tracked worktree dirty.

### Step 2 — verify the executable boundary before network access

```powershell
pnpm run verify:release
pnpm run data:validate:serving:matches
pnpm run sportscore:status
```

For the verified 2026-08-31 root, expect `fresh`, 10,899 matches, and 45 completed hydration
targets. Local verification is not staging or production approval.

### Step 3 — run exactly one bounded current-season batch

```powershell
pnpm run data:hydrate:season:batch -- --timezone Asia/Tokyo --past-seasons 0 --max-requests 9 --request-interval-ms 2000 --confirm-network SEASON_HYDRATION_NETWORK
```

Important behavior:

- The omitted `--date` is derived in `Asia/Tokyo`; do not reuse an old fixed date for routine runs.
- One invocation attempts at most nine provider requests and performs at most one atomic publication.
- The exact registry order is preserved.
- On the already-complete active root, the expected result is `status: idle`,
  `requestsAttempted: 0`, and no new publication.
- On an incomplete but valid root, repeat Steps 3 and 4 until 45 current targets are checkpointed.
- If `requestsFailed` is above zero, stop. Respect the persisted backoff; do not immediately loop.

### Step 4 — validate after every batch

```powershell
pnpm run data:validate:serving:matches
pnpm run sportscore:status
git status --short
```

The serving validator must pass, match count must never fall to zero, and the tracked worktree must
remain clean. A lower match count or new warning is a stop condition requiring review before any
further provider request.

### Step 5 — serve the local API

In a separate PowerShell terminal:

```powershell
Set-Location C:\CODE\miraichi
pnpm run dev:api
```

The browser and web app continue to read through Miraichi API routes such as
`GET /api/v1/matches`; they never call FotMob directly.

## Current-edition revalidation

Full-season hydration remains separate from result checks. To discover newly published rounds,
run current-only revalidation after the 24-hour checkpoint TTL. Each invocation is capped at nine
season requests, preserves registry order, sends the saved ETag, and advances a 304 checkpoint
without publishing a duplicate snapshot.

Run up to five bounded batches to cover all 45 executable current editions. The loop stops on the
first non-zero exit code:

```powershell
1..5 | ForEach-Object {
  pnpm run data:revalidate:season:current -- --timezone Asia/Tokyo --past-seasons 0 --max-requests 9 --request-interval-ms 2000 --confirm-network SEASON_HYDRATION_NETWORK
  if ($LASTEXITCODE -ne 0) { throw "Current revalidation failed at batch $_" }
}
pnpm run data:validate:serving:matches
```

When no checkpoint is due, every invocation returns `status: idle` and makes zero requests. This
command never makes a historical target eligible. Do not reduce the request interval or increase
the nine-request batch cap.

## Fast terminal results

The terminal pipeline is implemented separately from season hydration. It reads only known
canonical matches with private FotMob links, first checks at kickoff +105 minutes, groups all due
matches by provider date, and retries non-terminal observations every two minutes. Missing rows
retry after five minutes. It stops after 45 checks or kickoff +240 minutes.

Run one bounded check:

```powershell
pnpm run data:results:terminal:once -- --timezone Asia/Tokyo --owner-country JPN --max-requests 2 --confirm-network FOTMOB_TERMINAL_RESULTS_NETWORK
```

For the lowest supported latency, keep one dedicated PowerShell terminal open and run the serial
watch loop:

```powershell
Set-Location C:\CODE\miraichi
pnpm run data:results:terminal:watch -- --timezone Asia/Tokyo --owner-country JPN --max-requests 2 --confirm-network FOTMOB_TERMINAL_RESULTS_NETWORK
```

Stop it with `Ctrl+C`. The loop wakes every 30 seconds, but the durable ledger makes zero provider
requests until a known match is due and prevents overlapping runs. Once the first check window is
open, the objective is best-effort 0–2 minutes after FotMob marks FT; this is not an SLA.

Stop immediately on `partial`, `circuitOpen: true`, HTTP 403/429, a non-zero exit, a lower serving
match count, or a new validation warning. Do not launch a second watcher, proxy requests, change
identity, fabricate browser headers, or delete the active ledger/snapshot to force a retry.

Only completed, postponed, and cancelled observations can be published. Live score/time and raw
daily response bodies are not persisted or returned by Miraichi API. Lazy FotMob match detail is
still pending and is not implemented by either terminal command.

Existing SportScore-attributed records retain attribution, but no new SportScore `/api/v1`
request is authorized.

## Verification commands

```powershell
pnpm run season:integration
pnpm run fotmob:terminal:integration
pnpm run verify:release
git diff --check
```

No command in this document deploys to cloud, staging, or production.
