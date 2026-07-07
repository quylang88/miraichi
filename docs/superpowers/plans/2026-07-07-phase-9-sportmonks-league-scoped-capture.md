# Phase 9 Sportmonks League-Scoped Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one resumable command that captures the useful non-live Sportmonks data for a selected league without repeating valid requests or finishing unrelated global feeds.

**Architecture:** Build a local inventory from existing `fixtures.all`, `seasons.all`, and season-team raw envelopes; convert that inventory into a stable request graph; resolve each request against existing manifest/raw evidence; then execute only missing or incomplete requests. Reuse the existing Sportmonks client, raw cache, and manifest writers, and keep all output provider-raw until a later approved normalization phase.

**Tech Stack:** TypeScript, Node.js filesystem APIs, existing Sportmonks client, JSON/JSONL raw cache and manifest, Vitest, pnpm.

## Global Constraints

- Phase 9 raw provider capture only; no AI training or prediction runtime.
- Competition-agnostic implementation; league IDs are CLI inputs, not hard-coded source behavior.
- Default to all locally discovered seasons; support `--season-id` and `--max-seasons`.
- Execute immediately; do not add a dry-run mode.
- Exclude live scores, in-play odds, global-all feeds, and `/expected/lineups`.
- Capture team-level xG through the fixture `xGFixture` include.
- Never persist `SPORTMONKS_API_TOKEN` in URLs, manifests, reports, logs, or raw envelopes.
- Existing valid terminal requests must be skipped; incomplete pagination must resume.
- `403` and `404` are recorded as unavailable; rate limiting stops cleanly with resumable evidence.
- New implementation and tests must be TypeScript.
- Design source: `docs/superpowers/specs/2026-07-07-phase-9-sportmonks-league-scoped-capture-design.md`.

---

## File Structure

```text
scripts/providers/sportmonks/league-capture-inventory.ts
scripts/providers/sportmonks/league-capture-inventory.test.ts
scripts/providers/sportmonks/league-capture-plan.ts
scripts/providers/sportmonks/league-capture-plan.test.ts
scripts/providers/sportmonks/league-capture-coverage.ts
scripts/providers/sportmonks/league-capture-coverage.test.ts
scripts/providers/sportmonks/league-scoped-capture.ts
scripts/providers/sportmonks/league-scoped-capture.test.ts
scripts/capture-sportmonks-league-data.ts
scripts/capture-sportmonks-league-data.test.ts
package.json
PROJECT_PLAN.md
```

- `league-capture-inventory.ts`: Reads existing raw envelopes and builds deterministic league/season/team/fixture inventory.
- `league-capture-plan.ts`: Converts inventory and selected groups into exact Sportmonks requests.
- `league-capture-coverage.ts`: Computes request identity, validates existing raw evidence, resumes pages, and detects fixture field coverage.
- `league-scoped-capture.ts`: Executes the request graph, writes raw/manifest evidence, enforces request budgets, and writes the league report.
- `capture-sportmonks-league-data.ts`: Parses CLI arguments and wires config/client/executor.

---

### Task 1: League Inventory Discovery And Season Selection

**Files:**
- Create: `scripts/providers/sportmonks/league-capture-inventory.ts`
- Create: `scripts/providers/sportmonks/league-capture-inventory.test.ts`

**Interfaces:**
- Consumes: raw envelopes under `providers/sportmonks/raw/fixtures.all`, `seasons.all`, and `teams.bySeasonId`.
- Produces:

```ts
export interface LeagueSeasonInventory {
  seasonId: number;
  name?: string;
  sortDate?: string;
}

export interface LeagueTeamSeasonInventory {
  teamId: number;
  seasonId: number;
}

export interface SportmonksLeagueCaptureInventory {
  leagueId: number;
  seasons: LeagueSeasonInventory[];
  fixtureIds: number[];
  teamIds: number[];
  teamSeasons: LeagueTeamSeasonInventory[];
}

export interface BuildSportmonksLeagueInventoryOptions {
  captureRoot: string;
  leagueId: number;
  seasonIds?: number[];
  maxSeasons?: number;
}

export async function buildSportmonksLeagueCaptureInventory(
  options: BuildSportmonksLeagueInventoryOptions
): Promise<SportmonksLeagueCaptureInventory>;
```

