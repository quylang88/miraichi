# Serving Match Store

This directory is the app API serving projection for match data.

## Source Of Truth

The serving store is a materialized, provider-neutral API projection, not raw source evidence.

The API-Football ingestion and serving flow is:

1. The declarative 50-competition allowlist (`packages/config/src/api-football-source-registry.ts`) defines the only permitted targets. Registry contracts support both `club` and `national-team` without core-code priority.
2. Historical hydration (`apps/worker/src/jobs/api-football-hydration-job.ts`) populates current and past seasons layer-by-layer with idempotent checkpoints tracked in `hydration-checkpoints.json`.
3. Daily sync (`apps/worker/src/jobs/api-football-ingestion-job.ts` with mode `daily_sync`) executes at most once per owner-local date (`Asia/Tokyo`) and sends that timezone to API-Football for the date query.
4. Smart Window Polling (mode `window_poll`) starts at kickoff +100 minutes, batches at most 20 fixture IDs, and continues beyond +115 minutes only while the provider reports active extra time or penalties, bounded at +180 minutes.
5. All provider payloads are normalized through `ApiFootballAdapter` into canonical warehouse records and atomically merged with existing historical snapshots under `<data-root>/warehouse/runs/<run-id>/`.
6. Atomic publication materializes version files under this directory and updates `manifest.json` last.
7. Terminal matches (`FT`, `AET`, `PEN`) cache basic factual match details under `<data-root>/match-details/`. Cache misses on completed historical matches are queued in `<data-root>/match-detail-refresh/` and lazily refreshed.

## Quota & Boundaries

- **Free-tier ceiling**: 85 requests/day normal ceiling with 15 requests reserved outside automatic use (100 req/day total).
- **Rate limiting**: Maximum 10 requests per rolling 60-second window with automatic pacing.
- **Provider neutrality**: Credentials, provider URLs, and provider fixture IDs are strictly server-side and never exposed to the client or public API routes.
- **Product boundaries**: Basic match details include scores, referee, events (goals, cards, substitutions), and two-team statistics. No predictions, xG, confidence, Kelly, ROI, or betting advice.

## Layout

```text
apps/api/data/
  warehouse/runs/<run-id>/
  serving/
    manifest.json
    versions/<version>/
      indexes/match-id.json
      scope=configured-competitions/
        by-date/YYYY-MM-DD.json
        by-competition/<competitionId>/<season>.json
  match-details/
    <matchId-hash>.json
  match-detail-refresh/
    queue.json
  api-football/
    usage-ledger.json
  hydration-checkpoints.json
```

## Commands

```bash
pnpm run api-football:verify
pnpm run api-football:integration
pnpm run api-football:quota-status
pnpm run data:build:serving:matches
pnpm run data:validate:serving:matches
pnpm run data:sync:serving:cloud
```

## Safe Live-Key Bootstrap

Local tests do not authorize a live-key call. Start only after explicit owner approval for `phase:staging`, and verify the API-Football dashboard has quota available. Never commit `.env` or print the key.

From PowerShell at the workspace root:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
pnpm run verify:release
pnpm run api-football:quota-status
```

Set only `API_FOOTBALL_KEY` in `.env`. The first live call must use an isolated, Git-ignored smoke root so it cannot replace the active serving manifest:

```powershell
$smokeRoot = Join-Path (Get-Location) '.cache\api-football-smoke'
pnpm run data:seed:api-football -- --competition=eng-premier-league --season=2024 --limit=1 --data-root=$smokeRoot
pnpm run api-football:quota-status -- --data-root=$smokeRoot
```

That smoke consumes one provider request. Do not start active hydration from a fresh ledger on the same provider day; wait for the next UTC provider-day reset so the active ledger and provider quota start aligned.

The explicit `2024` season is intentional for the Free plan. On 2026-08-26, the provider rejected Premier League season 2026 with `Free plans do not have access to this season, try from 2022 to 2024.` Do not use `--season=current`, `previous`, or `older` with a Free key unless every resolved registry season is inside the provider-accessible range: a rejected target still consumes a request. The CLI exits non-zero when any selected target fails.

With a Free key, hydrate only an explicitly accessible historical season, one fair batch per quiet provider day:

```powershell
pnpm run api-football:quota-status
pnpm run data:seed:api-football -- --season=2024 --limit=50
```

Current fixtures, daily result updates, and the best-effort terminal-result SLO cannot operate from historical-only Free-plan access. Do not pretend that the 100-request allowance solves this: a provider plan with current-season access is required before enabling the active daily worker. Once that access is verified, the `current`, `previous`, and `older` layer commands may be used on separate provider days.

Operational rules:

- Each selected competition-season target normally costs one request. Checkpoints skip completed targets after interruption.
- Provider errors also cost a request; verify season entitlement with a one-target isolated smoke before any 50-target run.
- The durable normal ceiling is 85 requests per UTC provider day; the final 15 of the free-plan 100 are not used automatically.
- Fifty hydration requests leave at most 35 normal requests for the one daily sync, result polling, and lazy detail. On a busy match day, reduce hydration to 20–30 targets or skip it.
- Do not delete `hydration-checkpoints.json` or `api-football/usage-ledger.json`; doing so destroys resume/quota knowledge.
- Do not run multiple seed/worker processes deliberately. The job lease serializes publication, but competing processes still make operations harder to reason about.
- The worker performs daily sync, due result polling, and lazy historical-detail refresh. Hydration is a separate owner-invoked command.
