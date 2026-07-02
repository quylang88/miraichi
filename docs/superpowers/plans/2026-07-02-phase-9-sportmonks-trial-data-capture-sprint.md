# Phase 9 Sportmonks Trial Data Capture Sprint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture maximum reusable Sportmonks trial data without locking Miraichi to Sportmonks after the 14-day trial.

**Architecture:** Build a provider-neutral ingestion core first: raw cache, manifest, canonical warehouse, provider links, provenance, and conflict records. Sportmonks is only a temporary provider adapter that writes raw payloads and normalized records into those neutral artifacts. After the trial, `scripts/providers/sportmonks/` can be deleted while `apps/api/data/warehouse/` remains usable by future providers.

**Tech Stack:** TypeScript, Node.js `fetch`, filesystem JSON/JSONL cache, Vitest, existing local match contracts, existing Phase 9 local match snapshot pipeline.

---

## Sources Used For This Plan

- Sportmonks Endpoints overview: <https://docs.sportmonks.com/v3/endpoints-and-entities/endpoints>
- Sportmonks Fixtures tutorial: <https://docs.sportmonks.com/v3/tutorials-and-guides/tutorials/livescores-and-fixtures/fixtures>
- Sportmonks Best practices: <https://docs.sportmonks.com/v3/welcome/best-practices>
- Sportmonks Pagination: <https://docs.sportmonks.com/v3/tutorials-and-guides/tutorials/introduction/pagination>
- Sportmonks Rate limit: <https://docs.sportmonks.com/v3/api/rate-limit>

## Accepted Decisions

- Sportmonks is the only active provider during this sprint.
- Sportmonks is not the app runtime dependency.
- Sportmonks IDs are not canonical Miraichi IDs.
- Sportmonks-specific code lives only under `scripts/providers/sportmonks/`.
- Provider-neutral code lives under `scripts/providers/shared/`.
- Captured raw payloads are local artifacts, not git history.
- Canonical warehouse artifacts are provider-neutral JSONL files.
- App output is generated from the canonical warehouse into the existing local match snapshot path.
- Provider expansion is deferred but architecturally supported.
- Live polling, AI training, predictions, betting recommendations, ROI, CLV, Kelly, stake sizing, and bankroll-risk formulas remain out of scope.
- Odds, predictions, news, livescores, and xG endpoint families are catalogued but gated by default.

## Deletion Requirement After Trial

After the trial, deleting this folder must not break the app or destroy canonical data:

```text
scripts/providers/sportmonks/
```

The following artifacts must remain usable:

```text
apps/api/data/warehouse/
apps/api/data/local-match-snapshots/national-team-matches.json
scripts/providers/shared/
```

If a future provider is added, it must implement a new adapter folder, for example:

```text
scripts/providers/football-data/
scripts/providers/api-football/
```

and write into the same provider-neutral warehouse contracts.

## Artifact Layout

```text
apps/api/data/providers/
  sportmonks/
    raw/
    manifests/
    reports/

apps/api/data/warehouse/
  canonical-matches.jsonl
  canonical-teams.jsonl
  canonical-competitions.jsonl
  match-provider-links.jsonl
  match-events.jsonl
  match-team-stats.jsonl
  field-provenance.jsonl
  conflicts.jsonl
```

Provider payload directories are git-ignored. Warehouse JSONL files are small enough to commit only when intentionally promoted as local app/training seed data.

## File Structure Map

```text
packages/shared/src/contracts/provider-ingestion-contracts.ts
packages/shared/src/contracts/provider-ingestion-contracts.test.ts
packages/shared/src/contracts/local-match-contracts.ts
packages/shared/src/contracts/local-match-contracts.test.ts
packages/shared/src/contracts/index.ts

scripts/providers/shared/raw-cache.ts
scripts/providers/shared/raw-cache.test.ts
scripts/providers/shared/manifest.ts
scripts/providers/shared/manifest.test.ts
scripts/providers/shared/canonical-warehouse.ts
scripts/providers/shared/canonical-warehouse.test.ts
scripts/providers/shared/entity-resolution.ts
scripts/providers/shared/entity-resolution.test.ts
scripts/providers/shared/provenance.ts
scripts/providers/shared/provenance.test.ts

scripts/providers/sportmonks/config.ts
scripts/providers/sportmonks/config.test.ts
scripts/providers/sportmonks/endpoint-catalog.ts
scripts/providers/sportmonks/endpoint-catalog.test.ts
scripts/providers/sportmonks/client.ts
scripts/providers/sportmonks/client.test.ts
scripts/providers/sportmonks/capture.ts
scripts/providers/sportmonks/capture.test.ts
scripts/providers/sportmonks/normalize-to-warehouse.ts
scripts/providers/sportmonks/normalize-to-warehouse.test.ts
scripts/providers/sportmonks/verify-capture.ts
scripts/providers/sportmonks/verify-capture.test.ts

scripts/capture-sportmonks-trial-data.ts
scripts/export-warehouse-to-local-match-snapshot.ts
scripts/export-warehouse-to-local-match-snapshot.test.ts

apps/api/data/providers/sportmonks/raw/.gitkeep
apps/api/data/providers/sportmonks/manifests/.gitkeep
apps/api/data/providers/sportmonks/reports/.gitkeep
apps/api/data/warehouse/.gitkeep
apps/api/data/local-match-snapshots/README.md

.env.example
.gitignore
package.json
PROJECT_PLAN.md
```

## Task 1: Provider-Neutral Ingestion And Warehouse Contracts

**Purpose:** Define records that survive Sportmonks deletion: raw envelopes, manifests, canonical entities, provider links, provenance, and conflicts.

**Files:**

- Create `packages/shared/src/contracts/provider-ingestion-contracts.ts`
- Create `packages/shared/src/contracts/provider-ingestion-contracts.test.ts`
- Modify `packages/shared/src/contracts/local-match-contracts.ts`
- Modify `packages/shared/src/contracts/local-match-contracts.test.ts`
- Modify `packages/shared/src/contracts/index.ts`

