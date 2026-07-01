# Phase 8.6F API-Football National-Team JSONL Snapshot Store Implementation Plan

> **Status:** Superseded on 2026-07-01 by [ADR-0042](file:///c:/CODE/miraichi/docs/decisions/ADR-0042-local-data-api-and-api-football-removal.md) and [Phase 9 Non-AI App Completion Plan](file:///c:/CODE/miraichi/docs/product/PHASE-9-NON-AI-APP-COMPLETION-LOCAL-DATA-API-PLAN.md). Do not execute this plan. API-Football free-tier usage is no longer an active Miraichi roadmap dependency.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an owner-only, national-team-first API-Football raw snapshot pipeline that stores SQL-shaped JSONL records locally without adding predictions, odds, club competitions, or production database schema.

**Architecture:** Add focused TypeScript modules under `apps/local-ai/src/data/` for snapshot schemas, priority queues, API-Football mapping gates, JSONL persistence, raw-provider fetching, and orchestration. Keep generated provider payloads local and ignored, while committing source, tests, docs, and schema descriptions. Add a Phase 8 verifier script that checks the snapshot boundary without making live network calls.

**Tech Stack:** TypeScript, Node.js `fs/promises`, Node.js `crypto`, injected `fetch`, Vitest, existing pnpm scripts, JSON Lines.

---

## Scope Boundary

### Allowed

- API-Football national-team fixture raw payload snapshots.
- World Cup 2026 first, completed/terminal fixtures only.
- Competition order: World Cup, Euro, Copa America, AFCON, AFC Asian Cup, CONCACAF Gold Cup, UEFA Nations League.
- Local JSONL records shaped like future SQL tables.
- Full raw provider response body preservation.
- Dedupe by canonical JSON SHA-256 payload hash.
- Verified provider mapping gate.
- Quota-safe dry-run and resumable run manifests.
- Dead-letter records for invalid payloads.
- Source/tests/docs committed to git.

### Blocked

- Club competitions.
- All-league crawl.
- Live polling.
- Odds endpoints.
- Prediction runtime, model selection, betting recommendation, stake sizing, bankroll advice, ROI, CLV, or Kelly logic.
- Production database, ORM, migrations, D1, Supabase, Postgres, or cloud storage.
- Committed API key, secret, or paid provider config.
- Direct training from raw provider payloads.
- Committing generated large raw provider payloads by default.

## Gate Inputs

- Spec: `docs/superpowers/specs/2026-06-30-phase-8-6f-api-football-national-team-jsonl-snapshot-store-design.md`
- Registry: `apps/local-ai/config/competition-registry.json`
- ADR: `docs/decisions/ADR-0035-real-data-provider-selection-and-integration-strategy.md`
- ADR: `docs/decisions/ADR-0037-dataset-boundaries-and-schema-for-prediction.md`
- ADR: `docs/decisions/ADR-0039-provider-adapter-contract-and-data-validation-schema.md`
- Existing API-Football provider boundary: `apps/api/src/providers/api-football-client.ts`
- Current scripts: `package.json`

## File Map

- Create: `apps/local-ai/src/data/api-football-snapshot-schema.ts` - SQL-shaped JSONL record types, validation, canonical JSON, hashes, and deterministic ids.
- Create: `apps/local-ai/src/data/api-football-snapshot-schema.test.ts` - schema, id, validation, canonicalization, and secret-redaction tests.
- Create: `apps/local-ai/src/data/api-football-national-team-plan.ts` - national-team competition priority and season queue, including World Cup 2026 first.
- Create: `apps/local-ai/src/data/api-football-national-team-plan.test.ts` - priority and blocked-club/all-league tests.
- Create: `apps/local-ai/src/data/api-football-provider-mapping.ts` - JSONL mapping parser and verified-only provider mapping gate.
- Create: `apps/local-ai/src/data/api-football-provider-mapping.test.ts` - verified/unverified mapping behavior tests.
- Create: `apps/local-ai/src/data/api-football-jsonl-store.ts` - local JSONL writer/reader, raw payload dedupe, manifests, index, and dead-letter appenders.
- Create: `apps/local-ai/src/data/api-football-jsonl-store.test.ts` - filesystem tests using temporary directories.
- Create: `apps/local-ai/src/data/api-football-snapshot-client.ts` - raw API-Football fixtures client with injected fetcher, completed-only request building, redacted URL evidence, and response metadata.
- Create: `apps/local-ai/src/data/api-football-snapshot-client.test.ts` - client request, raw payload, HTTP failure, and no-secret tests.
- Create: `apps/local-ai/src/data/api-football-snapshot-runner.ts` - quota-safe orchestration that connects priority queue, mappings, client, and JSONL store.
- Create: `apps/local-ai/src/data/api-football-snapshot-runner.test.ts` - skip, quota, completed-only, dedupe, dead-letter, and report tests.
- Create: `scripts/phase8-api-football-snapshot-verify.ts` - non-network verifier for Phase 8.6F snapshot boundary.
- Create: `scripts/phase8-api-football-snapshot-verify.test.ts` - verifier failure/pass tests.
- Create: `scripts/phase8-api-football-snapshot.ts` - owner-run CLI entrypoint for actual local snapshot runs.
- Modify: `package.json` - add `phase8:api-football-snapshot` and `phase8:api-football-snapshot-verify`.
- Modify: `.gitignore` - ignore generated API-Football snapshot JSONL payloads/manifests/indexes/reports by default.
- Create: `apps/local-ai/data/provider-snapshots/api-football/README.md` - local artifact layout and owner-run instructions.
- Create: `apps/local-ai/data/provider-snapshots/api-football/registry/competition_mappings.example.jsonl` - non-secret example mapping with unverified placeholders.
- Modify after implementation evidence: `PROJECT_PLAN.md` - record Phase 8.6F implementation result or blocker.

---

### Task 1: Add Snapshot Schema, IDs, Hashes, And Redaction

**Files:**
- Create: `apps/local-ai/src/data/api-football-snapshot-schema.ts`
- Create: `apps/local-ai/src/data/api-football-snapshot-schema.test.ts`

- [ ] **Step 1: Write the failing schema tests**

Create `apps/local-ai/src/data/api-football-snapshot-schema.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import {
  canonicalJson,
  completedApiFootballStatus,
  createFixtureIndexRecord,
  createIngestionRunId,
  createRequestBatchId,
  createSeasonId,
  hashPayload,
  providerFixtureId,
  rawPayloadId,
  redactApiFootballUrl,
  validateIngestionRunRecord,
  validateRawPayloadRecord
} from './api-football-snapshot-schema.js';

describe('api-football snapshot schema ids', () => {
  it('creates stable SQL-shaped ids without using team names or scores', () => {
    expect(createIngestionRunId(new Date('2026-06-30T00:00:00Z'), 'abcdef123456')).toBe(
      'api_football_run_20260630T000000Z_abcdef12'
    );
    expect(createRequestBatchId('api_football_run_20260630T000000Z_abcdef12', 3)).toBe(
      'api_football_request_abcdef12_0003'
    );
    expect(createSeasonId('comp-int-world-cup', 2026)).toBe('comp-int-world-cup_season_2026');
    expect(providerFixtureId(123456)).toBe('api_football_fixture_123456');
    expect(rawPayloadId('abc123')).toBe('api_football_raw_abc123');
  });
});

describe('api-football snapshot canonical payload hashing', () => {
  it('hashes equivalent objects identically regardless of property insertion order', () => {
    const left = { response: [{ b: 2, a: 1 }], get: 'fixtures' };
    const right = { get: 'fixtures', response: [{ a: 1, b: 2 }] };

    expect(canonicalJson(left)).toBe(canonicalJson(right));
    expect(hashPayload(left)).toBe(hashPayload(right));
    expect(rawPayloadId(hashPayload(left))).toMatch(/^api_football_raw_[a-f0-9]{64}$/);
  });
});

describe('api-football snapshot validation and redaction', () => {
  it('accepts valid manifest rows and rejects missing primary keys', () => {
    expect(validateIngestionRunRecord({
      runId: 'api_football_run_20260630T000000Z_abcdef12',
      providerId: 'api-football',
      startedAt: '2026-06-30T00:00:00.000Z',
      finishedAt: null,
      status: 'running',
      requestedCompetitionOrder: ['comp-int-world-cup'],
      requestedSeasonOrder: [{ internalCompetitionId: 'comp-int-world-cup', season: 2026 }],
      requestCount: 0,
      fixtureCount: 0,
      completedFixtureCount: 0,
      skippedCompetitionCount: 0,
      errorCount: 0,
      quotaLimit: 100,
      quotaRemainingAtEnd: 100
    }).ok).toBe(true);

    expect(validateRawPayloadRecord({
      providerId: 'api-football',
      endpoint: 'fixtures'
    }).ok).toBe(false);
  });

  it('redacts API keys from URLs and recognizes only terminal completed statuses', () => {
    expect(redactApiFootballUrl('https://v3.football.api-sports.io/fixtures?league=1&key=secret')).toBe(
      'https://v3.football.api-sports.io/fixtures?league=1&key=REDACTED'
    );
    expect(completedApiFootballStatus('FT')).toBe(true);
    expect(completedApiFootballStatus('AET')).toBe(true);
    expect(completedApiFootballStatus('PEN')).toBe(true);
    expect(completedApiFootballStatus('LIVE')).toBe(false);
    expect(completedApiFootballStatus('NS')).toBe(false);
  });
});

describe('api-football fixture index record', () => {
  it('marks active World Cup 2026 completed fixtures as completed_unverified', () => {
    const record = createFixtureIndexRecord({
      internalCompetitionId: 'comp-int-world-cup',
      providerCompetitionId: 'api_football_league_1',
      providerLeagueId: 1,
      providerSeason: 2026,
      providerFixtureNumericId: 999,
      statusShort: 'FT',
      statusLong: 'Match Finished',
      fixtureDate: '2026-06-30T10:00:00+00:00',
      homeTeamProviderId: 10,
      awayTeamProviderId: 20,
      latestRawPayloadId: 'api_football_raw_abc',
      latestPayloadHash: 'abc',
      firstSeenAt: '2026-06-30T00:00:00.000Z',
      lastSeenAt: '2026-06-30T00:00:00.000Z'
    });

    expect(record.internalFixtureId).toBe('comp-int-world-cup_2026_api_football_fixture_999');
    expect(record.providerFixtureId).toBe('api_football_fixture_999');
    expect(record.snapshotStability).toBe('completed_unverified');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm exec vitest run apps/local-ai/src/data/api-football-snapshot-schema.test.ts
```

Expected: FAIL because `apps/local-ai/src/data/api-football-snapshot-schema.ts` does not exist.

- [ ] **Step 3: Add the minimal schema implementation**

Create `apps/local-ai/src/data/api-football-snapshot-schema.ts` with these exports and behavior:

```typescript
import { createHash } from 'crypto';

export type SnapshotStatus = 'planned' | 'running' | 'completed' | 'blocked' | 'failed' | 'partial';
export type RequestStatus = 'success' | 'blocked' | 'failed' | 'skipped';
export type SnapshotStability = 'active_partial' | 'completed_unverified' | 'completed_rechecked' | 'finalized';

export type SeasonQueueItem = {
  internalCompetitionId: string;
  season: number;
};

export type IngestionRunRecord = {
  runId: string;
  providerId: 'api-football';
  startedAt: string;
  finishedAt: string | null;
  status: SnapshotStatus;
  requestedCompetitionOrder: string[];
  requestedSeasonOrder: SeasonQueueItem[];
  requestCount: number;
  fixtureCount: number;
  completedFixtureCount: number;
  skippedCompetitionCount: number;
  errorCount: number;
  quotaLimit: number;
  quotaRemainingAtEnd: number;
};

export type RequestBatchRecord = {
  requestBatchId: string;
  runId: string;
  providerId: 'api-football';
  endpoint: 'fixtures' | 'leagues';
  requestUrlRedacted: string;
  requestParams: Record<string, string | number>;
  startedAt: string;
  finishedAt: string;
  httpStatus: number | null;
  rateLimitRemaining: number | null;
  responsePayloadHash: string | null;
  rawPayloadId: string | null;
  recordCount: number;
  status: RequestStatus;
  errorCode: string | null;
};

export type RawPayloadRecord = {
  rawPayloadId: string;
  runId: string;
  requestBatchId: string;
  providerId: 'api-football';
  endpoint: 'fixtures' | 'leagues';
  requestParams: Record<string, string | number>;
  fetchedAt: string;
  payloadHash: string;
  rawPayload: unknown;
};

export type RawPayloadIndexRecord = {
  rawPayloadId: string;
  runId: string;
  requestBatchId: string;
  providerId: 'api-football';
  endpoint: 'fixtures' | 'leagues';
  payloadHash: string;
  payloadPath: string;
  fetchedAt: string;
  byteSize: number;
  schemaVersion: 'api-football-raw-v1';
};

export type FixtureIndexRecord = {
  internalFixtureId: string;
  providerFixtureId: string;
  providerId: 'api-football';
  internalCompetitionId: string;
  providerCompetitionId: string;
  seasonId: string;
  providerSeason: number;
  statusShort: string;
  statusLong: string;
  fixtureDate: string;
  homeTeamProviderId: string;
  awayTeamProviderId: string;
  latestRawPayloadId: string;
  latestPayloadHash: string;
  snapshotStability: SnapshotStability;
  firstSeenAt: string;
  lastSeenAt: string;
};

export type ValidationResult = { ok: true } | { ok: false; errors: string[] };

function utcStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function createIngestionRunId(date: Date, entropy: string): string {
  return `api_football_run_${utcStamp(date)}_${entropy.slice(0, 8)}`;
}

export function createRequestBatchId(runId: string, sequence: number): string {
  const runHash = runId.split('_').at(-1) || 'unknown0';
  return `api_football_request_${runHash}_${String(sequence).padStart(4, '0')}`;
}

export function createSeasonId(internalCompetitionId: string, season: number): string {
  return `${internalCompetitionId}_season_${season}`;
}

export function providerFixtureId(fixtureId: number | string): string {
  return `api_football_fixture_${fixtureId}`;
}

export function rawPayloadId(payloadHash: string): string {
  return `api_football_raw_${payloadHash}`;
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalJson(entryValue)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function hashPayload(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

export function redactApiFootballUrl(url: string): string {
  const parsed = new URL(url);
  for (const key of ['key', 'api_key', 'apikey', 'x-apisports-key']) {
    if (parsed.searchParams.has(key)) {
      parsed.searchParams.set(key, 'REDACTED');
    }
  }
  return parsed.toString();
}

export function completedApiFootballStatus(statusShort: string | null | undefined): boolean {
  return statusShort === 'FT' || statusShort === 'AET' || statusShort === 'PEN';
}

function requireFields(record: Record<string, unknown>, fields: string[]): ValidationResult {
  const errors = fields.filter((field) => record[field] === undefined || record[field] === null || record[field] === '');
  return errors.length === 0 ? { ok: true } : { ok: false, errors: errors.map((field) => `Missing ${field}`) };
}

export function validateIngestionRunRecord(value: unknown): ValidationResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, errors: ['Record must be an object'] };
  return requireFields(value as Record<string, unknown>, ['runId', 'providerId', 'startedAt', 'status']);
}

export function validateRawPayloadRecord(value: unknown): ValidationResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, errors: ['Record must be an object'] };
  return requireFields(value as Record<string, unknown>, [
    'rawPayloadId',
    'runId',
    'requestBatchId',
    'providerId',
    'endpoint',
    'fetchedAt',
    'payloadHash',
    'rawPayload'
  ]);
}

export function createFixtureIndexRecord(input: {
  internalCompetitionId: string;
  providerCompetitionId: string;
  providerLeagueId: number;
  providerSeason: number;
  providerFixtureNumericId: number;
  statusShort: string;
  statusLong: string;
  fixtureDate: string;
  homeTeamProviderId: number;
  awayTeamProviderId: number;
  latestRawPayloadId: string;
  latestPayloadHash: string;
  firstSeenAt: string;
  lastSeenAt: string;
}): FixtureIndexRecord {
  return {
    internalFixtureId: `${input.internalCompetitionId}_${input.providerSeason}_${providerFixtureId(input.providerFixtureNumericId)}`,
    providerFixtureId: providerFixtureId(input.providerFixtureNumericId),
    providerId: 'api-football',
    internalCompetitionId: input.internalCompetitionId,
    providerCompetitionId: input.providerCompetitionId,
    seasonId: createSeasonId(input.internalCompetitionId, input.providerSeason),
    providerSeason: input.providerSeason,
    statusShort: input.statusShort,
    statusLong: input.statusLong,
    fixtureDate: input.fixtureDate,
    homeTeamProviderId: `api_football_team_${input.homeTeamProviderId}`,
    awayTeamProviderId: `api_football_team_${input.awayTeamProviderId}`,
    latestRawPayloadId: input.latestRawPayloadId,
    latestPayloadHash: input.latestPayloadHash,
    snapshotStability: input.internalCompetitionId === 'comp-int-world-cup' && input.providerSeason === 2026
      ? 'completed_unverified'
      : 'finalized',
    firstSeenAt: input.firstSeenAt,
    lastSeenAt: input.lastSeenAt
  };
}
```

- [ ] **Step 4: Run the schema tests to verify they pass**

Run:

```bash
pnpm exec vitest run apps/local-ai/src/data/api-football-snapshot-schema.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

Run:

```bash
git add apps/local-ai/src/data/api-football-snapshot-schema.ts apps/local-ai/src/data/api-football-snapshot-schema.test.ts
git commit -m "feat(local-ai): add api-football snapshot schema"
```

---

### Task 2: Add National-Team Priority Queue And Mapping Gate

**Files:**
- Create: `apps/local-ai/src/data/api-football-national-team-plan.ts`
- Create: `apps/local-ai/src/data/api-football-national-team-plan.test.ts`
- Create: `apps/local-ai/src/data/api-football-provider-mapping.ts`
- Create: `apps/local-ai/src/data/api-football-provider-mapping.test.ts`

- [ ] **Step 1: Write the failing priority and mapping tests**

Create `apps/local-ai/src/data/api-football-national-team-plan.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import {
  buildNationalTeamSeasonQueue,
  NATIONAL_TEAM_COMPETITION_ORDER,
  plannedSeasonsForCompetition
} from './api-football-national-team-plan.js';

describe('api-football national-team snapshot priority', () => {
  it('uses the owner-approved competition order and World Cup 2026 first', () => {
    expect(NATIONAL_TEAM_COMPETITION_ORDER).toEqual([
      'comp-int-world-cup',
      'comp-int-euro',
      'comp-int-copa-america',
      'comp-int-afcon',
      'comp-int-afc-asian-cup',
      'comp-int-concacaf-gold-cup',
      'comp-int-uefa-nations-league'
    ]);

    expect(plannedSeasonsForCompetition('comp-int-world-cup')).toEqual([2026, 2022, 2018, 2014, 2010, 2006, 2002]);
    expect(buildNationalTeamSeasonQueue()[0]).toEqual({ internalCompetitionId: 'comp-int-world-cup', season: 2026 });
  });

  it('does not include club competitions or all-league wildcard work', () => {
    const queue = buildNationalTeamSeasonQueue();
    expect(queue.some((item) => item.internalCompetitionId.includes('eng-pl'))).toBe(false);
    expect(queue.some((item) => item.internalCompetitionId === 'all-leagues')).toBe(false);
  });
});
```

Create `apps/local-ai/src/data/api-football-provider-mapping.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import {
  loadVerifiedApiFootballMappingsFromJsonl,
  resolveVerifiedMapping
} from './api-football-provider-mapping.js';

describe('api-football provider mapping gate', () => {
  it('loads only verified mappings for snapshot fetches', () => {
    const mappings = loadVerifiedApiFootballMappingsFromJsonl([
      JSON.stringify({
        internalCompetitionId: 'comp-int-world-cup',
        providerId: 'api-football',
        providerCompetitionId: 'api_football_league_1',
        providerLeagueId: 1,
        providerLeagueName: 'FIFA World Cup',
        providerCountry: 'World',
        verificationStatus: 'verified',
        verifiedAt: '2026-06-30T00:00:00.000Z',
        source: 'owner_verified'
      }),
      JSON.stringify({
        internalCompetitionId: 'comp-int-euro',
        providerId: 'api-football',
        providerCompetitionId: 'api_football_league_unknown',
        providerLeagueId: null,
        providerLeagueName: 'UEFA European Championship',
        providerCountry: 'World',
        verificationStatus: 'unverified',
        verifiedAt: null,
        source: 'owner_or_provider_discovery'
      })
    ].join('\n'));

    expect(resolveVerifiedMapping(mappings, 'comp-int-world-cup')?.providerLeagueId).toBe(1);
    expect(resolveVerifiedMapping(mappings, 'comp-int-euro')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
pnpm exec vitest run apps/local-ai/src/data/api-football-national-team-plan.test.ts apps/local-ai/src/data/api-football-provider-mapping.test.ts
```

Expected: FAIL because the implementation files do not exist.

- [ ] **Step 3: Add priority queue and mapping implementation**

Create `apps/local-ai/src/data/api-football-national-team-plan.ts`:

```typescript
import type { SeasonQueueItem } from './api-football-snapshot-schema.js';

export const NATIONAL_TEAM_COMPETITION_ORDER = Object.freeze([
  'comp-int-world-cup',
  'comp-int-euro',
  'comp-int-copa-america',
  'comp-int-afcon',
  'comp-int-afc-asian-cup',
  'comp-int-concacaf-gold-cup',
  'comp-int-uefa-nations-league'
] as const);

const seasonsByCompetition = Object.freeze({
  'comp-int-world-cup': [2026, 2022, 2018, 2014, 2010, 2006, 2002],
  'comp-int-euro': [2024, 2020, 2016, 2012, 2008, 2004, 2000],
  'comp-int-copa-america': [2024, 2021, 2019, 2016, 2015, 2011, 2007],
  'comp-int-afcon': [2023, 2021, 2019, 2017, 2015, 2013, 2012, 2010],
  'comp-int-afc-asian-cup': [2023, 2019, 2015, 2011],
  'comp-int-concacaf-gold-cup': [2023, 2021, 2019, 2017, 2015, 2013, 2011, 2009],
  'comp-int-uefa-nations-league': [2024, 2022, 2020, 2018]
} satisfies Record<string, readonly number[]>);

export function plannedSeasonsForCompetition(internalCompetitionId: string): readonly number[] {
  return seasonsByCompetition[internalCompetitionId as keyof typeof seasonsByCompetition] ?? [];
}

export function buildNationalTeamSeasonQueue(): SeasonQueueItem[] {
  return NATIONAL_TEAM_COMPETITION_ORDER.flatMap((internalCompetitionId) =>
    plannedSeasonsForCompetition(internalCompetitionId).map((season) => ({ internalCompetitionId, season }))
  );
}
```

Create `apps/local-ai/src/data/api-football-provider-mapping.ts`:

```typescript
export type ApiFootballCompetitionMapping = {
  internalCompetitionId: string;
  providerId: 'api-football';
  providerCompetitionId: string;
  providerLeagueId: number | null;
  providerLeagueName: string;
  providerCountry: string;
  verificationStatus: 'verified' | 'unverified';
  verifiedAt: string | null;
  source: string;
};

function isMapping(value: unknown): value is ApiFootballCompetitionMapping {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.providerId === 'api-football' &&
    typeof record.internalCompetitionId === 'string' &&
    typeof record.providerCompetitionId === 'string' &&
    typeof record.providerLeagueName === 'string' &&
    typeof record.providerCountry === 'string' &&
    (record.verificationStatus === 'verified' || record.verificationStatus === 'unverified');
}

export function loadVerifiedApiFootballMappingsFromJsonl(content: string): ApiFootballCompetitionMapping[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as unknown)
    .filter(isMapping)
    .filter((mapping) => mapping.verificationStatus === 'verified' && typeof mapping.providerLeagueId === 'number');
}

export function resolveVerifiedMapping(
  mappings: readonly ApiFootballCompetitionMapping[],
  internalCompetitionId: string
): ApiFootballCompetitionMapping | null {
  return mappings.find((mapping) => mapping.internalCompetitionId === internalCompetitionId) ?? null;
}
```

- [ ] **Step 4: Run the priority and mapping tests to verify they pass**

Run:

```bash
pnpm exec vitest run apps/local-ai/src/data/api-football-national-team-plan.test.ts apps/local-ai/src/data/api-football-provider-mapping.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

Run:

```bash
git add apps/local-ai/src/data/api-football-national-team-plan.ts apps/local-ai/src/data/api-football-national-team-plan.test.ts apps/local-ai/src/data/api-football-provider-mapping.ts apps/local-ai/src/data/api-football-provider-mapping.test.ts
git commit -m "feat(local-ai): add api-football national-team snapshot plan"
```

---

### Task 3: Add JSONL Snapshot Store And Generated Artifact Ignore Rules

**Files:**
- Create: `apps/local-ai/src/data/api-football-jsonl-store.ts`
- Create: `apps/local-ai/src/data/api-football-jsonl-store.test.ts`
- Modify: `.gitignore`
- Create: `apps/local-ai/data/provider-snapshots/api-football/README.md`
- Create: `apps/local-ai/data/provider-snapshots/api-football/registry/competition_mappings.example.jsonl`

- [ ] **Step 1: Write the failing JSONL store tests**

Create `apps/local-ai/src/data/api-football-jsonl-store.test.ts`:

```typescript
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  appendDeadLetterRecord,
  appendFixtureIndexRecord,
  appendIngestionRunRecord,
  appendRequestBatchRecord,
  appendRawPayloadRecord,
  readJsonlRecords
} from './api-football-jsonl-store.js';

let tmpDir = '';

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'miraichi-api-football-jsonl-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('api-football JSONL snapshot store', () => {
  it('appends SQL-shaped JSONL rows and reads them back', async () => {
    await appendIngestionRunRecord(tmpDir, {
      runId: 'api_football_run_20260630T000000Z_abcd1234',
      providerId: 'api-football',
      startedAt: '2026-06-30T00:00:00.000Z',
      finishedAt: null,
      status: 'running',
      requestedCompetitionOrder: ['comp-int-world-cup'],
      requestedSeasonOrder: [{ internalCompetitionId: 'comp-int-world-cup', season: 2026 }],
      requestCount: 0,
      fixtureCount: 0,
      completedFixtureCount: 0,
      skippedCompetitionCount: 0,
      errorCount: 0,
      quotaLimit: 100,
      quotaRemainingAtEnd: 100
    });

    const rows = await readJsonlRecords(path.join(tmpDir, 'manifests', 'ingestion_runs.jsonl'));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ runId: 'api_football_run_20260630T000000Z_abcd1234' });
  });

  it('deduplicates raw payload rows by payload hash but keeps index evidence', async () => {
    const raw = {
      rawPayloadId: 'api_football_raw_hash1',
      runId: 'api_football_run_20260630T000000Z_abcd1234',
      requestBatchId: 'api_football_request_abcd1234_0001',
      providerId: 'api-football' as const,
      endpoint: 'fixtures' as const,
      requestParams: { league: 1, season: 2026, status: 'FT-AET-PEN' },
      fetchedAt: '2026-06-30T00:00:00.000Z',
      payloadHash: 'hash1',
      rawPayload: { response: [] }
    };

    await appendRawPayloadRecord(tmpDir, 'comp-int-world-cup', 2026, raw);
    await appendRawPayloadRecord(tmpDir, 'comp-int-world-cup', 2026, raw);

    const rows = await readJsonlRecords(path.join(
      tmpDir,
      'raw',
      'fixtures_by_league_season',
      'competition=comp-int-world-cup',
      'season=2026.jsonl'
    ));
    expect(rows).toHaveLength(1);
  });

  it('writes request, fixture index, and dead-letter records without secrets', async () => {
    await appendRequestBatchRecord(tmpDir, {
      requestBatchId: 'api_football_request_abcd1234_0001',
      runId: 'api_football_run_20260630T000000Z_abcd1234',
      providerId: 'api-football',
      endpoint: 'fixtures',
      requestUrlRedacted: 'https://v3.football.api-sports.io/fixtures?league=1',
      requestParams: { league: 1 },
      startedAt: '2026-06-30T00:00:00.000Z',
      finishedAt: '2026-06-30T00:00:01.000Z',
      httpStatus: 200,
      rateLimitRemaining: 99,
      responsePayloadHash: 'hash1',
      rawPayloadId: 'api_football_raw_hash1',
      recordCount: 1,
      status: 'success',
      errorCode: null
    });
    await appendFixtureIndexRecord(tmpDir, {
      internalFixtureId: 'comp-int-world-cup_2026_api_football_fixture_1',
      providerFixtureId: 'api_football_fixture_1',
      providerId: 'api-football',
      internalCompetitionId: 'comp-int-world-cup',
      providerCompetitionId: 'api_football_league_1',
      seasonId: 'comp-int-world-cup_season_2026',
      providerSeason: 2026,
      statusShort: 'FT',
      statusLong: 'Match Finished',
      fixtureDate: '2026-06-30T10:00:00Z',
      homeTeamProviderId: 'api_football_team_1',
      awayTeamProviderId: 'api_football_team_2',
      latestRawPayloadId: 'api_football_raw_hash1',
      latestPayloadHash: 'hash1',
      snapshotStability: 'completed_unverified',
      firstSeenAt: '2026-06-30T00:00:00.000Z',
      lastSeenAt: '2026-06-30T00:00:00.000Z'
    });
    await appendDeadLetterRecord(tmpDir, {
      runId: 'api_football_run_20260630T000000Z_abcd1234',
      requestBatchId: 'api_football_request_abcd1234_0001',
      rawPayloadId: 'api_football_raw_hash1',
      providerId: 'api-football',
      reason: 'Missing fixture id',
      createdAt: '2026-06-30T00:00:00.000Z'
    });

    const serialized = fs.readFileSync(path.join(tmpDir, 'manifests', 'request_batches.jsonl'), 'utf8');
    expect(serialized).not.toContain('secret');
    expect(fs.existsSync(path.join(tmpDir, 'indexes', 'fixtures_index.jsonl'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'raw', 'dead_letter', 'validation_errors.jsonl'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the JSONL store test to verify it fails**

Run:

```bash
pnpm exec vitest run apps/local-ai/src/data/api-football-jsonl-store.test.ts
```

Expected: FAIL because `apps/local-ai/src/data/api-football-jsonl-store.ts` does not exist.

- [ ] **Step 3: Add the JSONL store implementation**

Create `apps/local-ai/src/data/api-football-jsonl-store.ts` with appenders for:

```typescript
appendIngestionRunRecord(rootDir, record)
appendRequestBatchRecord(rootDir, record)
appendRawPayloadRecord(rootDir, internalCompetitionId, season, record)
appendFixtureIndexRecord(rootDir, record)
appendDeadLetterRecord(rootDir, record)
readJsonlRecords(filePath)
```

Implementation requirements:

```typescript
import fs from 'fs/promises';
import path from 'path';
import type {
  FixtureIndexRecord,
  IngestionRunRecord,
  RawPayloadRecord,
  RequestBatchRecord
} from './api-football-snapshot-schema.js';

export type DeadLetterRecord = {
  runId: string;
  requestBatchId: string;
  rawPayloadId: string | null;
  providerId: 'api-football';
  reason: string;
  createdAt: string;
};

async function ensureParent(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function appendJsonl(filePath: string, record: unknown): Promise<void> {
  await ensureParent(filePath);
  await fs.appendFile(filePath, `${JSON.stringify(record)}\n`, 'utf8');
}

export async function readJsonlRecords(filePath: string): Promise<unknown[]> {
  const content = await fs.readFile(filePath, 'utf8');
  return content.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as unknown);
}

async function hasPayloadHash(filePath: string, payloadHash: string): Promise<boolean> {
  try {
    const rows = await readJsonlRecords(filePath);
    return rows.some((row) => {
      return typeof row === 'object' &&
        row !== null &&
        !Array.isArray(row) &&
        (row as { payloadHash?: unknown }).payloadHash === payloadHash;
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

export async function appendIngestionRunRecord(rootDir: string, record: IngestionRunRecord): Promise<void> {
  await appendJsonl(path.join(rootDir, 'manifests', 'ingestion_runs.jsonl'), record);
}

export async function appendRequestBatchRecord(rootDir: string, record: RequestBatchRecord): Promise<void> {
  await appendJsonl(path.join(rootDir, 'manifests', 'request_batches.jsonl'), record);
}

export async function appendRawPayloadRecord(
  rootDir: string,
  internalCompetitionId: string,
  season: number,
  record: RawPayloadRecord
): Promise<void> {
  const filePath = path.join(
    rootDir,
    'raw',
    'fixtures_by_league_season',
    `competition=${internalCompetitionId}`,
    `season=${season}.jsonl`
  );
  if (await hasPayloadHash(filePath, record.payloadHash)) return;
  await appendJsonl(filePath, record);
}

export async function appendFixtureIndexRecord(rootDir: string, record: FixtureIndexRecord): Promise<void> {
  await appendJsonl(path.join(rootDir, 'indexes', 'fixtures_index.jsonl'), record);
}

export async function appendDeadLetterRecord(rootDir: string, record: DeadLetterRecord): Promise<void> {
  await appendJsonl(path.join(rootDir, 'raw', 'dead_letter', 'validation_errors.jsonl'), record);
}
```

- [ ] **Step 4: Add local artifact docs and ignore generated provider data**

Append these lines to `.gitignore`:

```gitignore
# Generated provider snapshots
apps/local-ai/data/provider-snapshots/api-football/manifests/*.jsonl
apps/local-ai/data/provider-snapshots/api-football/raw/**/*.jsonl
apps/local-ai/data/provider-snapshots/api-football/indexes/*.jsonl
apps/local-ai/data/provider-snapshots/api-football/reports/*.json
```

Create `apps/local-ai/data/provider-snapshots/api-football/README.md`:

```markdown
# API-Football Local Snapshot Store

This directory holds owner-local API-Football snapshot artifacts for Phase 8.6F.

Committed files in this directory are schema docs and non-secret examples only. Generated raw provider payloads, manifests, indexes, and reports are local artifacts by default and are ignored by git.

Allowed scope:

- national-team competitions only;
- World Cup 2026 completed fixtures first;
- terminal/completed fixtures only;
- full raw payload preservation.

Blocked scope:

- club competitions;
- all-league crawling;
- live polling;
- odds;
- predictions;
- betting recommendations;
- production database schema.
```

Create `apps/local-ai/data/provider-snapshots/api-football/registry/competition_mappings.example.jsonl` with one unverified example row:

```jsonl
{"internalCompetitionId":"comp-int-world-cup","providerId":"api-football","providerCompetitionId":"api_football_league_unknown","providerLeagueId":null,"providerLeagueName":"FIFA World Cup","providerCountry":"World","verificationStatus":"unverified","verifiedAt":null,"source":"owner_or_provider_discovery"}
```

- [ ] **Step 5: Run the JSONL store tests to verify they pass**

Run:

```bash
pnpm exec vitest run apps/local-ai/src/data/api-football-jsonl-store.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

Run:

```bash
git add .gitignore apps/local-ai/src/data/api-football-jsonl-store.ts apps/local-ai/src/data/api-football-jsonl-store.test.ts apps/local-ai/data/provider-snapshots/api-football/README.md apps/local-ai/data/provider-snapshots/api-football/registry/competition_mappings.example.jsonl
git commit -m "feat(local-ai): add api-football jsonl snapshot store"
```

---

### Task 4: Add Raw API-Football Snapshot Client

**Files:**
- Create: `apps/local-ai/src/data/api-football-snapshot-client.ts`
- Create: `apps/local-ai/src/data/api-football-snapshot-client.test.ts`

- [ ] **Step 1: Write the failing raw client tests**

Create `apps/local-ai/src/data/api-football-snapshot-client.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import {
  ApiFootballSnapshotClientError,
  createApiFootballSnapshotClient
} from './api-football-snapshot-client.js';

describe('api-football raw snapshot client', () => {
  it('requests completed-only fixtures by verified league and season and preserves raw payload', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      get: 'fixtures',
      parameters: { league: '1', season: '2026', status: 'FT-AET-PEN' },
      errors: [],
      results: 1,
      response: [
        {
          fixture: { id: 123, date: '2026-06-30T10:00:00+00:00', status: { short: 'FT', long: 'Match Finished' } },
          league: { id: 1, name: 'FIFA World Cup', season: 2026 },
          teams: { home: { id: 10, name: 'Japan' }, away: { id: 20, name: 'Vietnam' } },
          goals: { home: 2, away: 1 }
        }
      ]
    }), {
      status: 200,
      headers: { 'x-ratelimit-requests-remaining': '99' }
    }));

    const client = createApiFootballSnapshotClient({
      apiKey: 'owner-key',
      baseUrl: 'https://v3.football.api-sports.io',
      fetcher
    });

    const result = await client.fetchCompletedFixturesByLeagueSeason({ leagueId: 1, season: 2026 });

    expect(fetcher).toHaveBeenCalledWith(
      'https://v3.football.api-sports.io/fixtures?league=1&season=2026&status=FT-AET-PEN',
      expect.objectContaining({ headers: { 'x-apisports-key': 'owner-key' } })
    );
    expect(result.requestUrlRedacted).toBe('https://v3.football.api-sports.io/fixtures?league=1&season=2026&status=FT-AET-PEN');
    expect(result.rawPayload).toMatchObject({ results: 1 });
    expect(result.rateLimitRemaining).toBe(99);
    expect(result.rawPayloadText).not.toContain('owner-key');
  });

  it('throws typed errors for missing key and provider HTTP failures', async () => {
    expect(() => createApiFootballSnapshotClient({
      apiKey: '',
      baseUrl: 'https://v3.football.api-sports.io',
      fetcher: vi.fn()
    })).toThrow('API_FOOTBALL_KEY is required for API-Football snapshot runs.');

    const client = createApiFootballSnapshotClient({
      apiKey: 'owner-key',
      baseUrl: 'https://v3.football.api-sports.io',
      fetcher: async () => new Response('Bad gateway', { status: 502 })
    });

    await expect(client.fetchCompletedFixturesByLeagueSeason({ leagueId: 1, season: 2026 })).rejects.toBeInstanceOf(
      ApiFootballSnapshotClientError
    );
  });
});
```

- [ ] **Step 2: Run the raw client tests to verify they fail**

Run:

```bash
pnpm exec vitest run apps/local-ai/src/data/api-football-snapshot-client.test.ts
```

Expected: FAIL because `apps/local-ai/src/data/api-football-snapshot-client.ts` does not exist.

- [ ] **Step 3: Add the raw snapshot client**

Create `apps/local-ai/src/data/api-football-snapshot-client.ts`:

```typescript
type Fetcher = typeof fetch;

export class ApiFootballSnapshotClientError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.name = 'ApiFootballSnapshotClientError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export type RawSnapshotResponse = {
  requestUrlRedacted: string;
  requestParams: { league: number; season: number; status: 'FT-AET-PEN' };
  httpStatus: number;
  rateLimitRemaining: number | null;
  rawPayload: unknown;
  rawPayloadText: string;
  recordCount: number;
};

function readRateLimitRemaining(headers: Headers): number | null {
  const value = headers.get('x-ratelimit-requests-remaining') ?? headers.get('x-ratelimit-remaining');
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function countResponseRecords(rawPayload: unknown): number {
  if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) return 0;
  const response = (rawPayload as { response?: unknown }).response;
  return Array.isArray(response) ? response.length : 0;
}

export function createApiFootballSnapshotClient({
  apiKey,
  baseUrl,
  fetcher = fetch
}: {
  apiKey: string;
  baseUrl: string;
  fetcher?: Fetcher;
}) {
  const cleanApiKey = apiKey.trim();
  if (!cleanApiKey) {
    throw new ApiFootballSnapshotClientError(
      'api_football_key_missing',
      'API_FOOTBALL_KEY is required for API-Football snapshot runs.',
      503
    );
  }

  return {
    async fetchCompletedFixturesByLeagueSeason({
      leagueId,
      season
    }: {
      leagueId: number;
      season: number;
    }): Promise<RawSnapshotResponse> {
      const url = new URL('/fixtures', baseUrl);
      url.searchParams.set('league', String(leagueId));
      url.searchParams.set('season', String(season));
      url.searchParams.set('status', 'FT-AET-PEN');

      const response = await fetcher(url.toString(), {
        headers: { 'x-apisports-key': cleanApiKey }
      });

      const rawPayloadText = await response.text();
      if (!response.ok) {
        throw new ApiFootballSnapshotClientError(
          'api_football_provider_error',
          `API-Football returned HTTP ${response.status}.`,
          response.status
        );
      }

      const rawPayload = JSON.parse(rawPayloadText) as unknown;
      return {
        requestUrlRedacted: url.toString(),
        requestParams: { league: leagueId, season, status: 'FT-AET-PEN' },
        httpStatus: response.status,
        rateLimitRemaining: readRateLimitRemaining(response.headers),
        rawPayload,
        rawPayloadText,
        recordCount: countResponseRecords(rawPayload)
      };
    }
  };
}
```

- [ ] **Step 4: Run the raw client tests to verify they pass**

Run:

```bash
pnpm exec vitest run apps/local-ai/src/data/api-football-snapshot-client.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

Run:

```bash
git add apps/local-ai/src/data/api-football-snapshot-client.ts apps/local-ai/src/data/api-football-snapshot-client.test.ts
git commit -m "feat(local-ai): add api-football raw snapshot client"
```

---

### Task 5: Add Snapshot Runner Orchestration

**Files:**
- Create: `apps/local-ai/src/data/api-football-snapshot-runner.ts`
- Create: `apps/local-ai/src/data/api-football-snapshot-runner.test.ts`

- [ ] **Step 1: Write the failing runner tests**

Create `apps/local-ai/src/data/api-football-snapshot-runner.test.ts`:

```typescript
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readJsonlRecords } from './api-football-jsonl-store.js';
import { runApiFootballSnapshot } from './api-football-snapshot-runner.js';

let tmpDir = '';

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'miraichi-api-football-runner-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('api-football snapshot runner', () => {
  it('skips unverified mappings and records blockers without network calls', async () => {
    const result = await runApiFootballSnapshot({
      rootDir: tmpDir,
      apiKey: 'owner-key',
      baseUrl: 'https://v3.football.api-sports.io',
      mappings: [],
      maxRequests: 5,
      now: () => new Date('2026-06-30T00:00:00Z'),
      fetcher: async () => new Response('{}', { status: 200 })
    });

    expect(result.status).toBe('blocked');
    expect(result.requestCount).toBe(0);
    expect(result.skippedCompetitionCount).toBeGreaterThan(0);
  });

  it('fetches World Cup 2026 first, writes raw payload and fixture index, then stops at maxRequests', async () => {
    const result = await runApiFootballSnapshot({
      rootDir: tmpDir,
      apiKey: 'owner-key',
      baseUrl: 'https://v3.football.api-sports.io',
      mappings: [{
        internalCompetitionId: 'comp-int-world-cup',
        providerId: 'api-football',
        providerCompetitionId: 'api_football_league_1',
        providerLeagueId: 1,
        providerLeagueName: 'FIFA World Cup',
        providerCountry: 'World',
        verificationStatus: 'verified',
        verifiedAt: '2026-06-30T00:00:00.000Z',
        source: 'owner_verified'
      }],
      maxRequests: 1,
      now: () => new Date('2026-06-30T00:00:00Z'),
      fetcher: async () => new Response(JSON.stringify({
        response: [{
          fixture: {
            id: 123,
            date: '2026-06-30T10:00:00+00:00',
            status: { short: 'FT', long: 'Match Finished' }
          },
          league: { id: 1, name: 'FIFA World Cup', season: 2026 },
          teams: { home: { id: 10, name: 'Japan' }, away: { id: 20, name: 'Vietnam' } },
          goals: { home: 2, away: 1 }
        }]
      }), { status: 200, headers: { 'x-ratelimit-requests-remaining': '99' } })
    });

    expect(result.status).toBe('partial');
    expect(result.requestCount).toBe(1);
    expect(result.completedFixtureCount).toBe(1);

    const rawRows = await readJsonlRecords(path.join(
      tmpDir,
      'raw',
      'fixtures_by_league_season',
      'competition=comp-int-world-cup',
      'season=2026.jsonl'
    ));
    expect(rawRows).toHaveLength(1);

    const indexRows = await readJsonlRecords(path.join(tmpDir, 'indexes', 'fixtures_index.jsonl'));
    expect(indexRows[0]).toMatchObject({
      internalFixtureId: 'comp-int-world-cup_2026_api_football_fixture_123',
      snapshotStability: 'completed_unverified'
    });
  });

  it('dead-letters payloads with non-terminal fixture statuses instead of indexing them', async () => {
    const result = await runApiFootballSnapshot({
      rootDir: tmpDir,
      apiKey: 'owner-key',
      baseUrl: 'https://v3.football.api-sports.io',
      mappings: [{
        internalCompetitionId: 'comp-int-world-cup',
        providerId: 'api-football',
        providerCompetitionId: 'api_football_league_1',
        providerLeagueId: 1,
        providerLeagueName: 'FIFA World Cup',
        providerCountry: 'World',
        verificationStatus: 'verified',
        verifiedAt: '2026-06-30T00:00:00.000Z',
        source: 'owner_verified'
      }],
      maxRequests: 1,
      now: () => new Date('2026-06-30T00:00:00Z'),
      fetcher: async () => new Response(JSON.stringify({
        response: [{
          fixture: {
            id: 124,
            date: '2026-06-30T10:00:00+00:00',
            status: { short: 'LIVE', long: 'In Play' }
          },
          league: { id: 1, name: 'FIFA World Cup', season: 2026 },
          teams: { home: { id: 10, name: 'Japan' }, away: { id: 20, name: 'Vietnam' } },
          goals: { home: 0, away: 0 }
        }]
      }), { status: 200 })
    });

    expect(result.completedFixtureCount).toBe(0);
    const deadLetters = await readJsonlRecords(path.join(tmpDir, 'raw', 'dead_letter', 'validation_errors.jsonl'));
    expect(deadLetters[0]).toMatchObject({ reason: 'Fixture api_football_fixture_124 is not terminal/completed.' });
  });
});
```

- [ ] **Step 2: Run the runner tests to verify they fail**

Run:

```bash
pnpm exec vitest run apps/local-ai/src/data/api-football-snapshot-runner.test.ts
```

Expected: FAIL because `apps/local-ai/src/data/api-football-snapshot-runner.ts` does not exist.

- [ ] **Step 3: Add the snapshot runner**

Create `apps/local-ai/src/data/api-football-snapshot-runner.ts`:

```typescript
import { resolveVerifiedMapping, type ApiFootballCompetitionMapping } from './api-football-provider-mapping.js';
import { buildNationalTeamSeasonQueue } from './api-football-national-team-plan.js';
import {
  appendDeadLetterRecord,
  appendFixtureIndexRecord,
  appendIngestionRunRecord,
  appendRawPayloadRecord,
  appendRequestBatchRecord
} from './api-football-jsonl-store.js';
import { createApiFootballSnapshotClient } from './api-football-snapshot-client.js';
import {
  completedApiFootballStatus,
  createFixtureIndexRecord,
  createIngestionRunId,
  createRequestBatchId,
  hashPayload,
  rawPayloadId,
  type RawPayloadRecord,
  type SnapshotStatus
} from './api-football-snapshot-schema.js';

type Fetcher = typeof fetch;

export type SnapshotRunResult = {
  status: SnapshotStatus;
  runId: string;
  requestCount: number;
  completedFixtureCount: number;
  skippedCompetitionCount: number;
  errorCount: number;
};

type ApiFootballFixtureLike = {
  fixture?: {
    id?: number;
    date?: string;
    status?: { short?: string; long?: string };
  };
  league?: {
    id?: number;
    season?: number;
  };
  teams?: {
    home?: { id?: number };
    away?: { id?: number };
  };
};

function responseRows(rawPayload: unknown): unknown[] {
  if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) return [];
  const response = (rawPayload as { response?: unknown }).response;
  return Array.isArray(response) ? response : [];
}

function asFixture(value: unknown): ApiFootballFixtureLike | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as ApiFootballFixtureLike;
}

export async function runApiFootballSnapshot({
  rootDir,
  apiKey,
  baseUrl,
  mappings,
  maxRequests,
  now,
  fetcher
}: {
  rootDir: string;
  apiKey: string;
  baseUrl: string;
  mappings: readonly ApiFootballCompetitionMapping[];
  maxRequests: number;
  now: () => Date;
  fetcher?: Fetcher;
}): Promise<SnapshotRunResult> {
  const queue = buildNationalTeamSeasonQueue();
  const runId = createIngestionRunId(now(), 'phase86f');
  let requestCount = 0;
  let completedFixtureCount = 0;
  let skippedCompetitionCount = 0;
  let errorCount = 0;

  await appendIngestionRunRecord(rootDir, {
    runId,
    providerId: 'api-football',
    startedAt: now().toISOString(),
    finishedAt: null,
    status: 'running',
    requestedCompetitionOrder: [...new Set(queue.map((item) => item.internalCompetitionId))],
    requestedSeasonOrder: queue,
    requestCount: 0,
    fixtureCount: 0,
    completedFixtureCount: 0,
    skippedCompetitionCount: 0,
    errorCount: 0,
    quotaLimit: maxRequests,
    quotaRemainingAtEnd: maxRequests
  });

  const client = createApiFootballSnapshotClient({ apiKey, baseUrl, fetcher });

  for (const item of queue) {
    if (requestCount >= maxRequests) break;

    const mapping = resolveVerifiedMapping(mappings, item.internalCompetitionId);
    if (!mapping || typeof mapping.providerLeagueId !== 'number') {
      skippedCompetitionCount += 1;
      continue;
    }

    const requestBatchId = createRequestBatchId(runId, requestCount + 1);
    const startedAt = now().toISOString();

    try {
      const response = await client.fetchCompletedFixturesByLeagueSeason({
        leagueId: mapping.providerLeagueId,
        season: item.season
      });
      requestCount += 1;

      const payloadHash = hashPayload(response.rawPayload);
      const payloadId = rawPayloadId(payloadHash);
      const rawRecord: RawPayloadRecord = {
        rawPayloadId: payloadId,
        runId,
        requestBatchId,
        providerId: 'api-football',
        endpoint: 'fixtures',
        requestParams: response.requestParams,
        fetchedAt: now().toISOString(),
        payloadHash,
        rawPayload: response.rawPayload
      };

      await appendRawPayloadRecord(rootDir, item.internalCompetitionId, item.season, rawRecord);
      await appendRequestBatchRecord(rootDir, {
        requestBatchId,
        runId,
        providerId: 'api-football',
        endpoint: 'fixtures',
        requestUrlRedacted: response.requestUrlRedacted,
        requestParams: response.requestParams,
        startedAt,
        finishedAt: now().toISOString(),
        httpStatus: response.httpStatus,
        rateLimitRemaining: response.rateLimitRemaining,
        responsePayloadHash: payloadHash,
        rawPayloadId: payloadId,
        recordCount: response.recordCount,
        status: 'success',
        errorCode: null
      });

      for (const row of responseRows(response.rawPayload)) {
        const fixture = asFixture(row);
        const numericFixtureId = fixture?.fixture?.id;
        const statusShort = fixture?.fixture?.status?.short || 'unknown';
        if (typeof numericFixtureId !== 'number') {
          errorCount += 1;
          await appendDeadLetterRecord(rootDir, {
            runId,
            requestBatchId,
            rawPayloadId: payloadId,
            providerId: 'api-football',
            reason: 'Fixture is missing numeric provider id.',
            createdAt: now().toISOString()
          });
          continue;
        }
        if (!completedApiFootballStatus(statusShort)) {
          await appendDeadLetterRecord(rootDir, {
            runId,
            requestBatchId,
            rawPayloadId: payloadId,
            providerId: 'api-football',
            reason: `Fixture api_football_fixture_${numericFixtureId} is not terminal/completed.`,
            createdAt: now().toISOString()
          });
          continue;
        }
        if (
          typeof fixture?.fixture?.date !== 'string' ||
          typeof fixture.league?.id !== 'number' ||
          typeof fixture.league?.season !== 'number' ||
          typeof fixture.teams?.home?.id !== 'number' ||
          typeof fixture.teams?.away?.id !== 'number'
        ) {
          errorCount += 1;
          await appendDeadLetterRecord(rootDir, {
            runId,
            requestBatchId,
            rawPayloadId: payloadId,
            providerId: 'api-football',
            reason: `Fixture api_football_fixture_${numericFixtureId} is missing critical index fields.`,
            createdAt: now().toISOString()
          });
          continue;
        }

        completedFixtureCount += 1;
        await appendFixtureIndexRecord(rootDir, createFixtureIndexRecord({
          internalCompetitionId: item.internalCompetitionId,
          providerCompetitionId: mapping.providerCompetitionId,
          providerLeagueId: fixture.league.id,
          providerSeason: fixture.league.season,
          providerFixtureNumericId: numericFixtureId,
          statusShort,
          statusLong: fixture.fixture.status?.long || statusShort,
          fixtureDate: fixture.fixture.date,
          homeTeamProviderId: fixture.teams.home.id,
          awayTeamProviderId: fixture.teams.away.id,
          latestRawPayloadId: payloadId,
          latestPayloadHash: payloadHash,
          firstSeenAt: now().toISOString(),
          lastSeenAt: now().toISOString()
        }));
      }
    } catch (error) {
      requestCount += 1;
      errorCount += 1;
      await appendRequestBatchRecord(rootDir, {
        requestBatchId,
        runId,
        providerId: 'api-football',
        endpoint: 'fixtures',
        requestUrlRedacted: `https://v3.football.api-sports.io/fixtures?league=${mapping.providerLeagueId}&season=${item.season}&status=FT-AET-PEN`,
        requestParams: { league: mapping.providerLeagueId, season: item.season, status: 'FT-AET-PEN' },
        startedAt,
        finishedAt: now().toISOString(),
        httpStatus: typeof (error as { statusCode?: unknown }).statusCode === 'number'
          ? (error as { statusCode: number }).statusCode
          : null,
        rateLimitRemaining: null,
        responsePayloadHash: null,
        rawPayloadId: null,
        recordCount: 0,
        status: 'failed',
        errorCode: typeof (error as { code?: unknown }).code === 'string'
          ? (error as { code: string }).code
          : 'api_football_snapshot_error'
      });
    }
  }

  const status: SnapshotStatus = requestCount === 0
    ? 'blocked'
    : requestCount >= maxRequests
      ? 'partial'
      : errorCount > 0
        ? 'partial'
        : 'completed';

  await appendIngestionRunRecord(rootDir, {
    runId,
    providerId: 'api-football',
    startedAt: now().toISOString(),
    finishedAt: now().toISOString(),
    status,
    requestedCompetitionOrder: [...new Set(queue.map((item) => item.internalCompetitionId))],
    requestedSeasonOrder: queue,
    requestCount,
    fixtureCount: completedFixtureCount,
    completedFixtureCount,
    skippedCompetitionCount,
    errorCount,
    quotaLimit: maxRequests,
    quotaRemainingAtEnd: Math.max(0, maxRequests - requestCount)
  });

  return { status, runId, requestCount, completedFixtureCount, skippedCompetitionCount, errorCount };
}
```

- [ ] **Step 4: Run the runner tests to verify they pass**

Run:

```bash
pnpm exec vitest run apps/local-ai/src/data/api-football-snapshot-runner.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 5**

Run:

```bash
git add apps/local-ai/src/data/api-football-snapshot-runner.ts apps/local-ai/src/data/api-football-snapshot-runner.test.ts
git commit -m "feat(local-ai): orchestrate api-football snapshot runs"
```

---

### Task 6: Add CLI And Phase 8.6F Verifier

**Files:**
- Create: `scripts/phase8-api-football-snapshot.ts`
- Create: `scripts/phase8-api-football-snapshot-verify.ts`
- Create: `scripts/phase8-api-football-snapshot-verify.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing verifier tests**

Create `scripts/phase8-api-football-snapshot-verify.test.ts`:

```typescript
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { verifyApiFootballSnapshotBoundary } from './phase8-api-football-snapshot-verify.js';

let tmpDir = '';

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'miraichi-phase8-6f-verify-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('phase 8.6f api-football snapshot verifier', () => {
  it('fails when generated raw payload evidence is missing', async () => {
    const result = await verifyApiFootballSnapshotBoundary(tmpDir);
    expect(result.ok).toBe(false);
    expect(result.messages).toContain('Missing API-Football snapshot README.');
  });

  it('passes with docs, ignored generated directories, and source files present', async () => {
    fs.mkdirSync(path.join(tmpDir, 'apps/local-ai/data/provider-snapshots/api-football/registry'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'apps/local-ai/data/provider-snapshots/api-football/README.md'), 'snapshot docs', 'utf8');
    fs.writeFileSync(
      path.join(tmpDir, 'apps/local-ai/data/provider-snapshots/api-football/registry/competition_mappings.example.jsonl'),
      '{"verificationStatus":"unverified"}\n',
      'utf8'
    );
    fs.mkdirSync(path.join(tmpDir, 'apps/local-ai/src/data'), { recursive: true });
    for (const file of [
      'api-football-snapshot-schema.ts',
      'api-football-national-team-plan.ts',
      'api-football-provider-mapping.ts',
      'api-football-jsonl-store.ts',
      'api-football-snapshot-client.ts',
      'api-football-snapshot-runner.ts'
    ]) {
      fs.writeFileSync(path.join(tmpDir, 'apps/local-ai/src/data', file), 'export {};\n', 'utf8');
    }
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), 'apps/local-ai/data/provider-snapshots/api-football/raw/**/*.jsonl\n', 'utf8');

    const result = await verifyApiFootballSnapshotBoundary(tmpDir);
    expect(result.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run the verifier test to verify it fails**

Run:

```bash
pnpm exec vitest run scripts/phase8-api-football-snapshot-verify.test.ts
```

Expected: FAIL because `scripts/phase8-api-football-snapshot-verify.ts` does not exist.

- [ ] **Step 3: Add the verifier script**

Create `scripts/phase8-api-football-snapshot-verify.ts`:

```typescript
import fs from 'fs';
import path from 'path';

export type VerifyResult = { ok: boolean; messages: string[] };

function exists(rootDir: string, relativePath: string): boolean {
  return fs.existsSync(path.join(rootDir, relativePath));
}

export async function verifyApiFootballSnapshotBoundary(rootDir = process.cwd()): Promise<VerifyResult> {
  const messages: string[] = [];
  const requiredFiles = [
    'apps/local-ai/data/provider-snapshots/api-football/README.md',
    'apps/local-ai/data/provider-snapshots/api-football/registry/competition_mappings.example.jsonl',
    'apps/local-ai/src/data/api-football-snapshot-schema.ts',
    'apps/local-ai/src/data/api-football-national-team-plan.ts',
    'apps/local-ai/src/data/api-football-provider-mapping.ts',
    'apps/local-ai/src/data/api-football-jsonl-store.ts',
    'apps/local-ai/src/data/api-football-snapshot-client.ts',
    'apps/local-ai/src/data/api-football-snapshot-runner.ts'
  ];

  for (const file of requiredFiles) {
    if (!exists(rootDir, file)) {
      messages.push(file.endsWith('README.md') ? 'Missing API-Football snapshot README.' : `Missing ${file}.`);
    }
  }

  const gitignorePath = path.join(rootDir, '.gitignore');
  const gitignore = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
  if (!gitignore.includes('apps/local-ai/data/provider-snapshots/api-football/raw/**/*.jsonl')) {
    messages.push('Generated API-Football raw JSONL payloads are not ignored.');
  }

  return { ok: messages.length === 0, messages };
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  const result = await verifyApiFootballSnapshotBoundary();
  if (!result.ok) {
    for (const message of result.messages) {
      console.error(`[Phase 8.6F Verify] ${message}`);
    }
    process.exit(1);
  }
  console.log('[Phase 8.6F Verify] PASSED.');
}
```

- [ ] **Step 4: Add the owner-run CLI entrypoint**

Create `scripts/phase8-api-football-snapshot.ts`:

```typescript
import fs from 'fs';
import path from 'path';
import { loadVerifiedApiFootballMappingsFromJsonl } from '../apps/local-ai/src/data/api-football-provider-mapping.js';
import { runApiFootballSnapshot } from '../apps/local-ai/src/data/api-football-snapshot-runner.js';

function argValue(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const rootDir = process.cwd();
const outputDir = argValue('--output-dir', path.join(rootDir, 'apps/local-ai/data/provider-snapshots/api-football'));
const mappingPath = argValue(
  '--mapping',
  path.join(outputDir, 'registry', 'competition_mappings.jsonl')
);
const maxRequests = Number(argValue('--max-requests', '10'));
const apiKey = process.env.API_FOOTBALL_KEY || '';
const baseUrl = process.env.API_FOOTBALL_BASE_URL || 'https://v3.football.api-sports.io';

if (!fs.existsSync(mappingPath)) {
  console.error(`[Phase 8.6F Snapshot] Missing mapping file: ${mappingPath}`);
  process.exit(1);
}

const mappings = loadVerifiedApiFootballMappingsFromJsonl(fs.readFileSync(mappingPath, 'utf8'));
const result = await runApiFootballSnapshot({
  rootDir: outputDir,
  apiKey,
  baseUrl,
  mappings,
  maxRequests,
  now: () => new Date()
});

console.log(JSON.stringify(result, null, 2));
```

- [ ] **Step 5: Add pnpm scripts**

Modify `package.json` scripts:

```json
"phase8:api-football-snapshot": "tsx scripts/phase8-api-football-snapshot.ts",
"phase8:api-football-snapshot-verify": "tsx scripts/phase8-api-football-snapshot-verify.ts"
```

Place them near the existing `phase8:*` scripts.

- [ ] **Step 6: Run CLI/verifier tests to verify they pass**

Run:

```bash
pnpm exec vitest run scripts/phase8-api-football-snapshot-verify.test.ts
pnpm run phase8:api-football-snapshot-verify
```

Expected:

```text
PASS scripts/phase8-api-football-snapshot-verify.test.ts
[Phase 8.6F Verify] PASSED.
```

- [ ] **Step 7: Commit Task 6**

Run:

```bash
git add package.json scripts/phase8-api-football-snapshot.ts scripts/phase8-api-football-snapshot-verify.ts scripts/phase8-api-football-snapshot-verify.test.ts
git commit -m "feat(scripts): add api-football snapshot verifier"
```

---

### Task 7: Focused Verification And Project Plan Evidence

**Files:**
- Modify: `PROJECT_PLAN.md`

- [ ] **Step 1: Run focused unit tests**

Run:

```bash
pnpm exec vitest run apps/local-ai/src/data scripts/phase8-api-football-snapshot-verify.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run typecheck, lifecycle, and Phase 8.6F verifier**

Run:

```bash
pnpm run typecheck
pnpm run verify:lifecycle
pnpm run phase8:api-football-snapshot-verify
git diff --check
```

Expected:

```text
No TypeScript errors.
[Lifecycle Verify] PASSED.
[Phase 8.6F Verify] PASSED.
```

`git diff --check` prints no output.

- [ ] **Step 3: Optional owner local provider smoke**

Run only after the owner creates a local, uncommitted verified mapping file and sets `API_FOOTBALL_KEY` locally:

```powershell
$env:API_FOOTBALL_KEY="owner-local-key"
pnpm run phase8:api-football-snapshot -- --max-requests 1
```

Expected:

```text
JSON summary reports requestCount 1 or a clear provider/mapping blocker.
No API key appears in generated JSONL artifacts.
World Cup 2026 is attempted before older seasons when mapping is verified.
```

- [ ] **Step 4: Update `PROJECT_PLAN.md` with implementation evidence**

Add after the Phase 8.6F implementation-plan entry:

```markdown
- [x] Complete Phase 8.6F API-Football National-Team JSONL Snapshot Store.
  - **Result**: Added a TypeScript local snapshot boundary for API-Football national-team raw payloads with SQL-shaped JSONL schemas, provider mapping gates, quota-safe run orchestration, dead-letter evidence, generated artifact ignore rules, and a Phase 8.6F verifier.
  - **Evidence**: Focused local-ai data tests, verifier tests, `pnpm run typecheck`, `pnpm run verify:lifecycle`, `pnpm run phase8:api-football-snapshot-verify`, and `git diff --check` passed.
  - **Manual Smoke**: Actual provider snapshot runs require local `API_FOOTBALL_KEY` and verified API-Football league ids in an uncommitted mapping file.
  - **Constraint**: No odds, live polling, prediction runtime, betting recommendation, club competitions, all-league crawl, production database schema, or committed provider key.
```

If implementation is blocked by missing owner key or verified provider league ids, add this instead:

```markdown
- [ ] Complete Phase 8.6F API-Football National-Team JSONL Snapshot Store.
  - **Blocker**: Actual provider snapshot smoke requires local `API_FOOTBALL_KEY` and verified API-Football national-team league ids.
  - **Implemented Boundary**: Source modules and offline verifier may still be complete without live provider smoke.
  - **Constraint**: Do not guess API-Football league ids or commit provider keys.
```

- [ ] **Step 5: Run final local verification**

Run:

```bash
pnpm run verify:local
```

Expected: PASS.

- [ ] **Step 6: Commit Task 7**

Run:

```bash
git add PROJECT_PLAN.md
git commit -m "docs: record phase 8.6f snapshot evidence"
```

---

## Final Review Checklist

- [ ] National-team priority order matches the owner-approved order.
- [ ] World Cup 2026 is first and completed-only.
- [ ] Club competitions and all-league crawl are absent.
- [ ] API-Football league ids are read from mapping artifacts, not hard-coded in source.
- [ ] Unverified mappings are skipped with blocker evidence.
- [ ] Raw payloads are written before validation and normalization.
- [ ] Generated raw JSONL artifacts are ignored by git.
- [ ] API key and auth headers do not appear in generated artifacts.
- [ ] Fixture identity uses provider fixture id, not names/dates/scores.
- [ ] Non-terminal fixtures are not indexed as completed snapshots.
- [ ] Dead-letter records preserve validation evidence.
- [ ] No odds, prediction runtime, or betting recommendation behavior is added.
- [ ] Focused tests pass.
- [ ] `pnpm run typecheck` passes.
- [ ] `pnpm run verify:lifecycle` passes.
- [ ] `pnpm run phase8:api-football-snapshot-verify` passes.
- [ ] `git diff --check` passes.
- [ ] `pnpm run verify:local` passes before phase closeout.

## Recommended Next Lifecycle Command

After this implementation plan is owner-approved, run:

```text
phase:code-slice Phase 8.6F Snapshot Schema And ID Utilities
```

Do not start provider snapshot execution, club expansion, all-league crawling, live polling, odds integration, model training, or production database work before the first TDD code slice is complete.
