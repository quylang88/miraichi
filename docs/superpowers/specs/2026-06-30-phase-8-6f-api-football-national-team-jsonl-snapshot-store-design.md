# Phase 8.6F API-Football National-Team JSONL Snapshot Store Design Spec

* **Status**: Proposed
* **Date**: 2026-06-30
* **Phase**: 8.6F API-Football National-Team JSONL Snapshot Store
* **Audience**: Owner, Planner Agent, Architect Agent, Backend Agent, AI/Data Agent, QA Agent

---

## 1. Ket Luan Thang

Miraichi should add a local, raw-first API-Football snapshot store using SQL-shaped JSONL files before any new normalized training dataset work.

This phase must cover national-team competitions only, in this owner-approved priority order:

1. World Cup
2. Euro
3. Copa America
4. AFCON
5. AFC Asian Cup
6. CONCACAF Gold Cup
7. UEFA Nations League

For the World Cup, include the active 2026 tournament first, but only fixtures that API-Football reports as terminal/completed. Live fixtures, scheduled fixtures, odds, predictions, and betting recommendations remain out of scope.

---

## 2. Context

The owner requested a local API-backed cache/store that avoids repeatedly calling the external provider and preserves every raw provider payload for later local AI analysis.

Current repo facts:

* Phase 8 is active.
* Phase 8.6E already added backend-mediated API-Football matchday data behind `/api/v1/matches`.
* The current API route cache is in-memory and short-lived, so it does not satisfy persistent snapshot requirements.
* `apps/local-ai/config/competition-registry.json` contains seven enabled national-team competitions.
* The registry currently uses internal competition ids and `soccerdata_league` keys. It does not contain verified API-Football league ids.
* ADR-0035 accepts a hybrid provider strategy for owner-only free-tier development.
* ADR-0037 requires raw provider snapshots to remain separate from normalized records and derived feature datasets.
* ADR-0039 requires provider payload validation and dead-letter evidence before normalized dataset use.

External source checks used for this planning boundary:

* API-Football documentation v3: <https://www.api-football.com/documentation-v3>
* API-Football one-league fixture tutorial: <https://www.api-football.com/news/post/how-to-get-all-fixtures-data-from-one-league>
* API-Football pricing: <https://www.api-football.com/pricing>
* API-Football rate-limit note: <https://www.api-football.com/news/post/how-ratelimit-works>
* FIFA World Cup 2026 official page: <https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026>

As of 2026-06-30 in the project timezone context, World Cup 2026 is treated as an active tournament. This phase must therefore avoid claiming that the 2026 snapshot is complete. It may only snapshot provider-terminal fixtures available at fetch time.

---

## 3. Goals

1. Design a persistent local JSONL snapshot store for API-Football raw payloads.
2. Shape JSONL files like future SQL tables: stable ids, foreign-key-like references, run manifests, request manifests, and indexes.
3. Preserve full raw API-Football payloads before normalization.
4. Crawl national-team competitions in a quota-safe order from newest season backward.
5. Add World Cup 2026 completed fixtures before older World Cup seasons.
6. Keep provider ids in registry/config artifacts, not parser logic.
7. Keep raw snapshots separate from processed training JSONL/CSV outputs.
8. Support future Postgres migration without changing record semantics.

---

## 4. Non-Goals

* No club competitions.
* No all-leagues crawl.
* No live polling or live fixture ingestion in this phase.
* No odds endpoints.
* No prediction runtime, model selection, recommendation labels, stake advice, bankroll advice, ROI, CLV, or Kelly logic.
* No production database, ORM, migrations, D1, Supabase, Postgres, or cloud storage.
* No committed API key, secret, or paid provider config.
* No direct training from raw provider payloads.
* No overwrite-only raw storage that loses provider history.

---

## 5. Options Considered

### Option A: Keep Only In-Memory API Cache

This is too weak. It reduces reload requests but loses all data on process restart and cannot support reproducible local AI datasets.

### Option B: JSONL Raw Snapshot Store With SQL-Shaped Indexes

This is the recommended option. It keeps implementation light, preserves raw provider evidence, and creates records that can map cleanly to future SQL tables.

### Option C: Start With SQLite/Postgres

This is premature. It creates database schema, migrations, and persistence decisions before the provider payload shape and crawl strategy are proven.

Decision: **Option B**.

---

## 6. Competition And Season Priority

The snapshot scheduler should process competitions in this order:

| Priority | Internal Competition ID | Seasons, newest first |
| --- | --- | --- |
| 1 | `comp-int-world-cup` | `2026`, `2022`, `2018`, `2014`, `2010`, `2006`, `2002` |
| 2 | `comp-int-euro` | `2024`, `2020`, `2016`, `2012`, `2008`, `2004`, `2000` |
| 3 | `comp-int-copa-america` | `2024`, `2021`, `2019`, `2016`, `2015`, `2011`, `2007` |
| 4 | `comp-int-afcon` | `2023`, `2021`, `2019`, `2017`, `2015`, `2013`, `2012`, `2010` |
| 5 | `comp-int-afc-asian-cup` | `2023`, `2019`, `2015`, `2011` |
| 6 | `comp-int-concacaf-gold-cup` | `2023`, `2021`, `2019`, `2017`, `2015`, `2013`, `2011`, `2009` |
| 7 | `comp-int-uefa-nations-league` | `2024`, `2022`, `2020`, `2018` |

