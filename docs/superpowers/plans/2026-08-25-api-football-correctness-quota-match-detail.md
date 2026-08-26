# API-Football Correctness, Quota Hardening, And Basic Match Detail Implementation Plan

**Goal:** Repair the accepted API-Football integration so repeated hydration, daily sync, and result polling preserve one complete provider-neutral dataset; keep all provider calls inside the free-plan budget; and provide cached factual match detail for the owner.

**Architecture:** API-Football remains a removable worker-side provider. Every provider response is mapped through registry-backed canonical identity, merged into the last-good immutable warehouse snapshot, and only then atomically published to the serving store. A durable filesystem ledger serializes the single owner worker and CLI, records daily and per-minute usage, and reconciles API-Sports rate-limit headers. Match detail uses a provider-neutral local cache and refresh queue: the API route never calls API-Football, while the worker batches at most 20 provider fixture IDs and stores normalized detail atomically.

**Tech Stack:** TypeScript 6, Node.js 24 for the local workflow, pnpm workspaces, Vitest 4, native `fetch`, immutable JSONL warehouse runs, atomic JSON serving/cache files, existing four-tab PWA.

## Owner-Approved Boundary

- Result freshness is a **best-effort SLO of <= 5 minutes**, not a hard SLA. The SLO is eligible only while API-Football is available, the fixture is known, and normal quota remains.
- Match results and detail are persisted only after a terminal `FT`/`AET`/`PEN` response. Historical detail is fetched lazily only for completed matches after the owner first requests it. Provider live responses are polling control only and are not persisted or published.
- Competition configuration continues to support both `club` and `national-team`; neither type receives core-code priority.
- Basic detail includes factual header data, score breakdown, goals/cards/penalties/substitutions, and the two-team summary for corners, cards, shots, shots on target, and possession.
- The browser calls only Miraichi API routes. Provider credentials, URLs, fixture IDs, rate-limit state, and refresh orchestration stay server-side.

## Explicit Non-Goals

- No predictions, picks, expected goals, confidence, Kelly, stake sizing, ROI, CLV, or automatic betting decisions.
- No public authentication, multi-tenancy, paid provider plan, production schema migration, or new managed queue/database.
- No bulk historical player-detail hydration, player ratings, heatmaps, or lineup UI in this boundary.
- No real provider call is part of unit or integration verification; live key smoke belongs to staging after local gates pass and owner approves staging.
- No production promotion is implied by completion of this plan.

## Global Invariants

- A successful run publishes the union of the last-good canonical snapshot and the current delta; a delta never replaces unrelated matches.
- The serving manifest changes only after the complete candidate warehouse, serving partitions, match details, and validation gates succeed.
- A hydration checkpoint becomes `completed` only after its target is present in the published serving snapshot.
- Canonical match IDs never embed or parse API-Football fixture IDs. Provider IDs exist only in provider links and server-side refresh resolution.
- Daily sync is at most one successful provider request per owner-local date. Local scheduler heartbeats make zero provider requests when no action is due.
- One provider request is durably reserved before network I/O. A crash may consume a reservation, but can never cause the process to undercount usage.
- The client never sends a fake key. Missing credentials fail before quota reservation or network I/O.
- Free-plan calls are limited to 10 per rolling minute, normal usage stops at 85 per provider day, and the final 15 are not used automatically.
- `fixtures?ids=` requests contain at most 20 IDs.
- Current-season hydration is scheduled across every enabled competition before any historical-season target; history then proceeds round-robin by recency.
- Missing provider coverage produces explicit `unavailable`/warning state and never fabricated zeros or invented events.
- Provider live states never enter canonical/local contracts: a non-terminal poll keeps the stored match scheduled with null scores and does not publish a new snapshot or detail cache entry.

---

## Slice 1: Correct Competition, Season, Status, And Canonical Identity

**Files:**

- Modify: `packages/config/src/api-football-source-registry.ts`
- Modify: `packages/config/src/api-football-source-registry.test.ts`
- Modify: `packages/shared/src/contracts/local-match-contracts.ts`
- Modify: `packages/shared/src/contracts/local-match-contracts.test.ts`
- Modify: `packages/shared/src/contracts/provider-ingestion-contracts.ts`
- Modify: `packages/shared/src/contracts/provider-ingestion-contracts.test.ts`
- Modify: `apps/worker/src/sources/api-football/api-football-adapter.ts`
- Modify: `apps/worker/src/sources/api-football/api-football-adapter.test.ts`