- [ ] **Step 1: Write failing inventory tests**

Create fixtures with `writeRawProviderPayload` so the test exercises the real raw layout:

```ts
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createPayloadHash, writeRawProviderPayload } from '../shared/raw-cache.js';
import { buildSportmonksLeagueCaptureInventory } from './league-capture-inventory.js';

async function writeRaw(root: string, endpointKey: string, urlPath: string, payload: unknown): Promise<void> {
  await writeRawProviderPayload(root, {
    schemaVersion: 'miraichi.provider.raw.v1',
    provider: 'sportmonks',
    endpointKey,
    urlPath,
    query: { page: '1' },
    fetchedAt: '2026-07-07T00:00:00.000Z',
    payloadHash: createPayloadHash(payload),
    rateLimit: {},
    payload
  });
}

describe('sportmonks league capture inventory', () => {
  it('selects one league, newest seasons, fixtures, teams, and team-season pairs', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-league-inventory-'));
    await writeRaw(root, 'fixtures.all', '/fixtures', {
      data: [
        { id: 100, league_id: 8, season_id: 2025 },
        { id: 101, league_id: 8, season_id: 2024 },
        { id: 999, league_id: 9, season_id: 2025 }
      ]
    });
    await writeRaw(root, 'seasons.all', '/seasons', {
      data: [
        { id: 2024, league_id: 8, name: '2024/2025', ending_at: '2025-05-31' },
        { id: 2025, league_id: 8, name: '2025/2026', ending_at: '2026-05-31' }
      ]
    });
    await writeRaw(root, 'teams.bySeasonId', '/teams/seasons/2025', {
      data: [{ id: 1 }, { id: 2 }]
    });

    await expect(buildSportmonksLeagueCaptureInventory({
      captureRoot: root,
      leagueId: 8,
      maxSeasons: 1
    })).resolves.toEqual({
      leagueId: 8,
      seasons: [{ seasonId: 2025, name: '2025/2026', sortDate: '2026-05-31' }],
      fixtureIds: [100],
      teamIds: [1, 2],
      teamSeasons: [{ teamId: 1, seasonId: 2025 }, { teamId: 2, seasonId: 2025 }]
    });
  });

  it('fails instead of starting a hidden global crawl when inventory is missing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-league-inventory-'));
    await expect(buildSportmonksLeagueCaptureInventory({ captureRoot: root, leagueId: 8 }))
      .rejects.toThrow('No local Sportmonks fixture inventory found for league 8');
  });
});
```

- [ ] **Step 2: Run tests and observe failure**

```powershell
pnpm exec vitest run scripts/providers/sportmonks/league-capture-inventory.test.ts
```

Expected: FAIL because `league-capture-inventory.ts` does not exist.

- [ ] **Step 3: Implement inventory discovery**

Implement recursive raw-envelope reads, positive-ID validation, season ordering by `ending_at`, `starting_at`, then ID, explicit season filtering, and stable numeric deduplication. Reject `maxSeasons < 1`, an empty explicit season selection, no matching fixtures, or no matching seasons.

Apply explicit `seasonIds` first, then apply `maxSeasons` to that selected set. Resolve teams from `teams.bySeasonId`; when that raw endpoint is absent, fall back to `participants[].id` in valid `fixtures.enrichedById` payloads for selected fixtures.

The exported function must return sorted fixture/team IDs and sorted `{ teamId, seasonId }` pairs. It must never write files or call Sportmonks.

- [ ] **Step 4: Verify inventory behavior**

```powershell
pnpm exec vitest run scripts/providers/sportmonks/league-capture-inventory.test.ts
pnpm run typecheck
```

Expected: tests PASS and typecheck exits 0.

- [ ] **Step 5: Commit**

```powershell
git add scripts/providers/sportmonks/league-capture-inventory.ts scripts/providers/sportmonks/league-capture-inventory.test.ts
git commit -m "feat(data): build sportmonks league inventory"
```

---

### Task 2: Deterministic League Request Graph

**Files:**
- Create: `scripts/providers/sportmonks/league-capture-plan.ts`
- Create: `scripts/providers/sportmonks/league-capture-plan.test.ts`

