# Phase 9 API-Football Removal and Local Data API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove API-Football free-tier runtime dependency completely and replace it with a local national-team match data API that can run without provider keys. The app must keep the non-AI match workflows usable while AI training remains deferred to the final phase.

**Architecture:** API reads a checked-in or manually generated JSON snapshot through a repository layer, exposes match feed/detail/snapshot status routes, and returns shared local-data contracts. Web consumes those contracts and removes all API-Football-specific IDs, error states, copy, and detail URL behavior. Manual data update is a controlled local script, not live scraping.

**Tech Stack:** TypeScript, Fastify API, React/Vite web shell, Vitest, pnpm workspace scripts, JSON snapshot files under `apps/api/data/local-match-snapshots/`.

---

## Current State

- `apps/api/src/providers/api-football-client.ts` is the active provider and requires `API_FOOTBALL_KEY` unless tests use mock config.
- `apps/api/src/routes/matches.ts` fetches `/fixtures` from API-Football, uses quota/cache services, and returns `sourceProviderId: 'api-football'`.
- `apps/api/src/routes/match-detail.ts` accepts IDs with `api-football-fixture-` and silently falls back to mock provider config when the key is missing.
- Web services and shell components still expose API-Football concepts: `providerFixtureId`, `sourceProviderId: 'api-football'`, provider setup copy, and detail IDs prefixed with `api-football-fixture-`.
- `scripts/test-endpoints.ts` asserts IDs start with `api-football-fixture-`.
- `.env.example` still advertises `API_FOOTBALL_KEY` and `API_FOOTBALL_DAILY_LIMIT`.

## Non-Goals

- No live match polling.
- No AI training, AI runtime, or MiraiChi AI tab work.
- No API-Football free-tier usage, fallback, mock fallback, or env variable.
- No production cloud database migration in this slice.
- No odds provider, betting automation, or paid data-provider integration.
- No SofaScore scraping implementation in this slice. SofaScore can be evaluated later, but this plan must not hard-code reliance on scraping endpoints that may violate terms or break without notice.

## Data Source Decision

Use a local snapshot first.

Accepted sources for manual snapshot construction:

- OpenFootball World Cup and Euro repositories as primary public structured seeds.
- Manual corrections or additions captured in snapshot metadata.
- Optional future ingestion from football-data.org or SofaScore-exported/manual data only after a separate legal/technical review.

Required initial scope:

- National team matches only.
- World Cup 2026 first.
- Euro historical coverage next.
- Past completed and future scheduled fixtures only.
- Status values must exclude live/in-play states.

---

## File Structure Map

Create or modify these files:

```text
packages/shared/src/contracts/local-match-contracts.ts
packages/shared/src/contracts/local-match-contracts.test.ts
packages/shared/src/contracts/index.ts

apps/api/src/repositories/local-match-snapshot-repository.ts
apps/api/src/repositories/local-match-snapshot-repository.test.ts
apps/api/src/routes/matches.ts
apps/api/src/routes/matches.test.ts
apps/api/src/routes/match-detail.ts
apps/api/src/routes/match-detail.test.ts
apps/api/src/routes/data-snapshot-status.ts
apps/api/src/routes/data-snapshot-status.test.ts
apps/api/src/index.ts
apps/api/data/local-match-snapshots/README.md
apps/api/data/local-match-snapshots/national-team-matches.seed.json
apps/api/data/local-match-snapshots/national-team-matches.json

apps/web/src/services/match-feed-service.ts
apps/web/src/services/match-feed-service.test.ts
apps/web/src/components/app-shell.ts
apps/web/src/production-shell.test.ts
apps/web/src/shell-entry.ts

scripts/update-national-team-data.ts
scripts/update-national-team-data.test.ts
scripts/test-endpoints.ts

.env.example
package.json
```

Delete these files after replacements are tested:

```text
apps/api/src/providers/api-football-client.ts
apps/api/src/providers/api-football-client.test.ts
```

---

## Task 1: Add Shared Local Match Contracts

**Purpose:** Establish provider-neutral contracts before changing API or web behavior.

**Files:**

- Create `packages/shared/src/contracts/local-match-contracts.ts`
- Create `packages/shared/src/contracts/local-match-contracts.test.ts`
- Modify `packages/shared/src/contracts/index.ts`

### Tests First