**Failing tests:**

- Registry validation accepts a `national-team` entry and rejects an unknown competition type.
- A target for provider season `2024` is stored as season `2024` even when the registry current season is `2026`.
- Daily and hydration adaptation of league `39` both use canonical competition ID `eng-premier-league`, never `league-39`.
- Changing only `fixture.id` does not change the canonical match ID; the changed provider ID appears only in the provider link.
- `1H`, `HT`, `2H`, `ET`, `BT`, `P`, and `LIVE` remain non-published polling state; canonical/local matches stay `scheduled` with null scores. Only `FT`, `AET`, and `PEN` normalize to `completed` with factual terminal scores.
- `competitionEntry.competitionType` is projected instead of a hardcoded `club` value.

**Red command:**

```text
pnpm exec vitest run packages/config/src/api-football-source-registry.test.ts packages/shared/src/contracts/local-match-contracts.test.ts packages/shared/src/contracts/provider-ingestion-contracts.test.ts apps/worker/src/sources/api-football/api-football-adapter.test.ts
```

Expected: FAIL on national-team configuration, historical season validation, canonical ID stability, and terminal-only status projection.

**Implementation:**

- Change `ApiFootballCompetitionEntry.competitionType` to `LocalCompetitionType` and keep the initial 50 entries as club competitions.
- Keep `in_play` rejected by provider-neutral canonical/local status contracts. Treat provider live states as internal polling control only.
- Require adaptation to receive a registry entry and an expected target season; reject mismatched league ID or season instead of guessing.
- Build the canonical match ID from a hash of `competitionId | season | normalizedRound | homeTeamId | awayTeamId`. Kickoff time and provider fixture ID are excluded.
- Keep `fixture.id` solely in `ProviderLink.providerEntityId` and subsequent server-side lookup.
- Remove the fallback `league-${providerLeagueId}` competition identity from accepted ingestion paths.

**Green verification:**

```text
pnpm exec vitest run packages/config/src/api-football-source-registry.test.ts packages/shared/src/contracts/local-match-contracts.test.ts packages/shared/src/contracts/provider-ingestion-contracts.test.ts apps/worker/src/sources/api-football/api-football-adapter.test.ts
pnpm run typecheck
git diff --check
```

**Slice exit:** Focused tests and typecheck pass; commit `fix: restore provider-neutral match identity`.

---

## Slice 2: Persist And Reconcile Daily/Per-Minute Quota

**Files:**

- Create: `apps/worker/src/sources/api-football/api-football-usage-ledger.ts`
- Create: `apps/worker/src/sources/api-football/api-football-usage-ledger.test.ts`
- Modify: `apps/worker/src/sources/api-football/api-football-client.ts`
- Modify: `apps/worker/src/sources/api-football/api-football-client.test.ts`
- Modify: `apps/worker/src/jobs/api-football-hydration-job.ts`
- Modify: `apps/worker/src/jobs/api-football-hydration-job.test.ts`
- Modify: `apps/worker/src/jobs/api-football-ingestion-job.ts`
- Modify: `apps/worker/src/jobs/api-football-ingestion-job.test.ts`
- Modify: `tests/integration/api-football-rapid-match-source.test.ts`
- Modify: `.env.example`
- Modify: `.gitignore`
- Create: `apps/api/data/README.md`
- Modify: `scripts/capture-api-football.ts`
- Modify: `scripts/seed-api-football-history.ts`
- Create: `scripts/quota-status-api-football.ts`
- Modify: `package.json`

**Failing tests:**