World Cup 2026 is intentionally added ahead of the existing registry seasons. It must be marked `active_season` and `partial_snapshot` until the tournament is over and a later recheck confirms the final set.

---

## 7. Provider Discovery And Mapping

Do not hard-code API-Football league ids in TypeScript source.

Implementation should introduce a local provider mapping artifact and treat unknown provider ids as blockers, not guesses:

```text
apps/local-ai/data/provider-snapshots/api-football/registry/competition_mappings.jsonl
apps/local-ai/data/provider-snapshots/api-football/registry/season_mappings.jsonl
```

Each `competition_mappings.jsonl` record should contain:

```json
{
  "internalCompetitionId": "comp-int-world-cup",
  "providerId": "api-football",
  "providerCompetitionId": "api-football-league-unknown",
  "providerLeagueId": null,
  "providerLeagueName": "FIFA World Cup",
  "providerCountry": "World",
  "verificationStatus": "unverified",
  "verifiedAt": null,
  "source": "owner_or_provider_discovery"
}
```

Only records with `verificationStatus: "verified"` may be used by the snapshot fetcher. The first implementation can either:

* use owner-supplied verified API-Football league ids; or
* run a separate discovery command against API-Football league metadata and write evidence before fetching fixtures.

If a competition id cannot be verified, the fetcher must skip that competition and record a clear blocker in the run manifest.

---

## 8. Storage Layout

Recommended local layout:

```text
apps/local-ai/data/provider-snapshots/api-football/
  README.md
  manifests/
    ingestion_runs.jsonl
    request_batches.jsonl
  registry/
    competition_mappings.jsonl
    season_mappings.jsonl
  raw/
    fixtures_by_league_season/
      competition=comp-int-world-cup/
        season=2026.jsonl
        season=2022.jsonl
    fixtures_by_ids/
      competition=comp-int-world-cup/
        season=2026.jsonl
        season=2022.jsonl
    dead_letter/
      validation_errors.jsonl
  indexes/
    fixtures_index.jsonl
    raw_payload_index.jsonl
  reports/
    snapshot_quality_report.json
```

Generated full raw payload files should be local artifacts by default, not automatically committed to git. The implementation plan should decide whether to update `.gitignore` for generated raw provider snapshots. Commit schema docs, tests, small fixtures, and reports; do not commit large provider payloads unless the owner explicitly accepts the storage and licensing tradeoff.

---

## 9. SQL-Shaped JSONL Tables

### 9.1 `ingestion_runs.jsonl`

One row per snapshot run.

Required fields:

```text
runId
providerId
startedAt
finishedAt
status
requestedCompetitionOrder
requestedSeasonOrder
requestCount
fixtureCount
completedFixtureCount
skippedCompetitionCount
errorCount
quotaLimit
quotaRemainingAtEnd
```

### 9.2 `request_batches.jsonl`

One row per external API request.

Required fields:

```text
requestBatchId
runId
providerId
endpoint
requestUrlRedacted
requestParams
startedAt
finishedAt
httpStatus
rateLimitRemaining
responsePayloadHash
rawPayloadId
recordCount
status
errorCode
```

### 9.3 `raw_payload_index.jsonl`

One row per raw payload written.

Required fields:

```text
rawPayloadId
runId
requestBatchId
providerId
endpoint
payloadHash
payloadPath
fetchedAt
byteSize
schemaVersion
```

### 9.4 `fixtures_index.jsonl`

One row per latest known fixture state. This is an index over raw payload history, not the raw payload itself.

Required fields:

```text
internalFixtureId
providerFixtureId
providerId
internalCompetitionId
providerCompetitionId
seasonId
providerSeason
statusShort
statusLong
fixtureDate
homeTeamProviderId
awayTeamProviderId
latestRawPayloadId
latestPayloadHash
snapshotStability
firstSeenAt
lastSeenAt
```

`snapshotStability` values:

* `active_partial`
* `completed_unverified`
* `completed_rechecked`
* `finalized`

World Cup 2026 terminal fixtures should start as `completed_unverified` unless the implementation performs a later recheck window.

---

## 10. ID Rules

Use stable string ids that can later become SQL primary keys:

```text
runId                 = api_football_run_YYYYMMDDTHHMMSSZ_<shortHash>
requestBatchId        = api_football_request_<runShortHash>_<sequence>
rawPayloadId          = api_football_raw_<sha256>
internalCompetitionId = existing registry id, e.g. comp-int-world-cup
providerCompetitionId = api_football_league_<leagueId>
seasonId              = <internalCompetitionId>_season_<season>
providerFixtureId     = api_football_fixture_<fixtureId>
internalFixtureId     = <internalCompetitionId>_<season>_api_football_fixture_<fixtureId>
payloadHash           = sha256 of canonical JSON payload bytes
```