- [ ] Add `packages/shared/src/contracts/local-match-contracts.test.ts`.

Test cases:

- Valid scheduled World Cup 2026 fixture passes.
- Valid completed Euro fixture with score passes.
- `sourceProviderId: 'api-football'` is not a valid field in the new contract.
- `providerFixtureId` is not a valid field in the new contract.
- `status: 'in_play'` fails because Phase 9 has no live data.
- Snapshot status validates `generatedAt`, `matchCount`, `competitions`, and `sources`.

Expected test command:

```powershell
pnpm exec vitest run packages/shared/src/contracts/local-match-contracts.test.ts
```

Expected failing reason before implementation:

```text
Cannot find module './local-match-contracts'
```

### Implementation

- [ ] Define local data source IDs:

```ts
export type LocalDataSourceId =
  | 'openfootball'
  | 'sofascore-local'
  | 'football-data-org'
  | 'international-results'
  | 'manual-snapshot';
```

- [ ] Define match status without live states:

```ts
export type LocalMatchStatus =
  | 'scheduled'
  | 'completed'
  | 'postponed'
  | 'cancelled'
  | 'unknown';
```

- [ ] Define match contracts:

```ts
export interface LocalMatchScore {
  home: number | null;
  away: number | null;
}

export interface LocalMatchSourceRef {
  sourceId: LocalDataSourceId;
  sourceMatchId?: string;
  sourceUrl?: string;
  importedAt: string;
}

export interface LocalCompetitionRef {
  id: string;
  name: string;
  type: 'national-team';
  season: string;
}

export interface LocalTeamRef {
  id: string;
  name: string;
  countryCode?: string;
}

export interface LocalMatch {
  id: string;
  competition: LocalCompetitionRef;
  kickoffUtc: string;
  status: LocalMatchStatus;
  homeTeam: LocalTeamRef;
  awayTeam: LocalTeamRef;
  score: LocalMatchScore;
  venue?: string;
  round?: string;
  stage?: string;
  neutralVenue?: boolean;
  sourceRefs: LocalMatchSourceRef[];
  updatedAt: string;
}
```

- [ ] Define detail/event/snapshot contracts:

```ts
export interface LocalMatchEvent {
  minute: number | null;
  teamId?: string;
  type: 'goal' | 'card' | 'substitution' | 'penalty' | 'other';
  label: string;
}

export interface LocalMatchDetail {
  match: LocalMatch;
  referee?: string;
  events: LocalMatchEvent[];
  notes: string[];
}

export interface LocalDataSnapshotStatus {
  snapshotId: string;
  generatedAt: string;
  importedAt: string;
  matchCount: number;
  competitions: Array<{
    id: string;
    name: string;
    seasons: string[];
    matchCount: number;
  }>;
  sources: LocalMatchSourceRef[];
  freshness: 'fresh' | 'stale' | 'missing';
  warnings: string[];
}

export interface LocalMatchFeedResponse {
  matches: LocalMatch[];
  snapshot: LocalDataSnapshotStatus;
}
```

- [ ] Add runtime validators that return `{ ok: true }` or `{ ok: false; errors: string[] }`:

```ts
export type ValidationResult =
  | { ok: true }
  | { ok: false; errors: string[] };
```

Required validator behavior:

- `validateLocalMatch(input: unknown): ValidationResult`
- `validateLocalMatchFeedResponse(input: unknown): ValidationResult`
- `validateLocalDataSnapshotStatus(input: unknown): ValidationResult`

Validation must reject:

- Missing `id`
- Invalid ISO datetime in `kickoffUtc`, `updatedAt`, `generatedAt`, or `importedAt`
- `sourceProviderId`
- `providerFixtureId`
- `status: 'in_play'`
- Non-national-team competition type
- Completed match with null score

- [ ] Export contracts from `packages/shared/src/contracts/index.ts`.

### Verification

- [ ] Run:

```powershell
pnpm exec vitest run packages/shared/src/contracts/local-match-contracts.test.ts
```

- [ ] Confirm there are no API-Football strings in new contract files:

```powershell
rg "api-football|API_FOOTBALL|providerFixtureId|sourceProviderId" packages/shared/src/contracts
```

Expected: no matches in `local-match-contracts.ts`; test file may contain negative assertions only.

---

## Task 2: Replace API Match Feed With Local Snapshot Repository