- A new client/process using the same ledger path sees prior daily usage and stops at 85.
- A request reservation is persisted before the injected `fetchFn` runs and remains counted after a network failure.
- Response headers `x-ratelimit-requests-limit` and `x-ratelimit-requests-remaining` reconcile the durable daily state upward, never downward below known consumption.
- Eleven immediate request attempts cause the eleventh to wait until the rolling-minute window permits it; injected sleep makes this deterministic.
- A lock prevents two concurrent processes from reserving the same quota slot.
- A missing `API_FOOTBALL_KEY` throws `api_football_key_missing` without fetch or quota mutation.
- The client never substitutes `mock-api-key` and no longer advertises unsupported RapidAPI credentials.

**Red command:**

```text
pnpm exec vitest run apps/worker/src/sources/api-football/api-football-usage-ledger.test.ts apps/worker/src/sources/api-football/api-football-client.test.ts
```

Expected: FAIL because usage is in-memory, response headers are ignored, and missing keys fall back to a fake value.

**Implementation:**

- Store `miraichi.api-football-usage.v1` under `<dataRoot>/api-football/usage-ledger.json` with provider-day key, reserved/confirmed usage, rolling request timestamps, and last reconciled header values.
- Serialize read-modify-write with an exclusive lock file created by `open(..., 'wx')`; validate absolute containment, apply a bounded stale-lock timeout, and atomically replace state via temp file + rename.
- Reserve before fetch. Reconcile response headers after every HTTP response, including error responses when headers exist.
- Enforce a rolling 10-request/60-second limiter using injected `now` and `sleep`; never busy-wait.
- Allow one new-day probe reservation, then trust provider headers as the authoritative quota signal.
- Make `ApiFootballClient` require an explicit durable ledger and a real direct-dashboard `API_FOOTBALL_KEY` in production scripts.
- Remove the in-memory `DailyQuotaGuard`; jobs, CLI status, and tests read the durable ledger as the single quota source of truth.
- Require an explicit `dataRoot`, `ledgerPath`, or ledger instance so tests cannot write generated quota state into the source tree.
- Fail closed on a corrupt ledger or failed provider-header reconciliation, and release only a lock owned by the current operation.
- Remove the unimplemented `RAPIDAPI_KEY` path from `.env.example` and documentation in this boundary.
- Add `api-football:quota-status` as a read-only CLI command that prints persisted use and last provider-reported remaining quota without making a request.

**Green verification:**

```text
pnpm exec vitest run apps/worker/src/sources/api-football/api-football-usage-ledger.test.ts apps/worker/src/sources/api-football/api-football-client.test.ts
pnpm run typecheck
git diff --check
```

**Slice exit:** Restart/concurrency/rate-limit tests pass; commit `fix: persist API-Football quota usage`.

---

## Slice 3: Merge Complete Warehouse Snapshots And Publish Before Checkpointing

**Files:**

- Modify: `scripts/providers/shared/canonical-warehouse.ts`
- Modify: `scripts/providers/shared/canonical-warehouse.test.ts`
- Create: `apps/worker/src/sources/api-football/api-football-snapshot-merge.ts`
- Create: `apps/worker/src/sources/api-football/api-football-snapshot-merge.test.ts`
- Create: `apps/worker/src/sources/api-football/api-football-job-lease.ts`
- Create: `apps/worker/src/sources/api-football/api-football-job-lease.test.ts`
- Modify: `apps/worker/src/sources/api-football/api-football-usage-ledger.ts`
- Modify: `apps/worker/src/sources/api-football/api-football-usage-ledger.test.ts`
- Modify: `apps/api/src/repositories/serving-match-store.ts`
- Modify: `apps/api/src/repositories/serving-match-store.test.ts`
- Modify: `apps/worker/src/sources/api-football/hydration-checkpoint-manager.ts`
- Modify: `apps/worker/src/sources/api-football/hydration-checkpoint-manager.test.ts`
- Modify: `apps/worker/src/jobs/api-football-hydration-job.ts`
- Modify: `apps/worker/src/jobs/api-football-hydration-job.test.ts`

**Failing tests:**

- Two one-target hydration runs leave both targets in the final serving snapshot.
- A later daily/poll delta can update one match without deleting unrelated historical matches.
- Completed matches never regress to scheduled/in-play when an older delta is merged.
- A publication failure leaves the prior serving manifest and checkpoint records unchanged.
- Checkpoint files are atomically replaced; malformed/corrupt state throws a typed error instead of silently restarting from zero.
- An empty provider response is recorded as `empty`/retryable and is not marked completed unless registry coverage explicitly declares that season empty.