**Interfaces:**
- Consumes: `SportmonksLeagueCaptureInventory` from Task 1 and `SPORTMONKS_NON_LIVE_FIXTURE_INCLUDE` from `fixture-enrichment-probe.ts`.
- Produces:

```ts
export type SportmonksLeagueCaptureGroup = 'season' | 'fixture' | 'team' | 'ai';

export interface SportmonksLeagueCaptureRequest {
  endpointKey: string;
  group: SportmonksLeagueCaptureGroup;
  urlPath: string;
  query: Record<string, string>;
  paginated: boolean;
  fixtureId?: number;
  teamId?: number;
  seasonId?: number;
}

export function buildSportmonksLeagueCaptureRequests(
  inventory: SportmonksLeagueCaptureInventory,
  groups?: SportmonksLeagueCaptureGroup[]
): SportmonksLeagueCaptureRequest[];
```

- [ ] **Step 1: Write the failing request graph test**

```ts
import { describe, expect, it } from 'vitest';
import { buildSportmonksLeagueCaptureRequests } from './league-capture-plan.js';

describe('sportmonks league capture request graph', () => {
  it('builds scoped season, fixture, team, and AI requests only', () => {
    const requests = buildSportmonksLeagueCaptureRequests({
      leagueId: 8,
      seasons: [{ seasonId: 2025, name: '2025/2026' }],
      fixtureIds: [100],
      teamIds: [1],
      teamSeasons: [{ teamId: 1, seasonId: 2025 }]
    });

    expect(requests.map((item) => [item.endpointKey, item.urlPath])).toEqual(expect.arrayContaining([
      ['schedules.bySeasonId', '/schedules/seasons/2025'],
      ['venues.bySeasonId', '/venues/seasons/2025'],
      ['referees.bySeasonId', '/referees/seasons/2025'],
      ['topscorers.bySeasonId', '/topscorers/seasons/2025'],
      ['fixtures.enrichedById', '/fixtures/100'],
      ['odds.prematchByFixtureId', '/odds/pre-match/fixtures/100'],
      ['commentaries.byFixtureId', '/commentaries/fixtures/100'],
      ['transfers.byTeamId', '/transfers/teams/1'],
      ['transferRumours.byTeamId', '/transfer-rumours/teams/1'],
      ['rankings.byTeamId', '/team-rankings/teams/1'],
      ['squads.bySeasonAndTeamId', '/squads/seasons/2025/teams/1'],
      ['statistics.byTeamId', '/statistics/seasons/teams/1'],
      ['predictions.predictabilityByLeagueId', '/predictions/predictability/leagues/8'],
      ['predictions.probabilitiesByFixtureId', '/predictions/probabilities/fixtures/100'],
      ['predictions.valueBetsByFixtureId', '/predictions/value-bets/fixtures/100'],
      ['matchFacts.byLeagueId', '/match-facts/leagues/8']
    ]));
    expect(requests.some((item) => item.urlPath.includes('/expected/lineups'))).toBe(false);
    expect(requests.some((item) => item.urlPath.includes('/inplay') || item.urlPath.includes('/livescores'))).toBe(false);
    expect(requests.some((item) => item.endpointKey.endsWith('.all'))).toBe(false);
  });
});
```

- [ ] **Step 2: Run test and observe failure**

```powershell
pnpm exec vitest run scripts/providers/sportmonks/league-capture-plan.test.ts
```

Expected: FAIL because the request graph module does not exist.

- [ ] **Step 3: Implement the request graph**

Generate requests in deterministic group order: `season`, `fixture`, `team`, `ai`. Within each group, sort by season ID, fixture ID, or team ID and then endpoint key.

Use these exact query values:

```ts
const queries = {
  standings: { include: 'participant;league;season;stage;round;details.type;rule' },
  fixture: { include: SPORTMONKS_NON_LIVE_FIXTURE_INCLUDE },
  odds: { include: 'market;bookmaker;fixture' },
  transfer: { include: 'player;type;fromTeam;toTeam;position;detailedPosition' },
  ranking: { include: 'team' },
  squad: { include: 'player;team;season;details;position' },
  teamStatistics: { include: 'season;details.type', filters: `seasonLeagues:${inventory.leagueId}` },
  news: { include: 'fixture;league;lines' },
  prediction: { include: 'type;fixture' },
  matchFacts: { include: 'type;fixture' }
};
```