**Purpose:** Make `/api/v1/matches` work without API-Football keys or network access.

**Files:**

- Create `apps/api/src/repositories/local-match-snapshot-repository.ts`
- Create `apps/api/src/repositories/local-match-snapshot-repository.test.ts`
- Modify `apps/api/src/routes/matches.ts`
- Modify `apps/api/src/routes/matches.test.ts`
- Create `apps/api/data/local-match-snapshots/national-team-matches.json`

### Tests First

- [ ] Add repository tests.

Test cases:

- Loads snapshot JSON from explicit path.
- Returns World Cup 2026 matches before older competitions when no date filter is provided.
- Filters by `date=YYYY-MM-DD`.
- Filters by `competitionId`.
- Filters by `status=scheduled` or `status=completed`.
- Rejects malformed snapshot with validation errors.
- Does not require `API_FOOTBALL_KEY`.

- [ ] Rewrite `apps/api/src/routes/matches.test.ts`.

API route test cases:

- `GET /api/v1/matches` returns `200`, `matches`, and `snapshot`.
- Response contains no `quota` object.
- Response contains no `cache` object.
- Response contains no `sourceProviderId`.
- Response contains no `providerFixtureId`.
- `GET /api/v1/matches?date=2026-06-11` returns only matches on that UTC date.
- `GET /api/v1/matches?status=in_play` returns `400` with `code: 'unsupported_match_status'`.
- Missing snapshot returns `503` with `code: 'local_snapshot_missing'`.

Expected failing commands before implementation:

```powershell
pnpm exec vitest run apps/api/src/repositories/local-match-snapshot-repository.test.ts apps/api/src/routes/matches.test.ts
```

Expected failing reasons:

```text
Cannot find module '../repositories/local-match-snapshot-repository'
Expected response not to have property 'quota'
```

### Seed Snapshot

- [ ] Create `apps/api/data/local-match-snapshots/national-team-matches.json`.

The seed must be small but real enough to keep local API and web shell working:

```json
{
  "snapshotId": "national-team-seed-2026-07-01",
  "generatedAt": "2026-07-01T00:00:00.000Z",
  "importedAt": "2026-07-01T00:00:00.000Z",
  "sources": [
    {
      "sourceId": "openfootball",
      "sourceUrl": "https://github.com/openfootball/worldcup",
      "importedAt": "2026-07-01T00:00:00.000Z"
    },
    {
      "sourceId": "openfootball",
      "sourceUrl": "https://github.com/openfootball/euro",
      "importedAt": "2026-07-01T00:00:00.000Z"
    },
    {
      "sourceId": "manual-snapshot",
      "sourceMatchId": "phase-9-seed",
      "importedAt": "2026-07-01T00:00:00.000Z"
    }
  ],
  "matches": [
    {
      "id": "match-world-cup-2026-group-a-mexico-south-africa-2026-06-11",
      "competition": {
        "id": "world-cup-2026",
        "name": "FIFA World Cup",
        "type": "national-team",
        "season": "2026"
      },
      "kickoffUtc": "2026-06-11T19:00:00.000Z",
      "status": "scheduled",
      "homeTeam": {
        "id": "national-team-mexico",
        "name": "Mexico",
        "countryCode": "MEX"
      },
      "awayTeam": {
        "id": "national-team-south-africa",
        "name": "South Africa",
        "countryCode": "RSA"
      },
      "score": {
        "home": null,
        "away": null
      },
      "venue": "Estadio Azteca",
      "round": "Group A",
      "stage": "group",
      "neutralVenue": false,
      "sourceRefs": [
        {
          "sourceId": "openfootball",
          "sourceMatchId": "2026/group-a/mexico-south-africa",
          "sourceUrl": "https://github.com/openfootball/worldcup",
          "importedAt": "2026-07-01T00:00:00.000Z"
        }
      ],
      "updatedAt": "2026-07-01T00:00:00.000Z"
    },
    {
      "id": "match-euro-2024-final-spain-england-2024-07-14",
      "competition": {
        "id": "euro-2024",
        "name": "UEFA Euro",
        "type": "national-team",
        "season": "2024"
      },
      "kickoffUtc": "2024-07-14T19:00:00.000Z",
      "status": "completed",
      "homeTeam": {
        "id": "national-team-spain",
        "name": "Spain",
        "countryCode": "ESP"
      },
      "awayTeam": {
        "id": "national-team-england",
        "name": "England",
        "countryCode": "ENG"
      },
      "score": {
        "home": 2,
        "away": 1
      },
      "venue": "Olympiastadion Berlin",
      "round": "Final",
      "stage": "final",
      "neutralVenue": true,
      "sourceRefs": [
        {
          "sourceId": "openfootball",
          "sourceMatchId": "2024/final/spain-england",
          "sourceUrl": "https://github.com/openfootball/euro",
          "importedAt": "2026-07-01T00:00:00.000Z"
        }
      ],
      "updatedAt": "2026-07-01T00:00:00.000Z"
    }
  ]
}
```