**Red command:**

```text
pnpm exec vitest run scripts/providers/shared/canonical-warehouse.test.ts apps/worker/src/sources/api-football/api-football-snapshot-merge.test.ts apps/api/src/repositories/serving-match-store.test.ts apps/worker/src/sources/api-football/hydration-checkpoint-manager.test.ts apps/worker/src/jobs/api-football-hydration-job.test.ts
```

Expected: FAIL because every current job publishes only its delta and checkpoints precede publication.

**Implementation:**

- Add `readCanonicalWarehouseRun(dataRoot, runId)` and export a validated read-only serving manifest accessor.
- Validate all five required warehouse collections both before writing and while reading; missing, malformed, invalid, or duplicate records fail closed.
- Load the warehouse run referenced by the current serving manifest; absence is an empty first-run snapshot, corruption is fatal.
- Merge matches, teams, competitions, provider links, and provenance by their canonical keys. Newer `updatedAt` wins while terminal status is monotonic and source links/provenance are deduplicated.
- Preserve terminal status/score provenance when a newer provider delta attempts to regress a completed match.
- Write one full immutable candidate warehouse run, derive the entire serving snapshot from that run, validate counts/identity, then atomically replace the serving manifest.
- Move all `markCompleted` operations after successful manifest replacement and verify each target's competition/season exists in the published snapshot.
- Persist all successful target completions in one transactional checkpoint batch after publication.
- Write checkpoints through temp + fsync/close + rename and validate schema/version/record keys during load.
- Acquire one provider job lease for hydration or ingestion publication so the CLI and worker cannot publish concurrently.
- Never evict a lease or quota lock while its owner PID is still alive, even when the operation exceeds the stale timeout.

**Green verification:**

```text
pnpm exec vitest run scripts/providers/shared/canonical-warehouse.test.ts apps/worker/src/sources/api-football/api-football-snapshot-merge.test.ts apps/api/src/repositories/serving-match-store.test.ts apps/worker/src/sources/api-football/hydration-checkpoint-manager.test.ts apps/worker/src/jobs/api-football-hydration-job.test.ts
pnpm run typecheck
git diff --check
```

**Slice exit:** Last-good preservation and checkpoint-order tests pass; commit `fix: merge API-Football snapshots atomically`.

---

## Slice 4: Hydrate All Competitions Fairly And Resume 51+

**Files:**

- Modify: `packages/config/src/api-football-source-registry.ts`
- Modify: `packages/config/src/api-football-source-registry.test.ts`
- Modify: `apps/worker/src/sources/api-football/hydration-checkpoint-manager.ts`
- Modify: `apps/worker/src/sources/api-football/hydration-checkpoint-manager.test.ts`
- Modify: `apps/worker/src/jobs/api-football-hydration-job.ts`
- Modify: `apps/worker/src/jobs/api-football-hydration-job.test.ts`
- Modify: `scripts/seed-api-football-history.ts`
- Create: `scripts/seed-api-football-history.test.ts`

**Failing tests:**

- For 50 entries with three seasons and `maxBatchesPerRun: 50`, all 50 first targets are current season, in deterministic competition-ID order.
- The next 50 targets are the most recent historical season for all competitions; the oldest season is third.
- Adding a 51st entry to a completed ledger places its current season first without re-requesting the existing 50.
- `--limit=0`, negative/NaN limits, unknown categories, unknown arguments, and unsafe data roots are rejected without a request.
- `--season=current|previous|older|YYYY` selects only the requested hydration layer or exact season for an owner smoke run.
- The job stops when durable normal quota is unavailable even if CLI limit remains.

**Red command:**

```text
pnpm exec vitest run packages/config/src/api-football-source-registry.test.ts apps/worker/src/sources/api-football/hydration-checkpoint-manager.test.ts apps/worker/src/jobs/api-football-hydration-job.test.ts scripts/seed-api-football-history.test.ts
```

Expected: FAIL because targets currently follow registry order with oldest season first and CLI validation is incomplete.

**Implementation:**