- [ ] **Step 1: Write the failing contract tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  validateCanonicalMatch,
  validateFieldProvenance,
  validateProviderLink,
  validateRawProviderPayloadEnvelope
} from './provider-ingestion-contracts.js';
import { validateLocalMatch } from './local-match-contracts.js';

describe('provider-neutral ingestion contracts', () => {
  it('accepts raw provider envelopes without making the provider canonical', () => {
    expect(validateRawProviderPayloadEnvelope({
      schemaVersion: 'miraichi.provider.raw.v1',
      provider: 'sportmonks',
      endpointKey: 'fixtures.all',
      urlPath: '/v3/football/fixtures',
      query: { filters: 'populate', page: '1' },
      fetchedAt: '2026-07-02T00:00:00.000Z',
      payloadHash: 'a'.repeat(64),
      rateLimit: { requestedEntity: 'Fixture', remaining: 1999, resetsInSeconds: 3600 },
      payload: { data: [{ id: 1 }] }
    })).toEqual({ ok: true });
  });

  it('accepts canonical matches with provider-neutral ids', () => {
    expect(validateCanonicalMatch({
      matchId: 'match-20260702-japan-vietnam',
      competitionId: 'competition-world-cup',
      season: '2026',
      kickoffUtc: '2026-07-02T12:00:00.000Z',
      status: 'scheduled',
      homeTeamId: 'team-japan',
      awayTeamId: 'team-vietnam',
      scoreHome: null,
      scoreAway: null,
      updatedAt: '2026-07-02T00:00:00.000Z'
    })).toEqual({ ok: true });
  });

  it('links canonical matches to provider ids with confidence', () => {
    expect(validateProviderLink({
      entityType: 'match',
      entityId: 'match-20260702-japan-vietnam',
      provider: 'sportmonks',
      providerEntityType: 'fixture',
      providerEntityId: '123456',
      confidence: 0.98,
      linkedBy: 'sportmonks-fixture-normalizer',
      linkedAt: '2026-07-02T00:00:00.000Z'
    })).toEqual({ ok: true });
  });

  it('tracks field provenance so future providers can override with evidence', () => {
    expect(validateFieldProvenance({
      entityType: 'match',
      entityId: 'match-20260702-japan-vietnam',
      fieldPath: 'scoreHome',
      provider: 'sportmonks',
      providerEntityId: '123456',
      observedAt: '2026-07-02T00:00:00.000Z',
      confidence: 0.95,
      valueHash: 'b'.repeat(64)
    })).toEqual({ ok: true });
  });

  it('allows Sportmonks only as a source reference, not top-level provider fields', () => {
    expect(validateLocalMatch({
      id: 'match-20260702-japan-vietnam',
      competition: { id: 'competition-world-cup', name: 'World Cup', type: 'national-team', season: '2026' },
      kickoffUtc: '2026-07-02T12:00:00.000Z',
      status: 'scheduled',
      homeTeam: { id: 'team-japan', name: 'Japan' },
      awayTeam: { id: 'team-vietnam', name: 'Vietnam' },
      score: { home: null, away: null },
      sourceRefs: [{ sourceId: 'sportmonks', sourceMatchId: '123456', importedAt: '2026-07-02T00:00:00.000Z' }],
      updatedAt: '2026-07-02T00:00:00.000Z'
    })).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run the test and observe failure**

```powershell
pnpm exec vitest run packages/shared/src/contracts/provider-ingestion-contracts.test.ts packages/shared/src/contracts/local-match-contracts.test.ts
```

Expected: fail because `provider-ingestion-contracts.ts` does not exist and `sportmonks` is not yet an accepted source.

- [ ] **Step 3: Implement the contracts**

Create `provider-ingestion-contracts.ts` with these exported interfaces:

```ts
export type ProviderId = 'sportmonks' | 'football-data-org' | 'api-football' | 'manual-snapshot';
export type CanonicalMatchStatus = 'scheduled' | 'completed' | 'postponed' | 'cancelled' | 'unknown';

export interface RawProviderPayloadEnvelope {
  schemaVersion: 'miraichi.provider.raw.v1';
  provider: ProviderId;
  endpointKey: string;
  urlPath: string;
  query: Record<string, string>;
  fetchedAt: string;
  payloadHash: string;
  rateLimit: { requestedEntity?: string; remaining?: number; resetsInSeconds?: number };
  payload: unknown;
}

export interface ProviderCaptureManifestEntry {
  provider: ProviderId;
  endpointKey: string;
  urlPath: string;
  query: Record<string, string>;
  status: 'pending' | 'captured' | 'skipped' | 'forbidden' | 'unavailable' | 'failed';
  page?: number;
  hasMore?: boolean;
  payloadHash?: string;
  fetchedAt?: string;
  recordCount?: number;
  errorCode?: string;
  errorMessage?: string;
}

export interface CanonicalMatch {
  matchId: string;
  competitionId: string;
  season: string;
  kickoffUtc: string;
  status: CanonicalMatchStatus;
  homeTeamId: string;
  awayTeamId: string;
  scoreHome: number | null;
  scoreAway: number | null;
  venueId?: string;
  round?: string;
  stage?: string;
  neutralVenue?: boolean;
  updatedAt: string;
}

export interface CanonicalTeam {
  teamId: string;
  name: string;
  countryCode?: string;
  updatedAt: string;
}

export interface CanonicalCompetition {
  competitionId: string;
  name: string;
  type: 'national-team';
  updatedAt: string;
}

export interface ProviderLink {
  entityType: 'match' | 'team' | 'competition' | 'event' | 'stat';
  entityId: string;
  provider: ProviderId;
  providerEntityType: string;
  providerEntityId: string;
  confidence: number;
  linkedBy: string;
  linkedAt: string;
}

export interface CanonicalMatchEvent {
  eventId: string;
  matchId: string;
  eventType: 'goal' | 'card' | 'substitution' | 'penalty' | 'other';
  minute: number | null;
  stoppageMinute?: number | null;
  teamId?: string;
  playerName?: string;
  label: string;
  occurredAtKnown: boolean;
}

export interface CanonicalMatchTeamStat {
  statId: string;
  matchId: string;
  teamId: string;
  statType: string;
  value: number | string | boolean | null;
}

export interface FieldProvenance {
  entityType: 'match' | 'team' | 'competition' | 'event' | 'stat';
  entityId: string;
  fieldPath: string;
  provider: ProviderId;
  providerEntityId: string;
  observedAt: string;
  confidence: number;
  valueHash: string;
}

export interface SourceConflict {
  conflictId: string;
  entityType: FieldProvenance['entityType'];
  entityId: string;
  fieldPath: string;
  competingProviders: ProviderId[];
  chosenProvider?: ProviderId;
  resolutionReason?: string;
  detectedAt: string;
}
```

Add validators for raw envelope, canonical match, provider link, field provenance, and conflict records. They must reject `sportmonksFixtureId`, `providerFixtureId`, and `sourceProviderId` as canonical top-level fields.

Modify `LocalDataSourceId` to include `sportmonks`.

- [ ] **Step 4: Verify**

```powershell
pnpm exec vitest run packages/shared/src/contracts/provider-ingestion-contracts.test.ts packages/shared/src/contracts/local-match-contracts.test.ts
pnpm run typecheck
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add packages/shared/src/contracts/provider-ingestion-contracts.ts packages/shared/src/contracts/provider-ingestion-contracts.test.ts packages/shared/src/contracts/local-match-contracts.ts packages/shared/src/contracts/local-match-contracts.test.ts packages/shared/src/contracts/index.ts
git commit -m "feat(data): add provider-neutral ingestion contracts"
```

## Task 2: Provider-Neutral Raw Cache, Manifest, And Warehouse Writers

**Purpose:** Persist raw provider responses and canonical records in a structure that survives Sportmonks deletion.

**Files:**

- Create `scripts/providers/shared/raw-cache.ts`
- Create `scripts/providers/shared/raw-cache.test.ts`
- Create `scripts/providers/shared/manifest.ts`
- Create `scripts/providers/shared/manifest.test.ts`
- Create `scripts/providers/shared/canonical-warehouse.ts`
- Create `scripts/providers/shared/canonical-warehouse.test.ts`
- Create `apps/api/data/providers/sportmonks/raw/.gitkeep`
- Create `apps/api/data/providers/sportmonks/manifests/.gitkeep`
- Create `apps/api/data/providers/sportmonks/reports/.gitkeep`
- Create `apps/api/data/warehouse/.gitkeep`
- Modify `.gitignore`

- [ ] **Step 1: Write failing tests**

```ts
import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { createPayloadHash, writeRawProviderPayload } from './raw-cache.js';
import { appendProviderManifestEntry } from './manifest.js';
import { appendCanonicalWarehouseRecord } from './canonical-warehouse.js';

describe('provider-neutral raw cache and warehouse', () => {
  it('hashes semantically identical payloads the same way', () => {
    expect(createPayloadHash({ b: 2, a: 1 })).toBe(createPayloadHash({ a: 1, b: 2 }));
  });

  it('writes provider raw payloads under provider and endpoint paths', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-provider-'));
    const path = await writeRawProviderPayload(root, {
      schemaVersion: 'miraichi.provider.raw.v1',
      provider: 'sportmonks',
      endpointKey: 'fixtures.all',
      urlPath: '/v3/football/fixtures',
      query: { page: '1' },
      fetchedAt: '2026-07-02T00:00:00.000Z',
      payloadHash: createPayloadHash({ data: [{ id: 1 }] }),
      rateLimit: {},
      payload: { data: [{ id: 1 }] }
    });

    expect(path).toContain(join('providers', 'sportmonks', 'raw', 'fixtures.all'));
    expect(JSON.parse(await readFile(path, 'utf8')).provider).toBe('sportmonks');
  });

  it('appends provider manifests and canonical warehouse jsonl records', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-provider-'));
    await appendProviderManifestEntry(root, 'sportmonks', {
      provider: 'sportmonks',
      endpointKey: 'fixtures.all',
      urlPath: '/v3/football/fixtures',
      query: { page: '1' },
      status: 'captured',
      page: 1,
      hasMore: false,
      recordCount: 1
    });
    await appendCanonicalWarehouseRecord(root, 'canonical-matches', {
      matchId: 'match-1',
      competitionId: 'competition-1',
      season: '2026',
      kickoffUtc: '2026-07-02T12:00:00.000Z',
      status: 'scheduled',
      homeTeamId: 'team-home',
      awayTeamId: 'team-away',
      scoreHome: null,
      scoreAway: null,
      updatedAt: '2026-07-02T00:00:00.000Z'
    });

    expect(await readFile(join(root, 'providers', 'sportmonks', 'manifests', 'capture-manifest.jsonl'), 'utf8')).toContain('"status":"captured"');
    expect(await readFile(join(root, 'warehouse', 'canonical-matches.jsonl'), 'utf8')).toContain('"matchId":"match-1"');
  });
});
```

- [ ] **Step 2: Run tests and observe failure**

```powershell
pnpm exec vitest run scripts/providers/shared/raw-cache.test.ts scripts/providers/shared/manifest.test.ts scripts/providers/shared/canonical-warehouse.test.ts
```

Expected: fail because modules do not exist.

- [ ] **Step 3: Implement shared writers**

Implement:

```ts
export function createPayloadHash(payload: unknown): string;
export async function writeRawProviderPayload(root: string, envelope: RawProviderPayloadEnvelope): Promise<string>;
export async function appendProviderManifestEntry(root: string, provider: ProviderId, entry: ProviderCaptureManifestEntry): Promise<void>;
export async function appendCanonicalWarehouseRecord(root: string, collection: 'canonical-matches' | 'canonical-teams' | 'canonical-competitions' | 'match-provider-links' | 'match-events' | 'match-team-stats' | 'field-provenance' | 'conflicts', record: unknown): Promise<void>;
```

Paths:

```text
<root>/providers/<provider>/raw/<endpointKey>/<YYYY-MM-DD>/<payloadHash>.json
<root>/providers/<provider>/manifests/capture-manifest.jsonl
<root>/warehouse/<collection>.jsonl
```

- [ ] **Step 4: Git-ignore local provider payloads**

Add:

```gitignore
apps/api/data/providers/*/raw/**
apps/api/data/providers/*/manifests/**
apps/api/data/providers/*/reports/**
!apps/api/data/providers/*/raw/.gitkeep
!apps/api/data/providers/*/manifests/.gitkeep
!apps/api/data/providers/*/reports/.gitkeep
```

Do not ignore `apps/api/data/warehouse/*.jsonl` globally. Promotion of warehouse files is an explicit owner/code-review decision.

- [ ] **Step 5: Verify**

```powershell
pnpm exec vitest run scripts/providers/shared/raw-cache.test.ts scripts/providers/shared/manifest.test.ts scripts/providers/shared/canonical-warehouse.test.ts
pnpm run typecheck
```

Expected: pass.

- [ ] **Step 6: Commit**

```powershell
git add .gitignore apps/api/data/providers apps/api/data/warehouse scripts/providers/shared
git commit -m "feat(data): add provider-neutral raw cache and warehouse"
```

## Task 3: Entity Resolution And Provenance Utilities

**Purpose:** Prevent a future “mớ hỗn độn” by making provider merge rules explicit.

**Files:**

- Create `scripts/providers/shared/entity-resolution.ts`
- Create `scripts/providers/shared/entity-resolution.test.ts`
- Create `scripts/providers/shared/provenance.ts`
- Create `scripts/providers/shared/provenance.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { buildCanonicalMatchId, scoreProviderMatchCandidate } from './entity-resolution.js';
import { createFieldProvenance } from './provenance.js';

describe('provider-neutral entity resolution', () => {
  it('builds canonical match ids without provider ids', () => {
    expect(buildCanonicalMatchId({
      kickoffUtc: '2026-07-02T12:00:00.000Z',
      homeTeamName: 'Japan',
      awayTeamName: 'Vietnam'
    })).toBe('match-20260702-japan-vietnam');
  });

  it('scores exact team and near kickoff match candidates highly', () => {
    expect(scoreProviderMatchCandidate({
      canonicalKickoffUtc: '2026-07-02T12:00:00.000Z',
      providerKickoffUtc: '2026-07-02T12:05:00.000Z',
      canonicalHomeTeamName: 'Japan',
      providerHomeTeamName: 'Japan',
      canonicalAwayTeamName: 'Vietnam',
      providerAwayTeamName: 'Vietnam'
    })).toBeGreaterThanOrEqual(0.95);
  });
});

describe('provider-neutral provenance', () => {
  it('creates field provenance records with value hashes', () => {
    expect(createFieldProvenance({
      entityType: 'match',
      entityId: 'match-20260702-japan-vietnam',
      fieldPath: 'scoreHome',
      provider: 'sportmonks',
      providerEntityId: '123456',
      value: 2,
      observedAt: '2026-07-02T00:00:00.000Z',
      confidence: 0.95
    })).toMatchObject({
      entityType: 'match',
      entityId: 'match-20260702-japan-vietnam',
      fieldPath: 'scoreHome',
      provider: 'sportmonks',
      providerEntityId: '123456',
      valueHash: expect.stringMatching(/^[a-f0-9]{64}$/)
    });
  });
});
```

- [ ] **Step 2: Run tests and observe failure**

```powershell
pnpm exec vitest run scripts/providers/shared/entity-resolution.test.ts scripts/providers/shared/provenance.test.ts
```

Expected: fail because utilities do not exist.

- [ ] **Step 3: Implement utilities**

Rules:

- Canonical match IDs use date and normalized team names, not provider IDs.
- Team-name normalization lowercases, strips punctuation, replaces whitespace with `-`, and removes duplicate hyphens.
- Candidate scoring combines kickoff difference and team-name exactness.
- Field provenance hashes the JSON value with canonical object-key ordering.

- [ ] **Step 4: Verify**

```powershell
pnpm exec vitest run scripts/providers/shared/entity-resolution.test.ts scripts/providers/shared/provenance.test.ts
pnpm run typecheck
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add scripts/providers/shared/entity-resolution.ts scripts/providers/shared/entity-resolution.test.ts scripts/providers/shared/provenance.ts scripts/providers/shared/provenance.test.ts
git commit -m "feat(data): add provider-neutral resolution and provenance"
```

## Task 4: Sportmonks Config, Endpoint Catalog, And Token Boundary

**Purpose:** Keep Sportmonks isolated and removable while still enabling urgent trial capture.

**Files:**

- Create `scripts/providers/sportmonks/config.ts`
- Create `scripts/providers/sportmonks/config.test.ts`
- Create `scripts/providers/sportmonks/endpoint-catalog.ts`
- Create `scripts/providers/sportmonks/endpoint-catalog.test.ts`
- Modify `.env.example`
- Modify `package.json`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { readSportmonksCaptureConfig } from './config.js';
import { buildSportmonksEndpointCatalog } from './endpoint-catalog.js';

describe('sportmonks provider config', () => {
  it('requires a token but keeps root provider-neutral', () => {
    expect(() => readSportmonksCaptureConfig({})).toThrow('SPORTMONKS_API_TOKEN is required');
    expect(readSportmonksCaptureConfig({
      SPORTMONKS_API_TOKEN: 'token',
      PROVIDER_CAPTURE_ROOT: 'apps/api/data'
    })).toMatchObject({
      provider: 'sportmonks',
      captureRoot: 'apps/api/data',
      allowGatedEndpoints: false
    });
  });
});

describe('sportmonks endpoint catalog', () => {
  it('contains broad allowed endpoint families and gated risky families', () => {
    const catalog = buildSportmonksEndpointCatalog();
    expect(catalog.map((item) => item.endpointKey)).toEqual(expect.arrayContaining([
      'types.all',
      'states.all',
      'countries.all',
      'leagues.all',
      'seasons.all',
      'teams.all',
      'players.all',
      'venues.all',
      'fixtures.all',
      'fixtures.enrichedById',
      'standings.all'
    ]));
    expect(catalog.filter((item) => item.capturePolicy === 'gated').map((item) => item.group).sort()).toEqual([
      'livescores',
      'news',
      'odds',
      'predictions',
      'xg'
    ]);
  });
});
```

- [ ] **Step 2: Run tests and observe failure**

```powershell
pnpm exec vitest run scripts/providers/sportmonks/config.test.ts scripts/providers/sportmonks/endpoint-catalog.test.ts
```

Expected: fail because modules do not exist.

- [ ] **Step 3: Implement config and catalog**

Config:

```ts
export interface SportmonksCaptureConfig {
  provider: 'sportmonks';
  apiToken: string;
  apiBaseUrl: string;
  captureRoot: string;
  maxRequestsPerMinute: number;
  allowGatedEndpoints: boolean;
}
```

Defaults:

```text
SPORTMONKS_API_BASE_URL=https://api.sportmonks.com/v3/football
PROVIDER_CAPTURE_ROOT=apps/api/data
SPORTMONKS_MAX_REQUESTS_PER_MINUTE=120
SPORTMONKS_ALLOW_GATED_ENDPOINTS=false
```

Catalog includes allowed endpoint families:

```text
types, states, countries, regions, cities, venues, referees, coaches,
leagues, seasons, stages, rounds, groups, schedules, standings,
teams, players, squads, transfers, sidelined,
fixtures, fixture detail includes, fixture statistics, team/player/season statistics
```

Gated endpoint families:

```text
livescores, odds, predictions, news, xg
```

- [ ] **Step 4: Update env and scripts**

`.env.example`:

```dotenv
# Provider-neutral local capture root.
PROVIDER_CAPTURE_ROOT=apps/api/data

# Sportmonks trial capture. Keep token local-only. Do not commit real values.
SPORTMONKS_API_TOKEN=
SPORTMONKS_MAX_REQUESTS_PER_MINUTE=120
SPORTMONKS_ALLOW_GATED_ENDPOINTS=false
```

`package.json`:

```json
{
  "scripts": {
    "data:capture:sportmonks": "tsx scripts/capture-sportmonks-trial-data.ts",
    "data:verify:sportmonks": "tsx scripts/providers/sportmonks/verify-capture.ts",
    "data:export:warehouse:matches": "tsx scripts/export-warehouse-to-local-match-snapshot.ts"
  }
}
```

- [ ] **Step 5: Verify**

```powershell
pnpm exec vitest run scripts/providers/sportmonks/config.test.ts scripts/providers/sportmonks/endpoint-catalog.test.ts
pnpm run typecheck
```

Expected: pass.

- [ ] **Step 6: Commit**

```powershell
git add .env.example package.json scripts/providers/sportmonks/config.ts scripts/providers/sportmonks/config.test.ts scripts/providers/sportmonks/endpoint-catalog.ts scripts/providers/sportmonks/endpoint-catalog.test.ts
git commit -m "feat(data): configure removable sportmonks provider"
```

## Task 5: Sportmonks HTTP Client And Raw Capture

**Purpose:** Start trial capture quickly while writing only provider-neutral raw envelopes and manifests.

**Files:**

- Create `scripts/providers/sportmonks/client.ts`
- Create `scripts/providers/sportmonks/client.test.ts`
- Create `scripts/providers/sportmonks/capture.ts`
- Create `scripts/providers/sportmonks/capture.test.ts`
- Create `scripts/capture-sportmonks-trial-data.ts`

- [ ] **Step 1: Write failing client and capture tests**

```ts
import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it, vi } from 'vitest';
import { createSportmonksClient } from './client.js';
import { runSportmonksRawCapture } from './capture.js';

describe('sportmonks client', () => {
  it('adds api_token internally and treats 403 as unavailable', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ message: 'forbidden' }), { status: 403 }));
    const client = createSportmonksClient({
      apiBaseUrl: 'https://api.sportmonks.com/v3/football',
      apiToken: 'secret-token',
      fetchImpl,
      wait: async () => undefined
    });
    await expect(client.get('/odds/pre-match', {})).resolves.toMatchObject({ ok: false, status: 'unavailable' });
    const url = new URL(fetchImpl.mock.calls[0]![0] as string);
    expect(url.searchParams.get('api_token')).toBe('secret-token');
  });
});