### Repository Implementation

- [ ] Implement `LocalMatchSnapshotRepository`.

Required API:

```ts
export interface LocalMatchSnapshotQuery {
  date?: string;
  competitionId?: string;
  status?: LocalMatchStatus;
}

export interface LocalMatchSnapshot {
  snapshotId: string;
  generatedAt: string;
  importedAt: string;
  sources: LocalMatchSourceRef[];
  matches: LocalMatch[];
}

export class LocalMatchSnapshotRepository {
  constructor(options?: { snapshotPath?: string; now?: () => Date });

  loadSnapshot(): Promise<LocalMatchSnapshot>;

  listMatches(query?: LocalMatchSnapshotQuery): Promise<LocalMatchFeedResponse>;

  findById(id: string): Promise<LocalMatch | null>;

  getStatus(): Promise<LocalDataSnapshotStatus>;
}
```

Path resolution:

- `LOCAL_MATCH_SNAPSHOT_PATH` env wins if set.
- Constructor `snapshotPath` wins in tests.
- Default path is `apps/api/data/local-match-snapshots/national-team-matches.json` resolved from repo root or `process.cwd()`.

Freshness rule:

- `fresh` if generated within the last 7 days.
- `stale` if generated older than 7 days.
- `missing` only when file cannot be read.

Sorting rule:

- Upcoming scheduled matches first by kickoff ascending.
- Completed matches after scheduled matches by kickoff descending.
- World Cup 2026 must naturally appear first in the initial seed because it is scheduled and future-dated.

### Route Implementation

- [ ] Replace `apps/api/src/routes/matches.ts` API-Football loading with repository loading.

Route behavior:

- Accept `date`, `competitionId`, `status`.
- Reject invalid `date` with `400` and `code: 'invalid_date'`.
- Reject `status=in_play` or unknown status with `400` and `code: 'unsupported_match_status'`.
- Return `503` and `code: 'local_snapshot_missing'` if snapshot missing.
- Return `500` and `code: 'local_snapshot_invalid'` if validation fails.
- Return `LocalMatchFeedResponse` on success.

- [ ] Remove imports from:

```ts
../providers/api-football-client
../services/matchday-cache
```

Do not delete `matchday-cache` yet in this task unless no other code imports it. Removal can happen in Task 6.

### Verification

- [ ] Run:

```powershell
pnpm exec vitest run apps/api/src/repositories/local-match-snapshot-repository.test.ts apps/api/src/routes/matches.test.ts
```

- [ ] Confirm the route no longer references API-Football:

```powershell
rg "api-football|API_FOOTBALL|providerFixtureId|sourceProviderId|quota|x-apisports-key" apps/api/src/routes/matches.ts apps/api/src/routes/matches.test.ts apps/api/src/repositories
```

Expected: no matches, except negative assertions in tests if explicitly checking removal.

---

## Task 3: Replace Match Detail and Add Snapshot Status API

**Purpose:** Make detail loading and data health visible without provider fixture IDs.

**Files:**

- Modify `apps/api/src/routes/match-detail.ts`
- Modify `apps/api/src/routes/match-detail.test.ts`
- Create `apps/api/src/routes/data-snapshot-status.ts`
- Create `apps/api/src/routes/data-snapshot-status.test.ts`
- Modify `apps/api/src/index.ts`

### Tests First

- [ ] Rewrite match-detail tests.

Test cases:

- `GET /api/v1/matches/detail?id=match-world-cup-2026-group-a-mexico-south-africa-2026-06-11` returns `LocalMatchDetail`.
- Detail response has `match`, `events`, and `notes`.
- Detail response does not have `fixture`.
- Detail response does not have API-Football provider IDs.
- Missing `id` returns `400` and `code: 'match_id_required'`.
- `id=api-football-fixture-123` returns `400` and `code: 'legacy_provider_id_not_supported'`.
- Unknown local ID returns `404` and `code: 'match_not_found'`.

- [ ] Add snapshot status route tests.

Test cases:

- `GET /api/v1/data-snapshot/status` returns `LocalDataSnapshotStatus`.
- Status includes competition summary for `world-cup-2026` and `euro-2024`.
- Missing snapshot returns `503` and `freshness: 'missing'`.
- Invalid snapshot returns `500` and `code: 'local_snapshot_invalid'`.

Expected failing command:

```powershell
pnpm exec vitest run apps/api/src/routes/match-detail.test.ts apps/api/src/routes/data-snapshot-status.test.ts
```

Expected failing reasons:

```text
Expected code to be "legacy_provider_id_not_supported"
Cannot find module './data-snapshot-status'
```

### Implementation

- [ ] Replace `apps/api/src/routes/match-detail.ts` with repository-based lookup.

Required response shape:

```ts
const detail: LocalMatchDetail = {
  match,
  referee: undefined,
  events: [],
  notes: [
    'Local snapshot detail does not include live event telemetry.'
  ]
};
```

Rules:

- Do not call API-Football.
- Do not fall back to mock API-Football config.
- Reject IDs beginning with `api-football-fixture-`.
- Preserve stable route path `/api/v1/matches/detail`.

- [ ] Add `apps/api/src/routes/data-snapshot-status.ts`.

Required route:

```ts
server.get('/data-snapshot/status', async (_request, reply) => {
  const status = await repository.getStatus();
  return reply.send(status);
});
```

Use the same error mapping as the match feed route:

- Missing file: `503`, `code: 'local_snapshot_missing'`
- Invalid file: `500`, `code: 'local_snapshot_invalid'`

- [ ] Register route in `apps/api/src/index.ts` under `/api/v1`.

Expected route path:

```text
/api/v1/data-snapshot/status
```

### Verification

- [ ] Run:

```powershell
pnpm exec vitest run apps/api/src/routes/match-detail.test.ts apps/api/src/routes/data-snapshot-status.test.ts
```

- [ ] Run API route group:

```powershell
pnpm exec vitest run apps/api/src/repositories/local-match-snapshot-repository.test.ts apps/api/src/routes/matches.test.ts apps/api/src/routes/match-detail.test.ts apps/api/src/routes/data-snapshot-status.test.ts
```

---

## Task 4: Update Web Services and Shell to Local Data Contract

**Purpose:** Remove API-Football assumptions from the UI and make the four non-AI tabs consume local match IDs.

**Files:**

- Modify `apps/web/src/services/match-feed-service.ts`
- Modify `apps/web/src/services/match-feed-service.test.ts`
- Modify `apps/web/src/components/app-shell.ts`
- Modify `apps/web/src/production-shell.test.ts`
- Modify `apps/web/src/shell-entry.ts`

### Tests First

- [ ] Rewrite service tests.

Test cases:

- Ready state contains `LocalMatch[]` and `snapshot`.
- Empty state includes snapshot health.
- Unavailable state maps `local_snapshot_missing` to actionable local-data copy.
- Response with `sourceProviderId` fails normalization.
- Response with `providerFixtureId` fails normalization.
- No test expects `api_football_key_missing`.

- [ ] Rewrite shell tests.

Required UI expectations:

- Copy uses `Local data snapshot`, not `API-Football`.
- Setup copy says data update is required, not provider key setup.
- Match row uses `data-match-id`.
- No rendered DOM string contains `API-Football`, `api-football`, or `provider fixture`.
- Detail click calls `/api/v1/matches/detail?id=<local-match-id>`.
- Detail rendering handles `{ match, events, notes }`.
- National-team-only data does not pretend club matches are available.

Expected failing command:

```powershell
pnpm exec vitest run apps/web/src/services/match-feed-service.test.ts apps/web/src/production-shell.test.ts
```

Expected failing reasons:

```text
Expected text content not to contain "API-Football"
Expected fetch URL to include local match id
```

### Service Implementation

- [ ] Update `apps/web/src/services/match-feed-service.ts` to use shared local contracts.