- Return hydration layers as `[current, previous, older]`, deduplicated and newest-first.
- Build pending targets by season layer across all enabled competitions, then deterministic competition ID. Do not use category order as priority.
- Detect future entries solely from missing `(competitionId, providerLeagueId, season)` checkpoint records.
- Validate CLI arguments in an exported command function; support `--competition`, `--category`, `--season=current|previous|older|YYYY`, `--limit`, and contained absolute `--data-root` for safe smoke/testing.
- Print completed/empty/failed counts plus durable quota status. Never print a key or claim mock mode.

**Green verification:**

```text
pnpm exec vitest run packages/config/src/api-football-source-registry.test.ts apps/worker/src/sources/api-football/hydration-checkpoint-manager.test.ts apps/worker/src/jobs/api-football-hydration-job.test.ts scripts/seed-api-football-history.test.ts
pnpm run typecheck
git diff --check
```

**Slice exit:** Fairness, resume, and CLI tests pass; commit `fix: hydrate competitions round-robin`.

---

## Slice 5: Normalize And Persist Basic Match Detail

**Files:**

- Modify: `packages/shared/src/contracts/local-match-contracts.ts`
- Modify: `packages/shared/src/contracts/local-match-contracts.test.ts`
- Modify: `packages/shared/src/contracts/provider-ingestion-contracts.ts`
- Modify: `packages/shared/src/contracts/provider-ingestion-contracts.test.ts`
- Modify: `apps/worker/src/sources/api-football/api-football-client.ts`
- Modify: `apps/worker/src/sources/api-football/api-football-client.test.ts`
- Modify: `apps/worker/src/sources/api-football/api-football-adapter.ts`
- Modify: `apps/worker/src/sources/api-football/api-football-adapter.test.ts`
- Create: `apps/api/src/repositories/local-match-detail-store.ts`
- Create: `apps/api/src/repositories/local-match-detail-store.test.ts`

**Failing tests:**

- A rich `fixtures?ids=` payload normalizes referee, elapsed minute, HT/FT/ET/PEN score breakdown, goal/card/penalty/substitution timeline, scorer, assist, stoppage time, and canonical team IDs.
- Team statistics normalize `Corner Kicks`, `Yellow Cards`, `Red Cards`, `Total Shots`, `Shots on Goal`, and percentage-string possession to number/null fields.
- Unsupported/missing coverage remains null with a warning; it never becomes zero.
- Detail containing provider fixture IDs, provider URLs, predictions, xG, or odds fails provider-neutral validation.
- Atomic detail-store upsert survives interruption with the prior valid file intact and rejects path traversal through match IDs.

**Red command:**

```text
pnpm exec vitest run packages/shared/src/contracts/local-match-contracts.test.ts packages/shared/src/contracts/provider-ingestion-contracts.test.ts apps/worker/src/sources/api-football/api-football-client.test.ts apps/worker/src/sources/api-football/api-football-adapter.test.ts apps/api/src/repositories/local-match-detail-store.test.ts
```

Expected: FAIL because provider types and detail contracts do not carry embedded events/statistics and no detail store exists.

**Implementation:**

- Expand `LocalMatchDetail` with `status`, `elapsedMinute`, optional referee, score breakdown, normalized events, two team-stat rows, coverage warnings, and `updatedAt`.
- Preserve the full factual `match` object but expose no provider ID.
- Extend `ApiFootballFixtureItem` only with the embedded fields used by this basic boundary: `events` and `statistics`; do not add players/lineups.
- Map event teams from provider home/away team IDs to canonical team IDs and preserve factual labels without betting interpretation.
- Store one atomically replaced provider-neutral JSON file per hashed canonical match ID under `<dataRoot>/match-details/`.
- Allow newer partial detail to enrich missing fields but never delete already-known terminal events/statistics unless the provider supplies a newer complete replacement.

**Green verification:**

```text
pnpm exec vitest run packages/shared/src/contracts/local-match-contracts.test.ts packages/shared/src/contracts/provider-ingestion-contracts.test.ts apps/worker/src/sources/api-football/api-football-client.test.ts apps/worker/src/sources/api-football/api-football-adapter.test.ts apps/api/src/repositories/local-match-detail-store.test.ts
pnpm run typecheck
git diff --check
```