describe('sportmonks raw capture', () => {
  it('captures allowed endpoints and skips gated endpoints by default', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-provider-'));
    const client = {
      async get(path: string) {
        return { ok: true as const, path, query: {}, body: { data: [{ id: 1 }], pagination: { has_more: false } }, rateLimit: {} };
      }
    };
    const result = await runSportmonksRawCapture({
      captureRoot: root,
      allowGatedEndpoints: false,
      client,
      catalog: [
        { endpointKey: 'fixtures.all', group: 'fixtures', method: 'GET', pathTemplate: '/fixtures', defaultQuery: { filters: 'populate' }, capturePolicy: 'allowed', priority: 1 },
        { endpointKey: 'odds.preMatch', group: 'odds', method: 'GET', pathTemplate: '/odds/pre-match', defaultQuery: {}, capturePolicy: 'gated', priority: 9 }
      ],
      log: () => undefined
    });

    expect(result).toMatchObject({ captured: 1, skipped: 1, failed: 0 });
    expect(await readFile(join(root, 'providers', 'sportmonks', 'manifests', 'capture-manifest.jsonl'), 'utf8')).toContain('"provider":"sportmonks"');
  });
});
```

- [ ] **Step 2: Run tests and observe failure**

```powershell
pnpm exec vitest run scripts/providers/sportmonks/client.test.ts scripts/providers/sportmonks/capture.test.ts
```

Expected: fail because modules do not exist.

- [ ] **Step 3: Implement client**

Rules:

- Add `api_token` internally.
- Never include token in manifest/error messages.
- `403` and `404` become `unavailable`.
- `429` becomes `rate_limited`.
- Retry `5xx` twice with backoff.
- Parse rate-limit metadata from response body/headers.

- [ ] **Step 4: Implement raw capture**

Rules:

- Sort catalog by `priority`.
- Skip gated endpoints unless `allowGatedEndpoints === true`.
- Page while `pagination.has_more === true`.
- Write raw payloads via `scripts/providers/shared/raw-cache.ts`.
- Append manifests via `scripts/providers/shared/manifest.ts`.
- Continue after endpoint-level unavailable/failure.

CLI `scripts/capture-sportmonks-trial-data.ts` wires config, catalog, client, and capture runner.

- [ ] **Step 5: Verify**

```powershell
pnpm exec vitest run scripts/providers/sportmonks/client.test.ts scripts/providers/sportmonks/capture.test.ts
pnpm run typecheck
```

Expected: pass.

- [ ] **Step 6: First real capture**

Local `.env`:

```dotenv
SPORTMONKS_API_TOKEN=<your trial token>
PROVIDER_CAPTURE_ROOT=apps/api/data
SPORTMONKS_MAX_REQUESTS_PER_MINUTE=120
SPORTMONKS_ALLOW_GATED_ENDPOINTS=false
```

Run:

```powershell
pnpm run data:capture:sportmonks
```

Expected: raw files and manifests appear under `apps/api/data/providers/sportmonks/`, not under warehouse.

- [ ] **Step 7: Commit code only**

```powershell
git add scripts/capture-sportmonks-trial-data.ts scripts/providers/sportmonks/client.ts scripts/providers/sportmonks/client.test.ts scripts/providers/sportmonks/capture.ts scripts/providers/sportmonks/capture.test.ts
git status --short
git commit -m "feat(data): capture sportmonks raw provider payloads"
```

Expected: raw files are ignored and not staged.

## Task 6: Sportmonks Fixture Enrichment And Warehouse Normalization

**Purpose:** Convert Sportmonks fixture payloads into canonical warehouse records with provider links and provenance.

**Files:**

- Modify `scripts/providers/sportmonks/capture.ts`
- Modify `scripts/providers/sportmonks/capture.test.ts`
- Create `scripts/providers/sportmonks/normalize-to-warehouse.ts`
- Create `scripts/providers/sportmonks/normalize-to-warehouse.test.ts`

- [ ] **Step 1: Write failing enrichment and normalization tests**

```ts
import { describe, expect, it } from 'vitest';
import { buildFixtureEnrichmentRequests } from './capture.js';
import { normalizeSportmonksFixtureToWarehouseRecords } from './normalize-to-warehouse.js';