Never derive fixture identity from team names, dates, scores, or round labels.

---

## 11. Fetch Strategy

API-Football should be queried by verified league and season. For completed-only historical snapshots:

```text
GET /fixtures?league=<leagueId>&season=<season>&status=FT-AET-PEN
```

For fixture-detail snapshots after fixture ids are known:

```text
GET /fixtures?ids=<up to 20 fixture ids>
```

The implementation must not assume one request returns every competition. API-Football should be treated as a provider API, not a bulk data dump.

Quota-safe scheduler behavior:

* Use newest season first.
* Use competition priority order before lower-priority competitions.
* Stop when local daily quota reserve is reached.
* Resume from manifests on the next run.
* Use throttling below the free-tier rate limit.
* Persist every request result or structured failure.
* Redact provider key and auth headers from all artifacts.

World Cup 2026 behavior:

* Include `2026` as the first World Cup season.
* Fetch terminal/completed fixtures only.
* Do not snapshot live fixtures in this phase.
* Do not mark the 2026 season complete while the tournament is active.
* Allow later reruns to append newly completed fixtures.

---

## 12. Raw Payload Policy

Raw payloads must be stored before validation and normalization.

Each raw line should include both envelope metadata and the full provider response body:

```json
{
  "rawPayloadId": "api_football_raw_<sha256>",
  "runId": "api_football_run_20260630T000000Z_ab12cd34",
  "requestBatchId": "api_football_request_ab12cd34_0001",
  "providerId": "api-football",
  "endpoint": "fixtures",
  "requestParams": {
    "league": 1,
    "season": 2026,
    "status": "FT-AET-PEN"
  },
  "fetchedAt": "2026-06-30T00:00:00.000Z",
  "payloadHash": "sha256...",
  "rawPayload": {}
}
```

If validation fails, preserve the raw payload and write a dead-letter row. Do not silently discard malformed provider data.

---

## 13. Data Flow

```text
verified competition mapping
  -> prioritized season queue
  -> quota guard
  -> API-Football request
  -> raw JSONL payload append
  -> request manifest append
  -> fixture index update
  -> quality report
```

Processed training artifacts remain a later phase:

```text
raw provider snapshot
  -> validation/normalization
  -> normalized match records
  -> chronological train/val/test dataset
```

This phase ends at raw snapshot plus index/report. It does not build new model features.

---

## 14. Error Handling

| Situation | Required Behavior |
| --- | --- |
| Missing `API_FOOTBALL_KEY` | Stop before network calls; record blocked status only if a run manifest is created |
| Unverified provider league id | Skip competition and record blocker |
| Quota exhausted | Stop cleanly with resumable manifest |
| Rate limited | Back off, record request status, do not spin |
| Provider HTTP error | Record failed request batch with redacted URL and status |
| Invalid provider payload | Store raw payload and write dead-letter validation row |
| Duplicate payload hash | Do not append duplicate raw payload; update manifest/index references |
| World Cup 2026 future/live fixture returned unexpectedly | Exclude from completed snapshot index; optionally record warning |

---

## 15. Verification Requirements

The implementation plan should require focused tests for:

* ID generation determinism.
* SQL-shaped JSONL record validation.
* provider mapping verification gating.
* season priority order, including World Cup 2026 first.
* completed-only status filtering.
* raw payload hash de-duplication.
* request manifest append behavior.
* quota stop/resume behavior.
* dead-letter row creation.
* no API key in generated artifacts.

Expected local checks after implementation:

```bash
pnpm exec vitest run apps/local-ai/src apps/api/src/providers apps/api/src/services scripts
pnpm run typecheck
pnpm run verify:lifecycle
git diff --check
```

If the implementation completes a full provider snapshot boundary, run:

```bash
pnpm run verify:local
```

Manual provider smoke requires a local `API_FOOTBALL_KEY` and must not record or expose the key.

---

## 16. Exit Criteria

Phase 8.6F planning is complete when:

1. This design is owner-reviewed.
2. The owner accepts the national-team-only priority order and World Cup 2026 completed-only rule.
3. The raw-first SQL-shaped JSONL storage design is accepted.
4. The next implementation plan can break the work into TDD slices without adding predictions, odds, betting logic, club competitions, or production database schema.

Implementation of Phase 8.6F is complete only when a later implementation plan and code slices produce:

1. local snapshot schema/docs;
2. provider mapping gating;
3. quota-safe snapshot runner;
4. raw payload JSONL writer;
5. fixture index writer;
6. dead-letter writer;
7. quality report;
8. tests and verification evidence.

---

## 17. Recommended Next Lifecycle Command

After owner review of this spec:

```text
phase:implementation-plan Phase 8.6F API-Football National-Team JSONL Snapshot Store
```

Do not start club expansion, all-league crawling, live polling, odds integration, model training, or production database work from this phase.