Required state shape:

```ts
export type MatchFeedState =
  | {
      kind: 'ready';
      matches: LocalMatch[];
      snapshot: LocalDataSnapshotStatus;
    }
  | {
      kind: 'empty';
      matches: [];
      snapshot: LocalDataSnapshotStatus;
      message: string;
    }
  | {
      kind: 'unavailable';
      reason: string;
      code?: string;
      snapshot?: LocalDataSnapshotStatus;
    };
```

Error mapping:

- `local_snapshot_missing`: "Local match snapshot is missing. Run the national-team data update before using match workflows."
- `local_snapshot_invalid`: "Local match snapshot is invalid. Fix the snapshot file and rerun validation."
- `unsupported_match_status`: "This app does not support live match status in Phase 9."

- [ ] Remove any mention of:

```text
api_football_key_missing
API_FOOTBALL_KEY
sourceProviderId
providerFixtureId
```

### Shell Implementation

- [ ] Update match rendering in `apps/web/src/components/app-shell.ts`.

Required UI copy:

- `Local data snapshot`
- `Data update required`
- `Snapshot match`
- `Last imported`
- `Source refs`

Forbidden UI copy:

- `API-Football`
- `Provider setup required`
- `Provider fixture`
- `API_FOOTBALL_KEY`

- [ ] Replace `providerFixtureId` with `match.id`.

Required DOM attributes:

```tsx
data-match-id={match.id}
```

Remove:

```tsx
data-provider-fixture-id
```

- [ ] Update `apps/web/src/shell-entry.ts`.

Detail fetch must be:

```ts
fetch(`/api/v1/matches/detail?id=${encodeURIComponent(matchId)}`)
```

Detail parser must use:

```ts
detail.match.homeTeam.name
detail.match.awayTeam.name
detail.match.score
detail.events
detail.notes
```

Do not construct:

```ts
api-football-fixture-${providerFixtureId}
```

### Verification

- [ ] Run:

```powershell
pnpm exec vitest run apps/web/src/services/match-feed-service.test.ts apps/web/src/production-shell.test.ts
```

- [ ] Search web code:

```powershell
rg "API-Football|api-football|API_FOOTBALL|providerFixtureId|sourceProviderId|data-provider-fixture-id|Provider fixture|Provider setup" apps/web/src
```

Expected: no matches, except negative assertions in tests if intentionally checking absence.

---

## Task 5: Add Manual National-Team Snapshot Update Command

**Purpose:** Give the owner a repeatable manual update path without provider API limits.

**Files:**

- Create `scripts/update-national-team-data.ts`
- Create `scripts/update-national-team-data.test.ts`
- Create `apps/api/data/local-match-snapshots/README.md`
- Create `apps/api/data/local-match-snapshots/national-team-matches.seed.json`
- Modify `package.json`

### Tests First

- [ ] Add `scripts/update-national-team-data.test.ts`.

Test cases:

- Reads seed JSON and writes normalized snapshot JSON.
- Updates `snapshotId`, `generatedAt`, and `importedAt`.
- Keeps World Cup 2026 scheduled fixtures before historical completed fixtures.
- Preserves source references.
- Rejects fixture with live status.
- Rejects club competition type.
- Output validates through `validateLocalMatchFeedResponse` or repository validation.
- Does not read or require `API_FOOTBALL_KEY`.

Expected failing command:

```powershell
pnpm exec vitest run scripts/update-national-team-data.test.ts
```

Expected failing reason:

```text
Cannot find module './update-national-team-data'
```

### Seed File

- [ ] Move raw editable data to `national-team-matches.seed.json`.

Shape:

```json
{
  "sourceBatchId": "manual-national-teams-2026-07-01",
  "sources": [
    {
      "sourceId": "openfootball",
      "sourceUrl": "https://github.com/openfootball/worldcup"
    },
    {
      "sourceId": "openfootball",
      "sourceUrl": "https://github.com/openfootball/euro"
    }
  ],
  "matches": []
}
```

The implementation may copy the two Task 2 seed matches into this seed file, then generate `national-team-matches.json` from it.

### Script Implementation

- [ ] Implement exported function:

```ts
export interface UpdateNationalTeamDataOptions {
  inputPath: string;
  outputPath: string;
  now?: () => Date;
}

export async function updateNationalTeamData(
  options: UpdateNationalTeamDataOptions
): Promise<{ outputPath: string; matchCount: number; snapshotId: string }>;
```

- [ ] Implement CLI behavior:

```powershell
pnpm tsx scripts/update-national-team-data.ts --input apps/api/data/local-match-snapshots/national-team-matches.seed.json --output apps/api/data/local-match-snapshots/national-team-matches.json
```

Default CLI paths:

- Input: `apps/api/data/local-match-snapshots/national-team-matches.seed.json`
- Output: `apps/api/data/local-match-snapshots/national-team-matches.json`

The script must:

- Read seed JSON.
- Normalize `generatedAt`, `importedAt`, and source `importedAt`.
- Validate all matches.
- Sort matches using repository sorting rules.
- Write pretty JSON with trailing newline.
- Print a one-line summary:

```text
Updated national-team snapshot: <matchCount> matches -> <outputPath>
```

### Package Script

- [ ] Add to root `package.json`:

```json
{
  "scripts": {
    "data:update:national-teams": "tsx scripts/update-national-team-data.ts"
  }
}
```

Use the repo's existing script style if `tsx` is already invoked differently.

### Snapshot README

- [ ] Create `apps/api/data/local-match-snapshots/README.md`.

Must include:

- This is a manual local snapshot, not live data.
- Current scope is national teams only.
- World Cup and Euro are prioritized.
- Update command:

```powershell
pnpm run data:update:national-teams
```

- API-Football free tier is intentionally not used.
- Any SofaScore-derived data must be manually reviewed and source-recorded before import.

### Verification

- [ ] Run:

```powershell
pnpm exec vitest run scripts/update-national-team-data.test.ts
pnpm run data:update:national-teams
pnpm exec vitest run apps/api/src/repositories/local-match-snapshot-repository.test.ts
```

- [ ] Confirm generated JSON has no API-Football fields:

```powershell
rg "api-football|API_FOOTBALL|providerFixtureId|sourceProviderId|x-apisports-key" apps/api/data/local-match-snapshots scripts/update-national-team-data.ts scripts/update-national-team-data.test.ts
```

Expected: no matches.

---

## Task 6: Remove API-Football Runtime Surface and Update Endpoint Verification

**Purpose:** Finish removal so API-Football cannot accidentally remain in runtime, env, or endpoint checks.

**Files:**

- Delete `apps/api/src/providers/api-football-client.ts`
- Delete `apps/api/src/providers/api-football-client.test.ts`
- Modify `.env.example`
- Modify `scripts/test-endpoints.ts`
- Modify `package.json`
- Optionally delete `apps/api/src/services/matchday-cache.ts` and `apps/api/src/services/matchday-cache.test.ts` only if `rg "matchday-cache" apps scripts packages` confirms no imports remain.

### Tests First

- [ ] Update `scripts/test-endpoints.ts` expectations.

Required endpoint checks:

- `/api/v1/matches` returns at least one local match.
- First match ID starts with `match-`.
- No match has `sourceProviderId`.
- No match has `providerFixtureId`.
- `/api/v1/matches/detail?id=<firstMatch.id>` returns detail for same local ID.
- `/api/v1/data-snapshot/status` returns status with `matchCount > 0`.

Expected failing command before implementation:

```powershell
pnpm exec vitest run scripts/test-endpoints.ts
```

If `scripts/test-endpoints.ts` is not a Vitest test and is an executable smoke script, use its existing command from `package.json` instead.

### Env Cleanup

- [ ] Remove from `.env.example`:

```text
API_FOOTBALL_KEY=
API_FOOTBALL_DAILY_LIMIT=100
```

- [ ] Add:

```text
LOCAL_MATCH_SNAPSHOT_PATH=apps/api/data/local-match-snapshots/national-team-matches.json
```

If the app works with the default path, mark it as optional in comments.

### Package Verification Script

- [ ] Add root script:

```json
{
  "scripts": {
    "phase9:local-data-api-verify": "pnpm run data:update:national-teams && pnpm exec vitest run packages/shared/src/contracts/local-match-contracts.test.ts apps/api/src/repositories/local-match-snapshot-repository.test.ts apps/api/src/routes/matches.test.ts apps/api/src/routes/match-detail.test.ts apps/api/src/routes/data-snapshot-status.test.ts apps/web/src/services/match-feed-service.test.ts apps/web/src/production-shell.test.ts scripts/update-national-team-data.test.ts"
  }
}
```