describe('sportmonks fixture enrichment', () => {
  it('builds fixture detail requests without changing canonical ids', () => {
    expect(buildFixtureEnrichmentRequests([100])).toEqual([
      {
        endpointKey: 'fixtures.enrichedById',
        path: '/fixtures/100',
        query: { include: 'scores;participants;statistics.type;events;lineups;league;season;stage;round;venue;state' }
      }
    ]);
  });
});

describe('sportmonks warehouse normalization', () => {
  it('normalizes fixtures into canonical match, link, and provenance records', () => {
    const records = normalizeSportmonksFixtureToWarehouseRecords({
      id: 123,
      league_id: 732,
      season_id: 23614,
      starting_at: '2026-07-02 12:00:00',
      state_id: 1,
      participants: [
        { id: 1, name: 'Japan', meta: { location: 'home' } },
        { id: 2, name: 'Vietnam', meta: { location: 'away' } }
      ],
      league: { id: 732, name: 'World Cup' },
      season: { id: 23614, name: '2026' },
      scores: []
    }, '2026-07-02T00:00:00.000Z');

    expect(records.match).toMatchObject({
      matchId: 'match-20260702-japan-vietnam',
      competitionId: 'competition-world-cup',
      homeTeamId: 'team-japan',
      awayTeamId: 'team-vietnam',
      scoreHome: null,
      scoreAway: null
    });
    expect(records.links).toContainEqual(expect.objectContaining({
      entityType: 'match',
      entityId: 'match-20260702-japan-vietnam',
      provider: 'sportmonks',
      providerEntityId: '123'
    }));
    expect(records.provenance.some((item) => item.fieldPath === 'kickoffUtc')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests and observe failure**

```powershell
pnpm exec vitest run scripts/providers/sportmonks/capture.test.ts scripts/providers/sportmonks/normalize-to-warehouse.test.ts
```

Expected: fail because enrichment and normalizer functions do not exist.

- [ ] **Step 3: Implement enrichment**

Rules:

- Extract fixture IDs from raw `fixtures.all` payloads.
- Dedupe IDs.
- Skip IDs already captured as enriched raw payloads.
- Fetch includes:

```text
scores;participants;statistics.type;events;lineups;league;season;stage;round;venue;state
```

- Store enriched raw payloads in provider raw cache.

- [ ] **Step 4: Implement warehouse normalization**

Rules:

- Use provider-neutral canonical IDs from shared entity-resolution utilities.
- Store Sportmonks fixture ID only in provider links.
- Write canonical match/team/competition records.
- Write event/stat records when present.
- Write field provenance for every populated canonical field.
- Skip in-play/live status in Phase 9.
- Skip non-national-team competitions from active local snapshot export, but raw payloads may remain archived.

- [ ] **Step 5: Run real enrichment and normalization**

```powershell
pnpm run data:capture:sportmonks -- --enrich-fixtures
pnpm exec tsx scripts/providers/sportmonks/normalize-to-warehouse.ts
```

Expected: warehouse JSONL files are written under `apps/api/data/warehouse/`.

- [ ] **Step 6: Verify**

```powershell
pnpm exec vitest run scripts/providers/sportmonks/capture.test.ts scripts/providers/sportmonks/normalize-to-warehouse.test.ts
pnpm run typecheck
```

Expected: pass.

- [ ] **Step 7: Commit**

```powershell
git add scripts/providers/sportmonks/capture.ts scripts/providers/sportmonks/capture.test.ts scripts/providers/sportmonks/normalize-to-warehouse.ts scripts/providers/sportmonks/normalize-to-warehouse.test.ts
git commit -m "feat(data): normalize sportmonks fixtures into warehouse"
```

## Task 7: Export Canonical Warehouse To Local Match Snapshot

**Purpose:** Make the app read warehouse-derived match data without knowing Sportmonks exists.

**Files:**

- Create `scripts/export-warehouse-to-local-match-snapshot.ts`
- Create `scripts/export-warehouse-to-local-match-snapshot.test.ts`
- Modify `apps/api/data/local-match-snapshots/README.md`
- Modify `package.json`

- [ ] **Step 1: Write failing export test**

```ts
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { exportWarehouseToLocalMatchSnapshot } from './export-warehouse-to-local-match-snapshot.js';

describe('warehouse to local match snapshot export', () => {
  it('exports canonical warehouse matches into the existing app snapshot shape', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-warehouse-'));
    const warehouse = join(root, 'warehouse');
    await import('node:fs/promises').then((fs) => fs.mkdir(warehouse, { recursive: true }));
    await writeFile(join(warehouse, 'canonical-competitions.jsonl'), JSON.stringify({ competitionId: 'competition-world-cup', name: 'World Cup', type: 'national-team', updatedAt: '2026-07-02T00:00:00.000Z' }) + '\n');
    await writeFile(join(warehouse, 'canonical-teams.jsonl'), [
      JSON.stringify({ teamId: 'team-japan', name: 'Japan', updatedAt: '2026-07-02T00:00:00.000Z' }),
      JSON.stringify({ teamId: 'team-vietnam', name: 'Vietnam', updatedAt: '2026-07-02T00:00:00.000Z' })
    ].join('\n') + '\n');
    await writeFile(join(warehouse, 'canonical-matches.jsonl'), JSON.stringify({
      matchId: 'match-20260702-japan-vietnam',
      competitionId: 'competition-world-cup',
      season: '2026',
      kickoffUtc: '2026-07-02T12:00:00.000Z',
      status: 'scheduled',
      homeTeamId: 'team-japan',
      awayTeamId: 'team-vietnam',
      scoreHome: null,
      scoreAway: null,
      updatedAt: '2026-07-02T00:00:00.000Z'
    }) + '\n');
    await writeFile(join(warehouse, 'match-provider-links.jsonl'), JSON.stringify({
      entityType: 'match',
      entityId: 'match-20260702-japan-vietnam',
      provider: 'sportmonks',
      providerEntityType: 'fixture',
      providerEntityId: '123',
      confidence: 0.98,
      linkedBy: 'test',
      linkedAt: '2026-07-02T00:00:00.000Z'
    }) + '\n');

    const outputPath = join(root, 'national-team-matches.json');
    const result = await exportWarehouseToLocalMatchSnapshot({ root, outputPath, importedAt: '2026-07-02T00:00:00.000Z' });
    const snapshot = JSON.parse(await readFile(outputPath, 'utf8'));

    expect(result.matchCount).toBe(1);
    expect(snapshot.matches[0]).toMatchObject({
      id: 'match-20260702-japan-vietnam',
      sourceRefs: [{ sourceId: 'sportmonks', sourceMatchId: '123' }]
    });
  });
});
```

- [ ] **Step 2: Run test and observe failure**

```powershell
pnpm exec vitest run scripts/export-warehouse-to-local-match-snapshot.test.ts
```

Expected: fail because exporter does not exist.

- [ ] **Step 3: Implement exporter**

Rules:

- Read warehouse JSONL files.
- Join matches to teams/competitions/provider links.
- Export only `competition.type === 'national-team'`.
- Exclude live/in-play records.
- Validate output with existing local match contracts.
- Write to `apps/api/data/local-match-snapshots/national-team-matches.json` by default.

- [ ] **Step 4: Add script**

`package.json`:

```json
{
  "scripts": {
    "data:export:warehouse:matches": "tsx scripts/export-warehouse-to-local-match-snapshot.ts"
  }
}
```

- [ ] **Step 5: Verify**

```powershell
pnpm exec vitest run scripts/export-warehouse-to-local-match-snapshot.test.ts packages/shared/src/contracts/local-match-contracts.test.ts
pnpm run data:export:warehouse:matches
pnpm run data:validate:national-teams
pnpm run phase9:local-data-api-verify
```

Expected: app snapshot validates and match API tests pass.

- [ ] **Step 6: Commit**

```powershell
git add scripts/export-warehouse-to-local-match-snapshot.ts scripts/export-warehouse-to-local-match-snapshot.test.ts apps/api/data/local-match-snapshots/README.md package.json
git commit -m "feat(data): export warehouse matches to local snapshot"
```

## Task 8: Capture Verification And Sportmonks Deletion Drill

**Purpose:** Prove the sprint captured usable data and Sportmonks can be removed later.

**Files:**

- Create `scripts/providers/sportmonks/verify-capture.ts`
- Create `scripts/providers/sportmonks/verify-capture.test.ts`
- Modify `PROJECT_PLAN.md`

- [ ] **Step 1: Write failing verifier tests**

```ts
import { describe, expect, it } from 'vitest';
import { summarizeProviderManifest, verifySportmonksDeletionBoundary } from './verify-capture.js';

describe('sportmonks capture verifier', () => {
  it('summarizes captured, skipped, unavailable, and failed manifest entries', () => {
    expect(summarizeProviderManifest([
      { provider: 'sportmonks', endpointKey: 'fixtures.all', status: 'captured', recordCount: 25 },
      { provider: 'sportmonks', endpointKey: 'odds.preMatch', status: 'skipped' },
      { provider: 'sportmonks', endpointKey: 'players.all', status: 'unavailable' },
      { provider: 'sportmonks', endpointKey: 'standings.all', status: 'failed', errorMessage: 'timeout' }
    ])).toEqual({ captured: 1, skipped: 1, unavailable: 1, failed: 1, recordsCaptured: 25 });
  });

  it('verifies provider-neutral artifacts do not import Sportmonks runtime code', () => {
    expect(verifySportmonksDeletionBoundary([
      { path: 'scripts/providers/shared/raw-cache.ts', source: 'export const x = 1;' },
      { path: 'scripts/export-warehouse-to-local-match-snapshot.ts', source: 'export const y = 1;' }
    ])).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run tests and observe failure**

```powershell
pnpm exec vitest run scripts/providers/sportmonks/verify-capture.test.ts
```

Expected: fail because verifier does not exist.

- [ ] **Step 3: Implement verifier**

Verifier must:

- Read `apps/api/data/providers/sportmonks/manifests/capture-manifest.jsonl`.
- Summarize captured/skipped/unavailable/failed counts.
- List allowed high-priority endpoints never attempted.
- List unavailable endpoints.
- Verify `scripts/providers/shared/*` and `scripts/export-warehouse-to-local-match-snapshot.ts` do not import from `scripts/providers/sportmonks/*`.
- Write report to `apps/api/data/providers/sportmonks/reports/capture-report-<timestamp>.json`.

- [ ] **Step 4: Verify**

```powershell
pnpm exec vitest run scripts/providers/sportmonks/verify-capture.test.ts
pnpm run data:verify:sportmonks
pnpm run verify:local
```

Expected: pass after at least one raw capture run. If no capture exists, verifier reports missing manifest and prints `pnpm run data:capture:sportmonks`.

- [ ] **Step 5: Update project plan**

Record:

```markdown
- [x] Create `phase:implementation-plan Phase 9 Sportmonks Trial Data Capture Sprint`.
  - **Plan**: See `docs/superpowers/plans/2026-07-02-phase-9-sportmonks-trial-data-capture-sprint.md`.
  - **Scope**: Provider-neutral raw cache/warehouse first, Sportmonks as removable trial adapter, no live polling, no AI training, no betting formulas.
```

- [ ] **Step 6: Commit**

```powershell
git add scripts/providers/sportmonks/verify-capture.ts scripts/providers/sportmonks/verify-capture.test.ts PROJECT_PLAN.md
git commit -m "test(data): verify sportmonks capture and deletion boundary"
```

## Slice Execution Order

Execute one lifecycle slice at a time:

1. `phase:code-slice Phase 9 Provider-Neutral Ingestion Contracts`
2. `phase:code-slice Phase 9 Provider-Neutral Raw Cache And Warehouse`
3. `phase:code-slice Phase 9 Provider-Neutral Entity Resolution And Provenance`
4. `phase:code-slice Phase 9 Sportmonks Config And Endpoint Catalog`
5. `phase:code-slice Phase 9 Sportmonks Raw Capture`
6. `phase:code-slice Phase 9 Sportmonks Fixture Enrichment And Warehouse Normalization`
7. `phase:code-slice Phase 9 Warehouse To Local Match Snapshot Export`
8. `phase:code-slice Phase 9 Sportmonks Capture Verification And Deletion Boundary`
9. `phase:integration-test Phase 9 Sportmonks Trial Data Capture Sprint`

## Daily Trial Operating Procedure

Run this during the trial after code slices 1-7 exist:

```powershell
pnpm run data:capture:sportmonks
pnpm run data:capture:sportmonks -- --enrich-fixtures
pnpm exec tsx scripts/providers/sportmonks/normalize-to-warehouse.ts
pnpm run data:export:warehouse:matches
pnpm run data:validate:national-teams
pnpm run data:verify:sportmonks
```

If `data:capture:sportmonks` hits rate limits, stop and resume after reset. Do not raise concurrency blindly.

## Explicitly Forbidden Scope

- Browser-to-Sportmonks calls.
- Committing `SPORTMONKS_API_TOKEN`.
- App/API runtime depending on Sportmonks token.
- Committing raw Sportmonks payloads unless explicitly approved for a tiny fixture sample.
- Using Sportmonks IDs as canonical Miraichi IDs.
- Storing `sportmonksFixtureId` or `sportmonksTeamId` in app contracts.
- Live polling or in-play app state.
- AI training, prediction runtime, prompts, embeddings, or model registry.
- Betting recommendations, ROI, CLV, Kelly, expected-return, stake sizing, or bankroll-risk formulas.
- Making odds/predictions/news/xG capture default without explicit owner confirmation.
- Adding another provider during this sprint.

## Definition of Done

- Provider-neutral contracts exist and include raw envelopes, manifests, canonical entities, links, provenance, and conflicts.
- Provider-neutral raw cache and warehouse writers exist under `scripts/providers/shared/`.
- Sportmonks code is isolated under `scripts/providers/sportmonks/`.
- Sportmonks token is local-only.
- Raw Sportmonks payloads are captured under `apps/api/data/providers/sportmonks/`.
- Canonical warehouse records are written under `apps/api/data/warehouse/`.
- App local snapshot is exported from warehouse, not directly from Sportmonks raw payloads.
- Verification proves provider-neutral code does not import Sportmonks-specific code.
- Deleting `scripts/providers/sportmonks/` after the trial leaves warehouse export and app snapshot usable.
- `pnpm run verify:local` passes after code changes.