Use these exact pagination flags:

```text
Non-paginated: fixtures.enrichedById, commentaries.byFixtureId,
               squads.bySeasonAndTeamId, venues.bySeasonId
Paginated:     every other request in this graph
```

Group filtering must remove unselected groups without changing the order of the remaining requests.

- [ ] **Step 4: Verify request graph**

```powershell
pnpm exec vitest run scripts/providers/sportmonks/league-capture-plan.test.ts
pnpm run typecheck
```

Expected: tests PASS and typecheck exits 0.

- [ ] **Step 5: Commit**

```powershell
git add scripts/providers/sportmonks/league-capture-plan.ts scripts/providers/sportmonks/league-capture-plan.test.ts
git commit -m "feat(data): plan sportmonks league requests"
```

---

### Task 3: Manifest Coverage, Raw Validation, And Pagination Resume

**Files:**
- Create: `scripts/providers/sportmonks/league-capture-coverage.ts`
- Create: `scripts/providers/sportmonks/league-capture-coverage.test.ts`

**Interfaces:**
- Consumes: `SportmonksLeagueCaptureRequest` from Task 2 and existing raw/manifest files.
- Produces:

```ts
export interface SportmonksRequestProgress {
  action: 'skip' | 'capture';
  page: number;
  query: Record<string, string>;
  resumed: boolean;
}

export interface SportmonksFixtureFieldCoverage {
  odds: boolean;
  predictions: boolean;
  xGFixture: boolean;
  comments: boolean;
}

export function createSportmonksRequestFamilyKey(
  request: SportmonksLeagueCaptureRequest
): string;

export async function resolveSportmonksRequestProgress(
  captureRoot: string,
  request: SportmonksLeagueCaptureRequest
): Promise<SportmonksRequestProgress>;

export async function readSportmonksFixtureFieldCoverage(
  captureRoot: string,
  fixtureId: number
): Promise<SportmonksFixtureFieldCoverage>;

export async function readSportmonksGlobalReferenceCoverage(
  captureRoot: string
): Promise<{ complete: string[]; missing: string[] }>;
```

- [ ] **Step 1: Write failing coverage tests**

Tests must use `appendProviderManifestEntry` and `writeRawProviderPayload` to prove:

```ts
it('skips only when terminal manifest evidence and a valid raw envelope both exist', async () => {
  // captured page with hasMore=false + matching raw hash -> action skip
});

it('recaptures when a captured manifest points to a missing raw envelope', async () => {
  // manifest only -> action capture page 1
});

it('resumes a paginated request from the stored cursor without page-one duplication', async () => {
  // page 1 hasMore=true and raw next_cursor -> action capture, resumed=true, page=2, query contains cursor
});

it('reads odds, predictions, xGFixture, and comments presence from enriched fixture raw data', async () => {
  // /fixtures/100 payload fields -> exact boolean coverage
});

it('reports global references as complete only when terminal raw evidence validates', async () => {
  // types.all terminal+raw -> complete; markets.all manifest-only -> missing
});
```

Assert that `createSportmonksRequestFamilyKey` sorts query keys and excludes `page`, `cursor`, and `api_token`.

- [ ] **Step 2: Run tests and observe failure**

```powershell
pnpm exec vitest run scripts/providers/sportmonks/league-capture-coverage.test.ts
```

Expected: FAIL because the coverage module does not exist.

- [ ] **Step 3: Implement coverage and resume**

Read `capture-manifest.jsonl` defensively, ignore invalid JSON lines, and match entries by endpoint key, URL path, and normalized base query. Validate raw existence by reconstructing the existing path from `fetchedAt`, `endpointKey`, and `payloadHash`, then recompute `createPayloadHash(envelope.payload)`.

For cursor pagination, merge the request base query with the cursor. For page pagination, merge the request base query with `page: String(latestPage + 1)`. A terminal entry is valid only when its raw envelope validates.

Fixture coverage must inspect the most recently fetched valid `fixtures.enrichedById` envelope whose `urlPath` is `/fixtures/{fixtureId}`. Empty arrays count as missing coverage.