Adjust command length only if Windows command-line limits require splitting. Do not hide failures behind `|| true`.

### Deletion

- [ ] Delete API-Football provider files after all replacements pass.

Required command before deletion:

```powershell
rg "api-football-client|createApiFootballClient|readApiFootballConfig|normalizeApiFootballFixture|API_FOOTBALL|x-apisports-key" apps packages scripts
```

Expected before deletion: only provider/test files and intentionally failing references.

Expected after deletion: no runtime references.

### Verification

- [ ] Run:

```powershell
pnpm run phase9:local-data-api-verify
```

- [ ] Search entire repo runtime surface:

```powershell
rg "API_FOOTBALL|api-football|x-apisports-key|api_football|providerFixtureId|sourceProviderId" apps packages scripts .env.example package.json
```

Expected: no matches except historical docs, ADRs, or tests that explicitly assert absence.

---

## Task 7: Phase Boundary Verification and Plan Closeout

**Purpose:** Prove the local data API is stable enough for the next code slice and update phase tracking.

**Files:**

- Modify `PROJECT_PLAN.md`
- Optionally modify `docs/product/PHASE-9-NON-AI-APP-COMPLETION-LOCAL-DATA-API-PLAN.md`

### Verification Commands

- [ ] Run local focused verification:

```powershell
pnpm run phase9:local-data-api-verify
```

- [ ] Run broader local verification:

```powershell
pnpm run verify:local
```

- [ ] Run integration verification only if local verification passes:

```powershell
pnpm run test:integration
```

If integration requires services, start them using the repo's documented command. Do not claim integration passed without actual output.

### Documentation Update

- [ ] Update `PROJECT_PLAN.md` Phase 9 checklist:

Set these to complete only after verification passes:

- API-Football free tier removed from runtime path.
- Local national-team snapshot API implemented.
- Web non-AI shell uses local match IDs.
- Manual national-team data update command available.

- [ ] Add implementation result notes to `docs/product/PHASE-9-NON-AI-APP-COMPLETION-LOCAL-DATA-API-PLAN.md`:

Required notes:

- Snapshot file path.
- Update command.
- API endpoints.
- Remaining limitations.
- Next recommended code slice.

### Final Search

- [ ] Run:

```powershell
rg "API_FOOTBALL|api-football|x-apisports-key|api_football|providerFixtureId|sourceProviderId" apps packages scripts .env.example package.json
```

Expected:

- No runtime matches.
- Historical docs are allowed outside this scoped command.

### Phase Transition Recommendation

After Task 7 passes, recommend:

```text
phase:code-slice Phase 9 Local Data API Slice 2 - Bankroll and Cloud Database Readiness
```

Only recommend `phase:integration-test` if the owner explicitly wants to freeze this slice before moving to bankroll/cloud persistence.

---

## Risk Register

| Risk | Impact | Mitigation |
| :--- | :--- | :--- |
| OpenFootball seed lacks full future fixture details | Local app may show incomplete World Cup 2026 coverage | Keep snapshot manual and source-recorded; add fixtures incrementally by update command |
| SofaScore scraping may violate terms or break | Legal and operational risk | Do not implement scraping in this slice; evaluate separately before use |
| Web tests still encode club-match assumptions | UI may imply unsupported scope | Replace with national-team-only fixtures and explicit empty states |
| Detail API loses event richness | Detail tab may look sparse | Return stable detail shape with notes; event enrichment is later data-work, not provider fallback |
| Stale snapshots | User may trust old data | Expose `/api/v1/data-snapshot/status` and show freshness in UI |

---

## Definition of Done

- API-Football provider code deleted.
- `.env.example` no longer contains API-Football variables.
- `/api/v1/matches` works with no provider key and returns local national-team matches.
- `/api/v1/matches/detail?id=<local-match-id>` works with local IDs.
- `/api/v1/data-snapshot/status` works.
- Web shell uses local match IDs and no API-Football copy.
- Manual update command exists and validates generated snapshot.
- `pnpm run phase9:local-data-api-verify` passes.
- No runtime search hits for API-Football strings in `apps`, `packages`, `scripts`, `.env.example`, or `package.json`.