**Slice exit:** Detail contract/adapter/cache tests pass; commit `feat: cache factual match details`.

---

## Slice 6: Enforce One Daily Sync And Quota-Aware Smart Windows

**Files:**

- Create: `apps/worker/src/sources/api-football/api-football-schedule-planner.ts`
- Create: `apps/worker/src/sources/api-football/api-football-schedule-planner.test.ts`
- Modify: `apps/worker/src/jobs/api-football-ingestion-job.ts`
- Modify: `apps/worker/src/jobs/api-football-ingestion-job.test.ts`
- Modify: `apps/worker/src/index.ts`
- Modify: `apps/worker/src/index.test.ts`
- Modify: `scripts/capture-api-football.ts`
- Create: `scripts/capture-api-football.test.ts`

**Failing tests:**

- One hundred scheduler heartbeats outside a concluding window produce exactly one successful daily-sync request for the owner-local date.
- A failed daily sync remains due; a published daily sync is not retried until the next local date.
- Daily sync groups each response fixture through its configured registry entry and preserves all historical serving matches.
- Twenty-one due fixtures become two requests of 20 and 1; 41 become three requests.
- Provider fixture IDs are resolved from server-side source refs/provider links, never parsed from canonical match IDs.
- The first normal poll is due at kickoff +100 minutes; provider responses that remain live, in extra time, or in penalties schedule another internal poll every 150 seconds up to +180 minutes or terminal state without publishing live state.
- `FT`, `AET`, `PEN`, cancelled, and postponed stop future polling immediately.
- No due work or no normal quota makes zero fetch calls and does not mutate the serving manifest.
- Only fully terminal poll responses atomically merge matches and upsert embedded detail before returning `published`; non-terminal responses record the next due poll and return `not_modified` without mutating public stores.

**Red command:**

```text
pnpm exec vitest run apps/worker/src/sources/api-football/api-football-schedule-planner.test.ts apps/worker/src/jobs/api-football-ingestion-job.test.ts apps/worker/src/index.test.ts scripts/capture-api-football.test.ts
```

Expected: FAIL because auto mode currently daily-syncs every 150 seconds, IDs are unbounded, and the window ends at +115.

**Implementation:**

- Persist `lastSuccessfulDailySyncDate` and per-match next-due poll state in the operational ledger.
- Compute the daily date in the configured owner timezone and request it once with the provider timezone parameter.
- Keep a cheap local heartbeat; call the provider only for a due daily sync, due result batch, or queued detail refresh.
- Chunk provider IDs at 20 and let the durable limiter space requests.
- Start normal result polling at +100 minutes. Continue based on returned status, extending only active extra-time/penalty fixtures to +180 minutes.
- Use 150-second cadence for eligible active/result polling and record SLO eligibility plus deferral reason (`quota`, `provider_error`, `unknown_fixture`, or `coverage`).
- Instantiate one ledger/client/job dependency graph at worker startup; do not create a fresh quota guard per tick.
- Make CLI `--mode=daily_sync|window_poll|auto` use the same due/quota gates; no force bypass.

**Green verification:**

```text
pnpm exec vitest run apps/worker/src/sources/api-football/api-football-schedule-planner.test.ts apps/worker/src/jobs/api-football-ingestion-job.test.ts apps/worker/src/index.test.ts scripts/capture-api-football.test.ts
pnpm run typecheck
git diff --check
```

**Slice exit:** Due, chunking, extended-window, and no-call tests pass; commit `fix: schedule quota-aware result polling`.

---

## Slice 7: Queue And Lazy-Cache Historical Detail Behind Miraichi API

**Files:**

- Create: `apps/api/src/repositories/match-detail-refresh-queue.ts`
- Create: `apps/api/src/repositories/match-detail-refresh-queue.test.ts`
- Modify: `apps/api/src/routes/match-detail.ts`
- Modify: `apps/api/src/routes/match-detail.test.ts`
- Create: `apps/worker/src/jobs/api-football-match-detail-job.ts`
- Create: `apps/worker/src/jobs/api-football-match-detail-job.test.ts`
- Modify: `apps/worker/src/index.ts`
- Modify: `apps/worker/src/index.test.ts`