Global reference coverage must check these endpoint keys: `types.all`, `states.all`, `countries.all`, `regions.all`, `markets.all`, `bookmakers.all`, `teams.all`, `players.all`, `venues.all`, `coaches.all`, and `referees.all`. A reference is complete only when a valid captured entry has `hasMore: false`.

- [ ] **Step 4: Verify coverage behavior**

```powershell
pnpm exec vitest run scripts/providers/sportmonks/league-capture-coverage.test.ts
pnpm run typecheck
```

Expected: tests PASS and typecheck exits 0.

- [ ] **Step 5: Commit**

```powershell
git add scripts/providers/sportmonks/league-capture-coverage.ts scripts/providers/sportmonks/league-capture-coverage.test.ts
git commit -m "feat(data): resume scoped sportmonks requests"
```

---

### Task 4: League-Scoped Executor And Coverage Report

**Files:**
- Create: `scripts/providers/sportmonks/league-scoped-capture.ts`
- Create: `scripts/providers/sportmonks/league-scoped-capture.test.ts`

**Interfaces:**
- Consumes: Tasks 1-3, `SportmonksCaptureClient`, `writeRawProviderPayload`, and `appendProviderManifestEntry`.
- Produces:

```ts
export interface SportmonksLeagueCaptureResult {
  leagueId: number;
  seasonIds: number[];
  fixtureCount: number;
  teamCount: number;
  planned: number;
  skipped: number;
  resumed: number;
  captured: number;
  unavailable: number;
  failed: number;
  groupResults: Record<SportmonksLeagueCaptureGroup, {
    planned: number;
    skipped: number;
    resumed: number;
    captured: number;
    unavailable: number;
    failed: number;
  }>;
  missingGlobalReferences: string[];
  excludedEndpointFamilies: ['global-all', 'livescores', 'inplay-odds', 'expected-lineups'];
  stoppedEarlyReason?: 'max_requests' | 'rate_limited';
}

export async function runSportmonksLeagueScopedCapture(options: {
  captureRoot: string;
  client: SportmonksCaptureClient;
  leagueId: number;
  seasonIds?: number[];
  maxSeasons?: number;
  groups?: SportmonksLeagueCaptureGroup[];
  maxRequests?: number;
  skipExisting?: boolean;
  now?: () => string;
  log?: (message: string) => void;
}): Promise<SportmonksLeagueCaptureResult>;
```

- [ ] **Step 1: Write failing executor tests**

Create a temporary league inventory and a fake client. Prove:

```ts
it('skips existing fixture enrichment and calls only missing fixture odds', async () => {
  // enriched fixture raw has participants/scores but no odds; expect only odds request for the fixture group
});

it('suppresses narrower odds and prediction requests when enrichment already contains them', async () => {
  // enriched raw has odds, predictions, xGFixture; expect zero matching client calls
});

it('stops before exceeding maxRequests and reports max_requests', async () => {
  // maxRequests=1 with two missing requests -> exactly one client call
});

it('records unavailable requests and stops cleanly on rate limiting', async () => {
  // 403 increments unavailable; later 429 sets stoppedEarlyReason=rate_limited
});
```

Assert that reports are written beneath `providers/sportmonks/reports` and contain no token field or token substring.

Also assert that the report contains group-level counts, missing global references, and the fixed excluded endpoint-family list.

- [ ] **Step 2: Run tests and observe failure**

```powershell
pnpm exec vitest run scripts/providers/sportmonks/league-scoped-capture.test.ts
```

Expected: FAIL because the executor does not exist.

- [ ] **Step 3: Implement the executor**

Execution algorithm:

```ts
const inventory = await buildSportmonksLeagueCaptureInventory({
  captureRoot: options.captureRoot,
  leagueId: options.leagueId,
  ...(options.seasonIds === undefined ? {} : { seasonIds: options.seasonIds }),
  ...(options.maxSeasons === undefined ? {} : { maxSeasons: options.maxSeasons })
});
const requests = buildSportmonksLeagueCaptureRequests(inventory, options.groups);
const globalReferences = await readSportmonksGlobalReferenceCoverage(options.captureRoot);

for (const request of requests) {
  if (request.fixtureId !== undefined) {
    const coverage = await readSportmonksFixtureFieldCoverage(options.captureRoot, request.fixtureId);
    if (request.endpointKey === 'odds.prematchByFixtureId' && coverage.odds) continue;
    if (request.endpointKey === 'predictions.probabilitiesByFixtureId' && coverage.predictions) continue;
  }
  const progress = options.skipExisting === false
    ? { action: 'capture' as const, page: 1, query: { ...request.query, ...(request.paginated ? { page: '1' } : {}) }, resumed: false }
    : await resolveSportmonksRequestProgress(options.captureRoot, request);
  // Enforce budget, call client, write raw envelope and manifest, then follow pagination.
}
```