**Failing tests:**

- Cached detail returns HTTP 200 without queue or provider work.
- A scheduled match without detail returns basic factual detail without enqueueing a wasteful provider request.
- A completed historical cache miss enqueues only canonical match ID and returns HTTP 202 `detail_pending` with `Retry-After`; scheduled/non-terminal matches never enqueue detail work.
- Duplicate owner requests coalesce into one queue item.
- Worker resolves the provider fixture ID server-side, batches up to 20 queue items, writes details, and marks queue items completed only after cache publication.
- Missing normal quota leaves the item pending with `quota_deferred`; provider failure records retry metadata and does not erase cached detail.
- Browser/API payloads never include API key, provider URL, raw response, or fixture ID.

**Red command:**

```text
pnpm exec vitest run apps/api/src/repositories/match-detail-refresh-queue.test.ts apps/api/src/routes/match-detail.test.ts apps/worker/src/jobs/api-football-match-detail-job.test.ts apps/worker/src/index.test.ts
```

Expected: FAIL because the route currently returns an empty synthetic detail and there is no refresh queue/job.

**Implementation:**

- Add an atomic provider-neutral queue under `<dataRoot>/match-detail-refresh/`; queue keys are canonical match IDs and never provider IDs.
- Route order: find match -> return cached detail -> for scheduled match return basic unavailable-yet detail -> otherwise enqueue and return 202.
- Worker heartbeat drains due queue items through the shared ledger/client, resolves provider links from server-side serving/warehouse data, chunks at 20, and upserts normalized cache files.
- Use bounded retries with next-at timestamps; unavailable coverage becomes a terminal cached warning, while transient provider/quota failures remain retryable.
- Do not make the API route import or instantiate API-Football provider code.

**Green verification:**

```text
pnpm exec vitest run apps/api/src/repositories/match-detail-refresh-queue.test.ts apps/api/src/routes/match-detail.test.ts apps/worker/src/jobs/api-football-match-detail-job.test.ts apps/worker/src/index.test.ts
pnpm run typecheck
git diff --check
```

**Slice exit:** Queue/cache/security tests pass; commit `feat: lazy-refresh historical match detail`.

---

## Slice 8: Render Basic Betting Context Without Betting Advice

**Files:**

- Create: `apps/web/src/services/match-detail-service.ts`
- Create: `apps/web/src/services/match-detail-service.test.ts`
- Modify: `apps/web/src/shell-entry.ts`
- Modify: `apps/web/src/production-shell.test.ts`
- Modify: `apps/web/src/locales/en.json`
- Modify: `apps/web/src/locales/vi.json`
- Modify: `apps/web/src/services/i18n-service.test.ts`
- Modify: `packages/ui/src/index.css`

**Failing tests:**

- Service validates 200 detail, represents 202 pending, and rejects malformed/provider-leaking payloads.
- Info tab renders competition/round, kickoff/status/elapsed, venue/referee, score breakdown, and home/away rows for corners, cards, shots, shots on target, and possession.
- Timeline renders goal minute + stoppage, scorer/assist, own-goal/penalty label, yellow/red card, missed penalty, and substitution.
- Null coverage renders localized `Không có dữ liệu`/`Unavailable`, not zero.
- Pending detail renders localized refresh state and retries with a bounded timer; navigation away cancels retry.
- EN/VI catalogs retain exact key parity.
- UI contains no pick, recommendation, confidence, xG, stake, Kelly, ROI, or CLV output.

**Red command:**

```text
pnpm exec vitest run apps/web/src/services/match-detail-service.test.ts apps/web/src/production-shell.test.ts apps/web/src/services/i18n-service.test.ts
```

Expected: FAIL because detail fetching/rendering is inline, English-only, and lacks statistics/pending states.

**Implementation:**

- Move HTTP/validation into `match-detail-service.ts` with typed `ready | pending | unavailable` view states.
- Render one compact summary card, one two-column team-stat table, and one chronological event list. Keep Bets as the existing separate detail tab.
- Escape every provider-supplied label and preserve keyboard/focus behavior.
- Add responsive/OLED styles only to the existing UI stylesheet; do not add a fifth tab or new primary navigation.
- Use catalog translations for every new status, statistic, empty state, and retry message.