Use the existing raw envelope schema and rate-limit snapshot. Mark non-paginated successful requests with `hasMore: false`. Count each HTTP call against `maxRequests`. Write one timestamped report even after rate limiting or expected endpoint unavailability.

Track every request outcome in both the overall result and its `groupResults` bucket. Copy `globalReferences.missing` into `missingGlobalReferences`. Rate limiting sets `stoppedEarlyReason: 'rate_limited'` without incrementing `failed`; unexpected failures increment `failed`.

Do not suppress value-bet requests based only on a missing/empty enrichment field because an empty value-bet response is valid provider evidence. Exact request coverage handles its deduplication.

- [ ] **Step 4: Verify executor behavior**

```powershell
pnpm exec vitest run scripts/providers/sportmonks/league-scoped-capture.test.ts
pnpm run typecheck
```

Expected: tests PASS and typecheck exits 0.

- [ ] **Step 5: Commit**

```powershell
git add scripts/providers/sportmonks/league-scoped-capture.ts scripts/providers/sportmonks/league-scoped-capture.test.ts
git commit -m "feat(data): execute sportmonks league capture"
```

---

### Task 5: League Capture CLI And Package Command

**Files:**
- Create: `scripts/capture-sportmonks-league-data.ts`
- Create: `scripts/capture-sportmonks-league-data.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `readSportmonksCaptureConfig`, `createSportmonksClient`, and `runSportmonksLeagueScopedCapture`.
- Produces:

```ts
export interface SportmonksLeagueCaptureCliArgs {
  leagueId: number;
  seasonIds: number[];
  maxSeasons?: number;
  groups: SportmonksLeagueCaptureGroup[];
  maxRequests?: number;
  skipExisting: boolean;
}

export function parseSportmonksLeagueCaptureArgs(args: string[]): SportmonksLeagueCaptureCliArgs;
export async function main(args?: string[]): Promise<void>;
```

- [ ] **Step 1: Write failing CLI tests**

```ts
import { describe, expect, it } from 'vitest';
import { parseSportmonksLeagueCaptureArgs } from './capture-sportmonks-league-data.js';