**Green verification:**

```text
pnpm exec vitest run apps/web/src/services/match-detail-service.test.ts apps/web/src/production-shell.test.ts apps/web/src/services/i18n-service.test.ts
pnpm run pwa:verify
pnpm run typecheck
git diff --check
```

**Slice exit:** Detail service/UI/i18n/PWA tests pass; commit `feat: show basic factual match context`.

---

## Slice 9: Prove The Corrected Large Boundary

**Files:**

- Modify: `tests/integration/api-football-rapid-match-source.test.ts`
- Create: `tests/integration/api-football-quota-resume.test.ts`
- Create: `tests/integration/api-football-match-detail.test.ts`
- Modify: `package.json`
- Modify: `apps/api/data/serving/README.md`
- Modify: `docs/decisions/ADR-0047-api-football-rapid-match-ingestion.md`
- Modify: `PROJECT_PLAN.md`

**Failing integration tests:**

- Three limited hydration runs retain all three seasons for every test competition and expose stable competition/match IDs.
- Daily sync preserves history; a 21-match smart window publishes two chunks and retains unrelated fixtures.
- Worker restart shares quota state, makes one daily sync, respects 10/minute, and never exceeds normal ceiling 85.
- Club and national-team registry entries both reach the serving store without core branching.
- Terminal `FT`/`AET`/`PEN` polling writes match detail; a completed historical cache miss goes 202 -> worker refresh -> 200 cached detail with no second provider call.
- Extra-time and penalty fixtures remain eligible after +115 minutes; terminal fixtures stop immediately.
- Provider/key/fixture IDs never appear in public match-detail payloads.

**Red command:**

```text
pnpm exec vitest run tests/integration/api-football-rapid-match-source.test.ts tests/integration/api-football-quota-resume.test.ts tests/integration/api-football-match-detail.test.ts
```

Expected: at least one integration test remains red until every preceding slice is wired.

**Implementation and documentation closeout:**

- Wire all API-Football integration tests into `api-football:integration`.
- Update serving README with exact local flow, cache/queue locations, free-plan limits, one-daily-sync rule, hydration ordering, and safe CLI commands.
- Amend ADR-0047 language from hard SLA to owner-approved best-effort SLO and document terminal-only publication plus lazy completed-history detail.
- Update `PROJECT_PLAN.md` only after the full gates pass; do not mark staging, owner feedback, or production approved.

**Large-boundary verification:**

```text
pnpm run api-football:verify
pnpm run api-football:integration
pnpm run verify:product-boundary
pnpm run verify:local
pnpm run test:integration
git diff --check
```

Expected: all commands PASS. This is local integration evidence only.

**Slice exit:** Commit `test: verify corrected API-Football boundary`.

---

## Safe Bootstrap Procedure After Implementation And Local Integration

Do not execute these commands during the implementation-plan phase. They become valid only after Slice 9 passes and the owner explicitly starts staging/live-key smoke.

```powershell
Copy-Item .env.example .env
notepad .env
pnpm run verify:release
pnpm run api-football:quota-status
```

First contained smoke against a non-serving data root:

```powershell
pnpm run data:seed:api-football -- --competition=eng-premier-league --season=2024 --limit=1 --data-root C:\CODE\miraichi\.cache\api-football-smoke
```

After smoke evidence and owner staging approval, a Free-plan key may hydrate only an explicitly entitled historical season per quiet provider day:

```powershell
pnpm run data:seed:api-football -- --season=2024 --limit=50
```

This correction follows live evidence from 2026-08-26: the Free plan rejected season 2026 and directed use of seasons 2022-2024. A rejected request still consumed quota. Current-season hydration, daily sync, smart-window polling, and detail work therefore require a provider plan with current-season access; the Free-plan 100-request allowance alone is insufficient.

## Plan Exit Gate

This implementation plan is complete when every slice above names exact files, an observable red test, minimal implementation behavior, focused green verification, and a commit boundary. Starting Slice 1 still requires the explicit `phase:code-slice` transition; this document does not authorize staging or production.