describe('sportmonks league capture CLI', () => {
  it('parses league, repeated seasons/groups, limits, and recapture control', () => {
    expect(parseSportmonksLeagueCaptureArgs([
      '--league-id=8',
      '--season-id=2025',
      '--season-id=2024',
      '--max-seasons=2',
      '--group=fixture',
      '--group=team',
      '--max-requests=1000',
      '--no-skip-existing'
    ])).toEqual({
      leagueId: 8,
      seasonIds: [2025, 2024],
      maxSeasons: 2,
      groups: ['fixture', 'team'],
      maxRequests: 1000,
      skipExisting: false
    });
  });

  it('defaults to every non-live league group and rejects dry-run', () => {
    expect(parseSportmonksLeagueCaptureArgs(['--league-id=8'])).toEqual({
      leagueId: 8,
      seasonIds: [],
      groups: ['season', 'fixture', 'team', 'ai'],
      skipExisting: true
    });
    expect(() => parseSportmonksLeagueCaptureArgs(['--league-id=8', '--dry-run']))
      .toThrow('Unsupported Sportmonks league capture argument: --dry-run');
  });
});
```

- [ ] **Step 2: Run tests and observe failure**

```powershell
pnpm exec vitest run scripts/capture-sportmonks-league-data.test.ts
```

Expected: FAIL because the CLI module does not exist.

- [ ] **Step 3: Implement CLI and package command**

Follow the existing `.env` loader and `fileURLToPath(import.meta.url)` execution guard used by `capture-sportmonks-season-scoped-data.ts`. Reject unknown arguments, missing/non-positive league IDs, invalid groups, and non-positive limits.

Add to `package.json`:

```json
"data:capture:sportmonks:league": "tsx scripts/capture-sportmonks-league-data.ts"
```

Print the final result as formatted JSON. Set `process.exitCode = 1` only when `failed > 0`; rate-limited and request-budget stops remain resumable operational outcomes.

- [ ] **Step 4: Verify CLI behavior**

```powershell
pnpm exec vitest run scripts/capture-sportmonks-league-data.test.ts
pnpm run typecheck
```

Expected: tests PASS and typecheck exits 0.

- [ ] **Step 5: Commit**

```powershell
git add scripts/capture-sportmonks-league-data.ts scripts/capture-sportmonks-league-data.test.ts package.json
git commit -m "feat(data): add sportmonks league capture command"
```

---

### Task 6: Focused Boundary Verification And Phase Evidence

**Files:**
- Modify: `PROJECT_PLAN.md`
- Test: all files created in Tasks 1-5 plus existing Sportmonks capture tests.

**Interfaces:**
- Consumes: the complete league-scoped capture command.
- Produces: Phase 9 code-slice evidence and a documented next lifecycle gate.

- [ ] **Step 1: Run the complete focused unit boundary**

```powershell
pnpm exec vitest run \
  scripts/providers/sportmonks/league-capture-inventory.test.ts \
  scripts/providers/sportmonks/league-capture-plan.test.ts \
  scripts/providers/sportmonks/league-capture-coverage.test.ts \
  scripts/providers/sportmonks/league-scoped-capture.test.ts \
  scripts/capture-sportmonks-league-data.test.ts \
  scripts/providers/sportmonks/capture.test.ts \
  scripts/providers/sportmonks/fixture-enrichment-probe.test.ts \
  scripts/providers/sportmonks/season-scoped-capture.test.ts
```

Expected: all focused tests PASS.

- [ ] **Step 2: Run local verification**

```powershell
pnpm run verify:local
git diff --check
```

Expected: lifecycle, unit tests, syntax, typecheck, guardrail audit, and type-safety audit PASS; diff check exits 0.

- [ ] **Step 3: Record the completed code slice in the project plan**

Add under the active Phase 9 Sportmonks work:

```markdown
- [x] Complete `phase:code-slice Phase 9 Sportmonks League-Scoped Capture Runner`.
  - **Scope**: Added a coverage-aware league command that fans out through discovered seasons, fixtures, and teams; skips valid existing raw requests; resumes incomplete pagination; and excludes global-all, live, in-play, and expected-lineup feeds.
  - **Command**: `pnpm run data:capture:sportmonks:league -- --league-id=<leagueId>`.
  - **Evidence**: Focused league-capture tests, `pnpm run verify:local`, and `git diff --check` pass.
  - **Constraint**: Raw provider evidence only; no AI training, feature promotion, betting formula, or runtime prediction surface.
```

- [ ] **Step 4: Verify the documentation change**

```powershell
pnpm run verify:lifecycle
git diff --check
```

Expected: both commands exit 0.

- [ ] **Step 5: Commit**

```powershell
git add PROJECT_PLAN.md
git commit -m "docs(data): record league capture evidence"
```

---

## Slice Execution Order

Execute one lifecycle slice at a time:

1. `phase:code-slice Phase 9 Sportmonks League Inventory Discovery`
2. `phase:code-slice Phase 9 Sportmonks League Request Graph`
3. `phase:code-slice Phase 9 Sportmonks League Capture Coverage And Resume`
4. `phase:code-slice Phase 9 Sportmonks League Capture Executor`
5. `phase:code-slice Phase 9 Sportmonks League Capture CLI`
6. `phase:code-slice Phase 9 Sportmonks League Capture Boundary Verification`

Do not run a real provider capture as a unit-test requirement. After all slices pass local verification, the owner can run a bounded manual command such as:

```powershell
pnpm run data:capture:sportmonks:league -- --league-id=8 --max-requests=100
```

Only after representative national-team and club league captures produce resumable reports should the owner consider `phase:integration-test Phase 9 Sportmonks Trial Data Capture Sprint`.
