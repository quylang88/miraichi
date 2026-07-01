# Phase 8.6E API-Football Owner-Only App Live Data Implementation Plan

> **Status:** Historical/superseded on 2026-07-01 by [ADR-0042](file:///c:/CODE/miraichi/docs/decisions/ADR-0042-local-data-api-and-api-football-removal.md). This plan explains completed legacy work, but Phase 9 must remove API-Football from the active app data path.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the app's visible hardcoded match feed with an owner-only API-Football-backed matchday feed served through the Miraichi API gateway.

**Architecture:** Add a backend-only API-Football provider client with normalization, validation, cache, and quota guard. Route `/api/v1/matches` through that service and update the web shell to fetch, display, and honestly report provider feed states without exposing provider keys or adding odds/prediction behavior.

**Tech Stack:** TypeScript, Node.js HTTP server, global `fetch`, Vitest, existing vanilla TypeScript web shell, no new runtime dependencies.

---

## Scope Boundary

### Allowed

- API-Football fixture/date feed through the backend only.
- Owner-only free-tier assumptions with env-based key loading.
- In-memory cache and quota guard for a single local API process.
- Web shell loading, ready, empty, and unavailable states.
- `.env.example` variable names with blank values.
- Tests using injected fake fetchers and fake clocks.

### Blocked

- Browser-side API-Football calls.
- Committed API key, secret, token, or paid provider config.
- The Odds API.
- Live odds, historical odds, bookmaker baseline, or implied probabilities.
- Prediction output, recommendation, stake advice, bankroll advice, ROI, CLV, Kelly, or model runtime route.
- Raw CSV append-only merge; that needs a separate offline ingestion plan.
- Persistent database/cache, ORM, migrations, queues, cron poller, or public multi-user traffic.

## Gate Inputs

- Spec: `docs/superpowers/specs/2026-06-29-phase-8-6e-api-football-owner-only-app-live-data-design.md`
- ADR: `docs/decisions/ADR-0035-real-data-provider-selection-and-integration-strategy.md`
- ADR: `docs/decisions/ADR-0039-provider-adapter-contract-and-data-validation-schema.md`
- Current API route: `apps/api/src/index.ts`
- Current web shell: `apps/web/src/components/app-shell.ts`
- Current shell entry: `apps/web/src/shell-entry.ts`

## File Map

- Create: `apps/api/src/providers/api-football-client.ts` - API-Football fixture types, config, validation, status mapping, and normalized match conversion.
- Create: `apps/api/src/providers/api-football-client.test.ts` - unit tests for config, normalization, missing key, HTTP error, and invalid payload behavior.
- Create: `apps/api/src/services/matchday-cache.ts` - in-memory TTL cache and daily quota guard with injectable clock.
- Create: `apps/api/src/services/matchday-cache.test.ts` - deterministic cache/quota tests.
- Create: `apps/api/src/routes/matches.ts` - `/api/v1/matches` handler with dependency injection, query parsing, error responses, and cache metadata.
- Create: `apps/api/src/routes/matches.test.ts` - route tests for success, missing key, quota exhausted, provider error, and empty feed.
- Modify: `apps/api/src/index.ts` - route `/api/v1/matches` through `handleMatches`.
- Modify: `.env.example` - document `API_FOOTBALL_KEY=` and `API_FOOTBALL_DAILY_LIMIT=100`.
- Create: `apps/web/src/services/match-feed-service.ts` - browser fetch wrapper for `/api/v1/matches`.
- Create: `apps/web/src/services/match-feed-service.test.ts` - client fetch state tests.
- Modify: `apps/web/src/components/app-shell.ts` - accept match feed view state and render provider-backed Today/Matches data.
- Modify: `apps/web/src/production-shell.test.ts` - update rendering tests to cover loading, ready, empty, unavailable, and no hardcoded live feed labels.
- Modify: `apps/web/src/shell-entry.ts` - render loading, fetch match feed, rerender state, preserve navigation interactions.
- Modify after implementation evidence: `PROJECT_PLAN.md` - record Phase 8.6E completion or blocker.

---

### Task 1: Add API-Football Provider Normalization

**Files:**
- Create: `apps/api/src/providers/api-football-client.ts`
- Create: `apps/api/src/providers/api-football-client.test.ts`

- [ ] **Step 1: Write the failing provider tests**

Create `apps/api/src/providers/api-football-client.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import {
  ApiFootballProviderError,
  createApiFootballClient,
  normalizeApiFootballFixture,
  readApiFootballConfig,
  type ApiFootballFixture
} from './api-football-client.js';

const fixture: ApiFootballFixture = {
  fixture: {
    id: 120001,
    date: '2026-06-29T10:00:00+00:00',
    timestamp: 1782727200,
    venue: { id: 900, name: 'Tokyo Stadium', city: 'Tokyo' },
    status: { long: 'Not Started', short: 'NS', elapsed: null }
  },
  league: {
    id: 1,
    name: 'FIFA World Cup',
    country: 'World',
    season: 2026,
    round: 'Group Stage - 1'
  },
  teams: {
    home: { id: 100, name: 'Japan' },
    away: { id: 200, name: 'Vietnam' }
  },
  goals: { home: null, away: null },
  score: {
    halftime: { home: null, away: null },
    fulltime: { home: null, away: null }
  }
};

describe('API-Football config', () => {
  it('requires the provider key to be supplied by environment only', () => {
    expect(() => readApiFootballConfig({})).toThrow('API_FOOTBALL_KEY is required for API-Football match feed.');

    expect(readApiFootballConfig({
      API_FOOTBALL_KEY: 'owner-key',
      API_FOOTBALL_DAILY_LIMIT: '50'
    })).toEqual({
      apiKey: 'owner-key',
      baseUrl: 'https://v3.football.api-sports.io',
      dailyLimit: 50
    });
  });
});

describe('API-Football normalization', () => {
  it('normalizes a scheduled fixture into a competition-agnostic app match', () => {
    expect(normalizeApiFootballFixture(fixture)).toEqual({
      id: 'api-football-fixture-120001',
      sourceProviderId: 'api-football',
      providerFixtureId: '120001',
      competitionId: 'api-football-league-1',
      competitionName: 'FIFA World Cup',
      seasonId: 'api-football-season-2026',
      round: 'Group Stage - 1',
      status: 'scheduled',
      statusLabel: 'Not Started',
      kickoffTime: '2026-06-29T10:00:00.000Z',
      homeTeam: {
        id: 'api-football-team-100',
        name: 'Japan'
      },
      awayTeam: {
        id: 'api-football-team-200',
        name: 'Vietnam'
      },
      score: null,
      venueName: 'Tokyo Stadium',
      elapsedMinute: null
    });
  });

  it('normalizes live and completed statuses without adding prediction fields', () => {
    const live = normalizeApiFootballFixture({
      ...fixture,
      fixture: { ...fixture.fixture, status: { long: 'Second Half', short: '2H', elapsed: 61 } },
      goals: { home: 1, away: 0 }
    });
    const complete = normalizeApiFootballFixture({
      ...fixture,
      fixture: { ...fixture.fixture, status: { long: 'Match Finished', short: 'FT', elapsed: 90 } },
      goals: { home: 2, away: 2 }
    });

    expect(live.status).toBe('in_play');
    expect(live.score).toEqual({ home: 1, away: 0 });
    expect(live).not.toHaveProperty('predictionOutcome');
    expect(complete.status).toBe('completed');
    expect(complete.score).toEqual({ home: 2, away: 2 });
  });
});

describe('API-Football HTTP client', () => {
  it('fetches date fixtures with the provider header and parses response payloads', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      get: 'fixtures',
      parameters: { date: '2026-06-29', timezone: 'UTC' },
      errors: [],
      results: 1,
      paging: { current: 1, total: 1 },
      response: [fixture]
    }), { status: 200 }));

    const client = createApiFootballClient({
      config: { apiKey: 'owner-key', baseUrl: 'https://v3.football.api-sports.io', dailyLimit: 100 },
      fetcher
    });

    const result = await client.fetchFixturesByDate('2026-06-29');

    expect(fetcher).toHaveBeenCalledWith(
      'https://v3.football.api-sports.io/fixtures?date=2026-06-29&timezone=UTC',
      expect.objectContaining({
        headers: { 'x-apisports-key': 'owner-key' }
      })
    );
    expect(result.matches).toHaveLength(1);
    expect(result.warnings).toEqual([]);
  });

  it('throws typed errors for provider HTTP failures and invalid payloads', async () => {
    const failingClient = createApiFootballClient({
      config: { apiKey: 'owner-key', baseUrl: 'https://v3.football.api-sports.io', dailyLimit: 100 },
      fetcher: async () => new Response('Bad gateway', { status: 502 })
    });
    await expect(failingClient.fetchFixturesByDate('2026-06-29')).rejects.toMatchObject({
      code: 'api_football_provider_error',
      statusCode: 502
    });

    const invalidClient = createApiFootballClient({
      config: { apiKey: 'owner-key', baseUrl: 'https://v3.football.api-sports.io', dailyLimit: 100 },
      fetcher: async () => new Response(JSON.stringify({ response: [{}] }), { status: 200 })
    });
    await expect(invalidClient.fetchFixturesByDate('2026-06-29')).rejects.toBeInstanceOf(ApiFootballProviderError);
    await expect(invalidClient.fetchFixturesByDate('2026-06-29')).rejects.toMatchObject({
      code: 'api_football_invalid_payload'
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm exec vitest run apps/api/src/providers/api-football-client.test.ts
```

Expected: FAIL because `apps/api/src/providers/api-football-client.ts` does not exist.

- [ ] **Step 3: Add the minimal provider implementation**

Create `apps/api/src/providers/api-football-client.ts`:

```typescript
export type AppMatchStatus = 'scheduled' | 'in_play' | 'completed' | 'postponed' | 'cancelled' | 'unknown';

export type AppMatch = {
  id: string;
  sourceProviderId: 'api-football';
  providerFixtureId: string;
  competitionId: string;
  competitionName: string;
  seasonId: string;
  round: string | null;
  status: AppMatchStatus;
  statusLabel: string;
  kickoffTime: string;
  homeTeam: { id: string; name: string };
  awayTeam: { id: string; name: string };
  score: { home: number; away: number } | null;
  venueName: string | null;
  elapsedMinute: number | null;
};

export type ApiFootballConfig = {
  apiKey: string;
  baseUrl: string;
  dailyLimit: number;
};

export type ApiFootballFixture = {
  fixture: {
    id: number;
    date: string;
    timestamp?: number;
    venue?: { id?: number | null; name?: string | null; city?: string | null };
    status: { long?: string | null; short?: string | null; elapsed?: number | null };
  };
  league: {
    id: number;
    name: string;
    country?: string | null;
    season: number;
    round?: string | null;
  };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
  goals?: { home?: number | null; away?: number | null };
  score?: unknown;
};

type ApiFootballEnvelope = {
  response?: unknown;
  errors?: unknown;
};

type Fetcher = typeof fetch;

export class ApiFootballProviderError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.name = 'ApiFootballProviderError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function readApiFootballConfig(env: NodeJS.ProcessEnv): ApiFootballConfig {
  const apiKey = env.API_FOOTBALL_KEY?.trim();
  if (!apiKey) {
    throw new ApiFootballProviderError(
      'api_football_key_missing',
      'API_FOOTBALL_KEY is required for API-Football match feed.',
      503
    );
  }

  return {
    apiKey,
    baseUrl: env.API_FOOTBALL_BASE_URL?.trim() || 'https://v3.football.api-sports.io',
    dailyLimit: readPositiveInteger(env.API_FOOTBALL_DAILY_LIMIT, 100)
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new ApiFootballProviderError('api_football_invalid_payload', `Invalid API-Football ${label}.`, 502);
  }
  return value;
}

function readString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ApiFootballProviderError('api_football_invalid_payload', `Missing API-Football ${label}.`, 502);
  }
  return value;
}

function readNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ApiFootballProviderError('api_football_invalid_payload', `Missing API-Football ${label}.`, 502);
  }
  return value;
}

function parseFixture(value: unknown): ApiFootballFixture {
  const root = readRecord(value, 'fixture root');
  const fixture = readRecord(root.fixture, 'fixture object');
  const league = readRecord(root.league, 'league object');
  const teams = readRecord(root.teams, 'teams object');
  const home = readRecord(teams.home, 'home team');
  const away = readRecord(teams.away, 'away team');
  const status = readRecord(fixture.status, 'fixture status');

  return {
    fixture: {
      id: readNumber(fixture.id, 'fixture id'),
      date: readString(fixture.date, 'fixture date'),
      timestamp: typeof fixture.timestamp === 'number' ? fixture.timestamp : undefined,
      venue: isRecord(fixture.venue) ? {
        id: typeof fixture.venue.id === 'number' ? fixture.venue.id : null,
        name: typeof fixture.venue.name === 'string' ? fixture.venue.name : null,
        city: typeof fixture.venue.city === 'string' ? fixture.venue.city : null
      } : undefined,
      status: {
        long: typeof status.long === 'string' ? status.long : null,
        short: typeof status.short === 'string' ? status.short : null,
        elapsed: typeof status.elapsed === 'number' ? status.elapsed : null
      }
    },
    league: {
      id: readNumber(league.id, 'league id'),
      name: readString(league.name, 'league name'),
      country: typeof league.country === 'string' ? league.country : null,
      season: readNumber(league.season, 'league season'),
      round: typeof league.round === 'string' ? league.round : null
    },
    teams: {
      home: {
        id: readNumber(home.id, 'home team id'),
        name: readString(home.name, 'home team name')
      },
      away: {
        id: readNumber(away.id, 'away team id'),
        name: readString(away.name, 'away team name')
      }
    },
    goals: isRecord(root.goals) ? {
      home: typeof root.goals.home === 'number' ? root.goals.home : null,
      away: typeof root.goals.away === 'number' ? root.goals.away : null
    } : undefined,
    score: root.score
  };
}

function mapStatus(shortStatus: string | null | undefined): AppMatchStatus {
  if (!shortStatus) return 'unknown';
  if (['NS', 'TBD'].includes(shortStatus)) return 'scheduled';
  if (['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE'].includes(shortStatus)) return 'in_play';
  if (['FT', 'AET', 'PEN'].includes(shortStatus)) return 'completed';
  if (['PST', 'SUSP', 'INT'].includes(shortStatus)) return 'postponed';
  if (['CANC', 'ABD', 'AWD', 'WO'].includes(shortStatus)) return 'cancelled';
  return 'unknown';
}

export function normalizeApiFootballFixture(fixture: ApiFootballFixture): AppMatch {
  const goals = fixture.goals;
  const hasScore = typeof goals?.home === 'number' && typeof goals.away === 'number';

  return {
    id: `api-football-fixture-${fixture.fixture.id}`,
    sourceProviderId: 'api-football',
    providerFixtureId: String(fixture.fixture.id),
    competitionId: `api-football-league-${fixture.league.id}`,
    competitionName: fixture.league.name,
    seasonId: `api-football-season-${fixture.league.season}`,
    round: fixture.league.round || null,
    status: mapStatus(fixture.fixture.status.short),
    statusLabel: fixture.fixture.status.long || fixture.fixture.status.short || 'Unknown',
    kickoffTime: new Date(fixture.fixture.date).toISOString(),
    homeTeam: {
      id: `api-football-team-${fixture.teams.home.id}`,
      name: fixture.teams.home.name
    },
    awayTeam: {
      id: `api-football-team-${fixture.teams.away.id}`,
      name: fixture.teams.away.name
    },
    score: hasScore ? { home: goals.home as number, away: goals.away as number } : null,
    venueName: fixture.fixture.venue?.name || null,
    elapsedMinute: fixture.fixture.status.elapsed ?? null
  };
}

function parseEnvelope(value: unknown): ApiFootballFixture[] {
  const envelope = readRecord(value, 'response envelope') as ApiFootballEnvelope;
  if (!Array.isArray(envelope.response)) {
    throw new ApiFootballProviderError('api_football_invalid_payload', 'API-Football response must be an array.', 502);
  }
  return envelope.response.map(parseFixture);
}

export function createApiFootballClient({
  config,
  fetcher = fetch
}: {
  config: ApiFootballConfig;
  fetcher?: Fetcher;
}) {
  return {
    async fetchFixturesByDate(date: string): Promise<{ matches: AppMatch[]; warnings: string[] }> {
      const url = new URL('/fixtures', config.baseUrl);
      url.searchParams.set('date', date);
      url.searchParams.set('timezone', 'UTC');

      const response = await fetcher(url.toString(), {
        headers: { 'x-apisports-key': config.apiKey }
      });

      if (!response.ok) {
        throw new ApiFootballProviderError(
          'api_football_provider_error',
          `API-Football returned HTTP ${response.status}.`,
          502
        );
      }

      const payload = await response.json() as unknown;
      const fixtures = parseEnvelope(payload);

      return {
        matches: fixtures.map(normalizeApiFootballFixture),
        warnings: []
      };
    }
  };
}
```

- [ ] **Step 4: Run the provider tests to verify they pass**

Run:

```bash
pnpm exec vitest run apps/api/src/providers/api-football-client.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

Run:

```bash
git add apps/api/src/providers/api-football-client.ts apps/api/src/providers/api-football-client.test.ts
git commit -m "feat: add api-football fixture provider client"
```

---

### Task 2: Add Cache And Quota Guard

**Files:**
- Create: `apps/api/src/services/matchday-cache.ts`
- Create: `apps/api/src/services/matchday-cache.test.ts`

- [ ] **Step 1: Write the failing cache/quota tests**

Create `apps/api/src/services/matchday-cache.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { createDailyQuotaGuard, createMatchdayCache } from './matchday-cache.js';

describe('matchday cache', () => {
  it('returns hits until the TTL expires', () => {
    let nowMs = Date.parse('2026-06-29T00:00:00Z');
    const cache = createMatchdayCache<{ value: string }>({
      ttlSeconds: 60,
      now: () => new Date(nowMs)
    });

    expect(cache.get('date:2026-06-29')).toBeNull();
    cache.set('date:2026-06-29', { value: 'cached' });
    expect(cache.get('date:2026-06-29')).toEqual({ value: 'cached' });

    nowMs += 61_000;
    expect(cache.get('date:2026-06-29')).toBeNull();
  });
});

describe('daily quota guard', () => {
  it('allows calls until the daily limit and resets on UTC date boundary', () => {
    let nowMs = Date.parse('2026-06-29T23:59:00Z');
    const quota = createDailyQuotaGuard({
      dailyLimit: 2,
      now: () => new Date(nowMs)
    });

    expect(quota.snapshot()).toEqual({ dailyLimit: 2, consumedToday: 0, remainingToday: 2 });
    expect(quota.tryConsume()).toEqual({ allowed: true, snapshot: { dailyLimit: 2, consumedToday: 1, remainingToday: 1 } });
    expect(quota.tryConsume()).toEqual({ allowed: true, snapshot: { dailyLimit: 2, consumedToday: 2, remainingToday: 0 } });
    expect(quota.tryConsume()).toEqual({ allowed: false, snapshot: { dailyLimit: 2, consumedToday: 2, remainingToday: 0 } });

    nowMs = Date.parse('2026-06-30T00:01:00Z');
    expect(quota.tryConsume()).toEqual({ allowed: true, snapshot: { dailyLimit: 2, consumedToday: 1, remainingToday: 1 } });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm exec vitest run apps/api/src/services/matchday-cache.test.ts
```

Expected: FAIL because `apps/api/src/services/matchday-cache.ts` does not exist.

- [ ] **Step 3: Add the cache/quota implementation**

Create `apps/api/src/services/matchday-cache.ts`:

```typescript
export type CacheStatus = 'hit' | 'miss' | 'disabled';

export type DailyQuotaSnapshot = {
  dailyLimit: number;
  consumedToday: number;
  remainingToday: number;
};

type Clock = () => Date;

function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function createMatchdayCache<T>({
  ttlSeconds,
  now = () => new Date()
}: {
  ttlSeconds: number;
  now?: Clock;
}) {
  const entries = new Map<string, { expiresAtMs: number; value: T }>();

  return {
    get(key: string): T | null {
      const entry = entries.get(key);
      if (!entry) return null;
      if (entry.expiresAtMs <= now().getTime()) {
        entries.delete(key);
        return null;
      }
      return entry.value;
    },
    set(key: string, value: T): void {
      entries.set(key, {
        value,
        expiresAtMs: now().getTime() + ttlSeconds * 1000
      });
    },
    clear(): void {
      entries.clear();
    }
  };
}

export function createDailyQuotaGuard({
  dailyLimit,
  now = () => new Date()
}: {
  dailyLimit: number;
  now?: Clock;
}) {
  let activeDay = utcDay(now());
  let consumedToday = 0;

  function resetIfNeeded(): void {
    const currentDay = utcDay(now());
    if (currentDay !== activeDay) {
      activeDay = currentDay;
      consumedToday = 0;
    }
  }

  function snapshot(): DailyQuotaSnapshot {
    resetIfNeeded();
    return {
      dailyLimit,
      consumedToday,
      remainingToday: Math.max(0, dailyLimit - consumedToday)
    };
  }

  return {
    snapshot,
    tryConsume(): { allowed: boolean; snapshot: DailyQuotaSnapshot } {
      resetIfNeeded();
      if (consumedToday >= dailyLimit) {
        return { allowed: false, snapshot: snapshot() };
      }
      consumedToday += 1;
      return { allowed: true, snapshot: snapshot() };
    }
  };
}
```

- [ ] **Step 4: Run the cache/quota tests to verify they pass**

Run:

```bash
pnpm exec vitest run apps/api/src/services/matchday-cache.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

Run:

```bash
git add apps/api/src/services/matchday-cache.ts apps/api/src/services/matchday-cache.test.ts
git commit -m "feat: add matchday cache and quota guard"
```

---

### Task 3: Route `/api/v1/matches` Through API-Football Service

**Files:**
- Create: `apps/api/src/routes/matches.ts`
- Create: `apps/api/src/routes/matches.test.ts`
- Modify: `apps/api/src/index.ts`
- Modify: `.env.example`

- [ ] **Step 1: Write the failing route tests**

Create `apps/api/src/routes/matches.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { handleMatches, type MatchFeedResponse } from './matches.js';
import type { AppMatch } from '../providers/api-football-client.js';

function responseMock() {
  return {
    statusCode: 0,
    headers: undefined as Record<string, string> | undefined,
    body: '',
    setHeader() {},
    writeHead(statusCode: number, headers?: Record<string, string>) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(body?: unknown) {
      this.body = typeof body === 'string' ? body : '';
    }
  };
}

const match: AppMatch = {
  id: 'api-football-fixture-1',
  sourceProviderId: 'api-football',
  providerFixtureId: '1',
  competitionId: 'api-football-league-1',
  competitionName: 'FIFA World Cup',
  seasonId: 'api-football-season-2026',
  round: 'Group Stage - 1',
  status: 'scheduled',
  statusLabel: 'Not Started',
  kickoffTime: '2026-06-29T10:00:00.000Z',
  homeTeam: { id: 'api-football-team-1', name: 'Japan' },
  awayTeam: { id: 'api-football-team-2', name: 'Vietnam' },
  score: null,
  venueName: 'Tokyo Stadium',
  elapsedMinute: null
};

describe('matches route', () => {
  it('returns a normalized provider-backed match feed', async () => {
    const response = responseMock();

    await handleMatches(
      { url: '/api/v1/matches?date=2026-06-29', method: 'GET' } as import('http').IncomingMessage,
      response as unknown as import('http').ServerResponse,
      {
        loadMatches: async () => ({
          sourceProviderId: 'api-football',
          mode: 'date',
          fetchedAt: '2026-06-29T00:00:00.000Z',
          cache: { status: 'miss', ttlSeconds: 900 },
          quota: { dailyLimit: 100, consumedToday: 1, remainingToday: 99 },
          matches: [match],
          warnings: []
        })
      }
    );

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as MatchFeedResponse;
    expect(body.matches).toEqual([match]);
    expect(body.cache.status).toBe('miss');
  });

  it('uses a structured error instead of mock fallback when provider setup fails', async () => {
    const response = responseMock();

    await handleMatches(
      { url: '/api/v1/matches?date=2026-06-29', method: 'GET' } as import('http').IncomingMessage,
      response as unknown as import('http').ServerResponse,
      {
        loadMatches: async () => {
          const error = new Error('API_FOOTBALL_KEY is required for API-Football match feed.');
          Object.assign(error, { code: 'api_football_key_missing', statusCode: 503 });
          throw error;
        }
      }
    );

    expect(response.statusCode).toBe(503);
    expect(JSON.parse(response.body)).toEqual({
      error: {
        code: 'api_football_key_missing',
        message: 'API_FOOTBALL_KEY is required for API-Football match feed.'
      }
    });
  });

  it('rejects unsafe date query values', async () => {
    const response = responseMock();

    await handleMatches(
      { url: '/api/v1/matches?date=not-a-date', method: 'GET' } as import('http').IncomingMessage,
      response as unknown as import('http').ServerResponse,
      { loadMatches: async () => { throw new Error('should not be called'); } }
    );

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error.code).toBe('invalid_match_date');
  });
});
```

- [ ] **Step 2: Run the route test to verify it fails**

Run:

```bash
pnpm exec vitest run apps/api/src/routes/matches.test.ts
```

Expected: FAIL because `apps/api/src/routes/matches.ts` does not exist.

- [ ] **Step 3: Add the matches route and default service**

Create `apps/api/src/routes/matches.ts`:

```typescript
import type { IncomingMessage, ServerResponse } from 'http';
import {
  ApiFootballProviderError,
  createApiFootballClient,
  readApiFootballConfig,
  type AppMatch
} from '../providers/api-football-client.js';
import {
  createDailyQuotaGuard,
  createMatchdayCache,
  type CacheStatus,
  type DailyQuotaSnapshot
} from '../services/matchday-cache.js';

export type MatchFeedResponse = {
  sourceProviderId: 'api-football';
  mode: 'date';
  fetchedAt: string;
  cache: { status: CacheStatus; ttlSeconds: number };
  quota: DailyQuotaSnapshot;
  matches: AppMatch[];
  warnings: string[];
};

type MatchLoader = (date: string) => Promise<MatchFeedResponse>;

const ttlSeconds = 900;

const cachedFeeds = createMatchdayCache<Omit<MatchFeedResponse, 'cache'>>({
  ttlSeconds
});

let quotaGuard: ReturnType<typeof createDailyQuotaGuard> | null = null;

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

async function defaultLoadMatches(date: string): Promise<MatchFeedResponse> {
  const config = readApiFootballConfig(process.env);
  quotaGuard ??= createDailyQuotaGuard({ dailyLimit: config.dailyLimit });

  const cacheKey = `api-football:fixtures:date:${date}`;
  const cached = cachedFeeds.get(cacheKey);
  if (cached) {
    return {
      ...cached,
      cache: { status: 'hit', ttlSeconds },
      quota: quotaGuard.snapshot()
    };
  }

  const quota = quotaGuard.tryConsume();
  if (!quota.allowed) {
    throw new ApiFootballProviderError(
      'api_football_quota_exhausted',
      'API-Football daily quota guard is exhausted for this local API process.',
      429
    );
  }

  const client = createApiFootballClient({ config });
  const result = await client.fetchFixturesByDate(date);
  const feed: Omit<MatchFeedResponse, 'cache'> = {
    sourceProviderId: 'api-football',
    mode: 'date',
    fetchedAt: new Date().toISOString(),
    quota: quota.snapshot,
    matches: result.matches,
    warnings: result.warnings
  };
  cachedFeeds.set(cacheKey, feed);

  return {
    ...feed,
    cache: { status: 'miss', ttlSeconds }
  };
}

function errorStatus(error: unknown): number {
  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return typeof statusCode === 'number' ? statusCode : 500;
}

function errorCode(error: unknown): string {
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : 'matches_route_error';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Failed to load match feed.';
}

export async function handleMatches(
  req: IncomingMessage,
  res: ServerResponse,
  dependencies: { loadMatches?: MatchLoader } = {}
): Promise<void> {
  const parsedUrl = new URL(req.url || '/', 'http://localhost');
  const date = parsedUrl.searchParams.get('date') || todayUtc();

  if (!validDate(date)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: {
        code: 'invalid_match_date',
        message: 'date must use YYYY-MM-DD format.'
      }
    }));
    return;
  }

  try {
    const loadMatches = dependencies.loadMatches ?? defaultLoadMatches;
    const payload = await loadMatches(date);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
  } catch (error) {
    res.writeHead(errorStatus(error), { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: {
        code: errorCode(error),
        message: errorMessage(error)
      }
    }));
  }
}
```

- [ ] **Step 4: Wire the route in the API server**

Modify `apps/api/src/index.ts`:

```typescript
import http from 'http';
import { handleHealth } from './routes/health.js';
import { handleMatches } from './routes/matches.js';
import { handlePredictions } from './routes/predictions.mock.js';
import { handleExplanations } from './routes/explanations.mock.js';
import { handleBetHistory } from './routes/bet-history.mock.js';
import { handleIngestionStatus } from './routes/ingestion-status.mock.js';
import { handleMockPredict } from './routes/mock-prediction.js';
import { handleMockExplain } from './routes/mock-explanation.js';

const PORT = 3001;

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url || '/', 'http://localhost');
  const pathname = parsedUrl.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  console.log(`[API Gateway] Received ${req.method} ${req.url}`);

  if (pathname === '/api/v1/health') {
    handleHealth(req, res);
  } else if (pathname === '/api/v1/matches') {
    void handleMatches(req, res);
  } else if (pathname === '/api/v1/predictions') {
    handlePredictions(req, res);
  } else if (pathname === '/api/v1/chat') {
    handleExplanations(req, res);
  } else if (pathname === '/api/v1/bets') {
    handleBetHistory(req, res);
  } else if (pathname === '/api/v1/ingestion/status') {
    handleIngestionStatus(req, res);
  } else if (pathname === '/api/v1/mock/predict') {
    handleMockPredict(req, res);
  } else if (pathname === '/api/v1/mock/explain') {
    handleMockExplain(req, res);
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Not Found: ${pathname}` }));
  }
});

server.listen(PORT, () => {
  console.log(`[API Mediation Gateway] Running at http://localhost:${PORT}`);
});
```

- [ ] **Step 5: Document env variables without secrets**

Modify `.env.example` by appending:

```dotenv
# API-Football owner-only local match feed. Keep the real key in local .env only.
API_FOOTBALL_KEY=
API_FOOTBALL_DAILY_LIMIT=100
```

- [ ] **Step 6: Run route tests to verify they pass**

Run:

```bash
pnpm exec vitest run apps/api/src/routes/matches.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 3**

Run:

```bash
git add apps/api/src/routes/matches.ts apps/api/src/routes/matches.test.ts apps/api/src/index.ts .env.example
git commit -m "feat: route matches through api-football gateway"
```

---

### Task 4: Add Web Match Feed Client

**Files:**
- Create: `apps/web/src/services/match-feed-service.ts`
- Create: `apps/web/src/services/match-feed-service.test.ts`

- [ ] **Step 1: Write the failing web service tests**

Create `apps/web/src/services/match-feed-service.test.ts`:

```typescript
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getMatchFeed } from './match-feed-service.js';

describe('web match feed service', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns a ready state from the API gateway payload', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      sourceProviderId: 'api-football',
      mode: 'date',
      fetchedAt: '2026-06-29T00:00:00.000Z',
      cache: { status: 'miss', ttlSeconds: 900 },
      quota: { dailyLimit: 100, consumedToday: 1, remainingToday: 99 },
      matches: [
        {
          id: 'api-football-fixture-1',
          sourceProviderId: 'api-football',
          providerFixtureId: '1',
          competitionId: 'api-football-league-1',
          competitionName: 'FIFA World Cup',
          seasonId: 'api-football-season-2026',
          round: 'Group Stage - 1',
          status: 'scheduled',
          statusLabel: 'Not Started',
          kickoffTime: '2026-06-29T10:00:00.000Z',
          homeTeam: { id: 'api-football-team-1', name: 'Japan' },
          awayTeam: { id: 'api-football-team-2', name: 'Vietnam' },
          score: null,
          venueName: 'Tokyo Stadium',
          elapsedMinute: null
        }
      ],
      warnings: []
    }), { status: 200 })));

    await expect(getMatchFeed('2026-06-29')).resolves.toMatchObject({
      status: 'ready',
      date: '2026-06-29',
      matches: [{ homeTeam: { name: 'Japan' }, awayTeam: { name: 'Vietnam' } }]
    });
  });

  it('returns empty and unavailable states without using hardcoded mock matches', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      sourceProviderId: 'api-football',
      mode: 'date',
      fetchedAt: '2026-06-29T00:00:00.000Z',
      cache: { status: 'miss', ttlSeconds: 900 },
      quota: { dailyLimit: 100, consumedToday: 1, remainingToday: 99 },
      matches: [],
      warnings: ['no_fixtures_for_date']
    }), { status: 200 })));

    await expect(getMatchFeed('2026-06-29')).resolves.toEqual({
      status: 'empty',
      date: '2026-06-29',
      warnings: ['no_fixtures_for_date']
    });

    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      error: {
        code: 'api_football_key_missing',
        message: 'API_FOOTBALL_KEY is required for API-Football match feed.'
      }
    }), { status: 503 })));

    await expect(getMatchFeed('2026-06-29')).resolves.toEqual({
      status: 'unavailable',
      date: '2026-06-29',
      reason: 'API_FOOTBALL_KEY is required for API-Football match feed.',
      warnings: ['api_football_key_missing']
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm exec vitest run apps/web/src/services/match-feed-service.test.ts
```

Expected: FAIL because `apps/web/src/services/match-feed-service.ts` does not exist.

- [ ] **Step 3: Add the web match feed service**

Create `apps/web/src/services/match-feed-service.ts`:

```typescript
const API_BASE_URL = 'http://localhost:3001';

export type AppMatch = {
  id: string;
  sourceProviderId: 'api-football';
  providerFixtureId: string;
  competitionId: string;
  competitionName: string;
  seasonId: string;
  round: string | null;
  status: 'scheduled' | 'in_play' | 'completed' | 'postponed' | 'cancelled' | 'unknown';
  statusLabel: string;
  kickoffTime: string;
  homeTeam: { id: string; name: string };
  awayTeam: { id: string; name: string };
  score: { home: number; away: number } | null;
  venueName: string | null;
  elapsedMinute: number | null;
};

export type MatchFeedViewState =
  | { status: 'loading'; date: string }
  | { status: 'ready'; date: string; matches: AppMatch[]; warnings: string[] }
  | { status: 'empty'; date: string; warnings: string[] }
  | { status: 'unavailable'; date: string; reason: string; warnings: string[] };

type MatchFeedApiResponse = {
  matches?: unknown;
  warnings?: unknown;
  error?: { code?: string; message?: string };
};

function readWarnings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export async function getMatchFeed(date: string): Promise<MatchFeedViewState> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/matches?date=${encodeURIComponent(date)}`);
    const payload = await response.json() as MatchFeedApiResponse;

    if (!response.ok) {
      return {
        status: 'unavailable',
        date,
        reason: payload.error?.message || `Match feed unavailable with HTTP ${response.status}.`,
        warnings: [payload.error?.code || 'match_feed_unavailable']
      };
    }

    const warnings = readWarnings(payload.warnings);
    const matches = Array.isArray(payload.matches) ? payload.matches as AppMatch[] : [];

    if (matches.length === 0) {
      return { status: 'empty', date, warnings };
    }

    return { status: 'ready', date, matches, warnings };
  } catch (error) {
    return {
      status: 'unavailable',
      date,
      reason: error instanceof Error ? error.message : 'Match feed request failed.',
      warnings: ['match_feed_request_failed']
    };
  }
}
```

- [ ] **Step 4: Run the web service tests to verify they pass**

Run:

```bash
pnpm exec vitest run apps/web/src/services/match-feed-service.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

Run:

```bash
git add apps/web/src/services/match-feed-service.ts apps/web/src/services/match-feed-service.test.ts
git commit -m "feat: add web match feed service"
```

---

### Task 5: Render Match Feed States In The Web Shell

**Files:**
- Modify: `apps/web/src/components/app-shell.ts`
- Modify: `apps/web/src/production-shell.test.ts`

- [ ] **Step 1: Write failing shell rendering tests**

Append to `apps/web/src/production-shell.test.ts`:

```typescript
describe('production shell live match feed rendering', () => {
  it('renders loading and unavailable states for API-Football feed', () => {
    const loadingHtml = renderAppShell({
      activeTabId: 'today',
      translate: t,
      matchFeed: { status: 'loading', date: '2026-06-29' }
    });
    expect(loadingHtml).toContain('Loading match feed');

    const unavailableHtml = renderAppShell({
      activeTabId: 'matches',
      translate: t,
      matchFeed: {
        status: 'unavailable',
        date: '2026-06-29',
        reason: 'API_FOOTBALL_KEY is required for API-Football match feed.',
        warnings: ['api_football_key_missing']
      }
    });
    expect(unavailableHtml).toContain('Provider setup required');
    expect(unavailableHtml).toContain('API_FOOTBALL_KEY is required for API-Football match feed.');
  });

  it('renders real provider matches and removes visible hardcoded live feed labels', () => {
    const html = renderAppShell({
      activeTabId: 'matches',
      translate: t,
      matchFeed: {
        status: 'ready',
        date: '2026-06-29',
        warnings: [],
        matches: [
          {
            id: 'api-football-fixture-1',
            sourceProviderId: 'api-football',
            providerFixtureId: '1',
            competitionId: 'api-football-league-1',
            competitionName: 'FIFA World Cup',
            seasonId: 'api-football-season-2026',
            round: 'Group Stage - 1',
            status: 'scheduled',
            statusLabel: 'Not Started',
            kickoffTime: '2026-06-29T10:00:00.000Z',
            homeTeam: { id: 'api-football-team-1', name: 'Japan' },
            awayTeam: { id: 'api-football-team-2', name: 'Vietnam' },
            score: null,
            venueName: 'Tokyo Stadium',
            elapsedMinute: null
          }
        ]
      }
    });

    expect(html).toContain('Japan vs Vietnam');
    expect(html).toContain('FIFA World Cup');
    expect(html).not.toContain('Team Alpha vs Team Beta');
    expect(html).not.toContain('Team Gamma vs Team Delta');
  });
});
```

- [ ] **Step 2: Run the shell tests to verify they fail**

Run:

```bash
pnpm exec vitest run apps/web/src/production-shell.test.ts
```

Expected: FAIL because `renderAppShell` does not accept `matchFeed` and still renders hardcoded feed labels.

- [ ] **Step 3: Add match feed rendering helpers**

Modify `apps/web/src/components/app-shell.ts` imports:

```typescript
import type { AppMatch, MatchFeedViewState } from '../services/match-feed-service.js';
```

Add helpers near the existing render helpers:

```typescript
const defaultMatchFeed: MatchFeedViewState = Object.freeze({
  status: 'loading',
  date: new Date().toISOString().slice(0, 10)
});

function formatKickoffTime(isoValue: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC'
  }).format(new Date(isoValue));
}

function matchTitle(match: AppMatch): string {
  return `${match.homeTeam.name} vs ${match.awayTeam.name}`;
}

function matchMeta(match: AppMatch): string {
  const score = match.score ? `Score ${match.score.home}-${match.score.away}` : `Kickoff ${formatKickoffTime(match.kickoffTime)} UTC`;
  const round = match.round ? ` · ${match.round}` : '';
  return `${match.competitionName}${round} · ${score} · ${match.statusLabel}`;
}

function renderFeedUnavailable(feed: Extract<MatchFeedViewState, { status: 'unavailable' }>): string {
  return `
    <section class="note-card warning" data-match-feed-state="unavailable">
      <div class="note-eyebrow">Provider setup required</div>
      <div class="note-title">API-Football match feed is unavailable.</div>
      <p class="note-copy">${escapeHtml(feed.reason)}</p>
    </section>
  `;
}

function renderFeedLoading(feed: Extract<MatchFeedViewState, { status: 'loading' }>): string {
  return `
    <section class="note-card" data-match-feed-state="loading">
      <div class="note-eyebrow">API-Football</div>
      <div class="note-title">Loading match feed</div>
      <p class="note-copy">Fetching owner-only matchday fixtures for ${escapeHtml(feed.date)}.</p>
    </section>
  `;
}

function renderFeedEmpty(feed: Extract<MatchFeedViewState, { status: 'empty' }>): string {
  return `
    <section class="note-card" data-match-feed-state="empty">
      <div class="note-eyebrow">API-Football</div>
      <div class="note-title">No fixtures found for ${escapeHtml(feed.date)}.</div>
      <p class="note-copy">The provider returned an empty fixture list for this date.</p>
    </section>
  `;
}

function renderProviderMatchCard(match: AppMatch): string {
  const title = matchTitle(match);
  const meta = matchMeta(match);
  const statusClass = match.status === 'in_play' ? 'blue' : match.status === 'completed' ? '' : 'amber';
  return `
    <article class="match-card" data-match-card data-provider-match-id="${escapeHtml(match.id)}">
      <div class="match-main">
        <div class="match-topline">
          <div class="tag-row">
            <span class="tag ${statusClass}">${escapeHtml(match.statusLabel)}</span>
            <span class="tag">${escapeHtml(match.competitionName)}</span>
          </div>
          <div class="row-actions">
            <button class="text-button" type="button" data-open-match data-match-title="${escapeHtml(title)}" data-match-meta="${escapeHtml(meta)}">Open</button>
            <button class="icon-button" type="button" data-toggle-match aria-expanded="true" aria-label="Collapse ${escapeHtml(title)}">${icons.up}</button>
          </div>
        </div>
        <h3 class="match-title">${escapeHtml(title)}</h3>
        <p class="match-meta">${escapeHtml(meta)}</p>
      </div>
      <div class="ledger-detail">
        <div class="ledger-row">
          <div>
            <div class="ledger-title">Provider fixture</div>
            <div class="ledger-meta">API-Football fixture ${escapeHtml(match.providerFixtureId)}. No odds or prediction loaded.</div>
          </div>
          <span class="ledger-state">${escapeHtml(match.status)}</span>
        </div>
      </div>
    </article>
  `;
}

function renderProviderMatchRow(match: AppMatch): string {
  const title = matchTitle(match);
  const meta = matchMeta(match);
  return renderMatchRow(title, meta, meta);
}

function renderMatchFeedCards(feed: MatchFeedViewState): string {
  if (feed.status === 'loading') return renderFeedLoading(feed);
  if (feed.status === 'unavailable') return renderFeedUnavailable(feed);
  if (feed.status === 'empty') return renderFeedEmpty(feed);
  return feed.matches.map(renderProviderMatchCard).join('');
}

function renderMatchFeedRows(feed: MatchFeedViewState): string {
  if (feed.status === 'loading') return renderFeedLoading(feed);
  if (feed.status === 'unavailable') return renderFeedUnavailable(feed);
  if (feed.status === 'empty') return renderFeedEmpty(feed);
  return feed.matches.map(renderProviderMatchRow).join('');
}
```

- [ ] **Step 4: Replace hardcoded Today and Matches feed surfaces**

Change `renderTodayPanel` signature:

```typescript
function renderTodayPanel(
  activeTabId: ProductionNavigationTabId,
  translate: TranslateFunction,
  matchFeed: MatchFeedViewState
): string {
```

Replace its visible hardcoded `stack` match cards with:

```typescript
      <div class="stack">
        ${renderMatchFeedCards(matchFeed)}

        <section class="note-card">
          <div class="note-eyebrow">Miraichi note</div>
          <div class="note-title">This shell is a journal surface, not an advice engine.</div>
          <p class="note-copy">The match feed can show provider fixture context, but this shell does not rank picks, estimate confidence, or propose stake size.</p>
        </section>
      </div>
```

Change `renderMatchesPanel` signature:

```typescript
function renderMatchesPanel(
  activeTabId: ProductionNavigationTabId,
  translate: TranslateFunction,
  matchFeed: MatchFeedViewState
): string {
```

Replace its hardcoded date group rows with:

```typescript
      <div class="date-group">
        <div class="group-label">${escapeHtml(matchFeed.date)}</div>
        ${renderMatchFeedRows(matchFeed)}
      </div>

      <div class="empty-state" id="matches-empty">No provider matches match this search.</div>
```

Change `panelRenderers` type and entries:

```typescript
const panelRenderers: Record<
  ProductionNavigationTabId,
  (activeTabId: ProductionNavigationTabId, translate: TranslateFunction, matchFeed: MatchFeedViewState) => string
> = Object.freeze({
  today: renderTodayPanel,
  matches: renderMatchesPanel,
  bets: (activeTabId, translate) => renderBetsPanel(activeTabId, translate),
  bankroll: (activeTabId, translate) => renderBankrollPanel(activeTabId, translate),
  miraichi: (activeTabId, translate) => renderMiraichiPanel(activeTabId, translate)
});
```

Change `renderAppShell` signature and panel call:

```typescript
export function renderAppShell({
  activeTabId = 'today',
  translate = t,
  matchFeed = defaultMatchFeed
}: {
  readonly activeTabId?: string;
  readonly translate?: TranslateFunction;
  readonly matchFeed?: MatchFeedViewState;
} = {}): string {
  const safeActiveTabId = getSafeNavigationTabId(activeTabId);
  const activeTab = navigationTabs.find((tab: NavigationTab) => tab.id === safeActiveTabId) ?? navigationTabs[0];
  const panels = navigationTabs.map((tab) => panelRenderers[tab.id](safeActiveTabId, translate, matchFeed)).join('');
```

- [ ] **Step 5: Run the shell tests to verify they pass**

Run:

```bash
pnpm exec vitest run apps/web/src/production-shell.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 5**

Run:

```bash
git add apps/web/src/components/app-shell.ts apps/web/src/production-shell.test.ts
git commit -m "feat: render provider match feed in web shell"
```

---

### Task 6: Fetch Match Feed From Shell Entry

**Files:**
- Modify: `apps/web/src/shell-entry.ts`
- Modify: `apps/web/src/production-shell.test.ts`

- [ ] **Step 1: Write a failing source-level shell-entry test**

Append to `apps/web/src/production-shell.test.ts`:

```typescript
describe('production shell entry match feed wiring', () => {
  it('loads match feed through the web service instead of hardcoded shell-only data', () => {
    const source = readFileSync(fileURLToPath(new URL('./shell-entry.ts', import.meta.url)), 'utf8');

    expect(source).toContain("import { getMatchFeed");
    expect(source).toContain("matchFeedState");
    expect(source).toContain("void refreshMatchFeed");
    expect(source).not.toContain("Team Alpha vs Team Beta");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm exec vitest run apps/web/src/production-shell.test.ts
```

Expected: FAIL because `shell-entry.ts` does not import or call `getMatchFeed`.

- [ ] **Step 3: Wire match feed loading in shell entry**

Modify `apps/web/src/shell-entry.ts` imports:

```typescript
import { getSafeNavigationTabId, type ProductionNavigationTabId } from './config/navigation-tabs.js';
import { renderAppShell } from './components/app-shell.js';
import { createSettingsService } from './services/settings-service.js';
import { t } from './services/i18n-service.js';
import { getMatchFeed, type MatchFeedViewState } from './services/match-feed-service.js';
```

Add state near existing state variables:

```typescript
function todayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

let matchFeedState: MatchFeedViewState = {
  status: 'loading',
  date: todayLocalDate()
};
```

Modify `render`:

```typescript
function render(activeTabId: string): void {
  const safeActiveTabId = getSafeNavigationTabId(activeTabId);
  currentScreenName = safeActiveTabId;
  matchDetailReturnScreen = safeActiveTabId;
  appRoot.innerHTML = renderAppShell({
    activeTabId: safeActiveTabId,
    translate: t,
    matchFeed: matchFeedState
  });
  appRoot.querySelector('.app-shell')?.setAttribute('data-locale', settingsService.getSettings().locale);
}
```

Add refresh function before event listeners:

```typescript
async function refreshMatchFeed(): Promise<void> {
  const date = matchFeedState.date;
  matchFeedState = { status: 'loading', date };
  render(currentScreenName);
  matchFeedState = await getMatchFeed(date);
  render(currentScreenName);
}
```

Replace the final render call:

```typescript
render(getInitialTabId());
void refreshMatchFeed();
```

- [ ] **Step 4: Run shell tests to verify they pass**

Run:

```bash
pnpm exec vitest run apps/web/src/production-shell.test.ts apps/web/src/services/match-feed-service.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 6**

Run:

```bash
git add apps/web/src/shell-entry.ts apps/web/src/production-shell.test.ts
git commit -m "feat: load provider match feed in web shell"
```

---

### Task 7: Focused Verification And Phase Evidence

**Files:**
- Modify: `PROJECT_PLAN.md`

- [ ] **Step 1: Run all focused tests**

Run:

```bash
pnpm exec vitest run apps/api/src/providers apps/api/src/services apps/api/src/routes apps/web/src
```

Expected: PASS.

- [ ] **Step 2: Run typecheck and lifecycle verification**

Run:

```bash
pnpm run typecheck
pnpm run verify:lifecycle
git diff --check
```

Expected:

```text
No TypeScript errors.
[Lifecycle Verify] PASSED.
```

`git diff --check` prints no output.

- [ ] **Step 3: Optional local provider smoke with owner key**

Run only on the owner's machine after setting a local, uncommitted key:

```powershell
$env:API_FOOTBALL_KEY="owner-local-key"
pnpm run dev:api
```

In another terminal:

```powershell
Invoke-RestMethod "http://localhost:3001/api/v1/matches?date=2026-06-29"
```

Expected:

```text
Response contains sourceProviderId api-football and an array field named matches.
No API key appears in the response.
```

- [ ] **Step 4: Rendered web validation**

Run:

```powershell
pnpm run dev:web
```

Open:

```text
http://localhost:3010
```

Expected:

```text
Today and Matches display loading, unavailable, empty, or provider-backed match feed state.
Visible live feed surfaces do not show Team Alpha vs Team Beta or Team Gamma vs Team Delta.
Browser console has no relevant app errors.
```

- [ ] **Step 5: Update `PROJECT_PLAN.md` with actual evidence**

Add after the Phase 8.6C entry:

```markdown
- [x] Create `phase:implementation-plan Phase 8.6E API-Football Owner-Only App Live Data`.
  - **Result**: Implementation plan created to replace visible hardcoded app match feed data with backend-mediated API-Football fixture data, plus cache/quota guard and honest unavailable states.
  - **Constraints**: No odds, no prediction runtime, no betting recommendation, no provider key in browser code, no public traffic, and no raw CSV ingestion changes in this phase.
```

After implementation and verification pass, add:

```markdown
- [x] Complete Phase 8.6E API-Football Owner-Only App Live Data.
  - **Result**: `/api/v1/matches` uses backend-mediated API-Football fixture normalization and the web shell renders provider-backed match feed states.
  - **Evidence**: Focused API/web tests, typecheck, lifecycle verification, and `git diff --check` passed. Manual provider smoke requires a local `API_FOOTBALL_KEY` and must not record or expose the key.
  - **Constraint**: Odds, prediction runtime, betting recommendation, public traffic, and raw CSV append-only merge remain out of scope.
```

If implementation is blocked by missing owner key, use this blocker entry instead of the completion entry:

```markdown
- [ ] Complete Phase 8.6E API-Football Owner-Only App Live Data.
  - **Blocker**: Local `API_FOOTBALL_KEY` is required for live provider smoke. Code must still pass missing-key tests and show an honest unavailable state.
  - **Constraint**: Do not bypass the backend or put the key in browser code.
```

- [ ] **Step 6: Run final local verification**

Run:

```bash
pnpm run verify:local
```

Expected: PASS.

- [ ] **Step 7: Commit Task 7**

Run:

```bash
git add PROJECT_PLAN.md
git commit -m "docs: record phase 8.6e api-football app data evidence"
```

---

## Final Review Checklist

- [ ] Browser code contains no API-Football key or direct API-Football URL.
- [ ] `/api/v1/matches` does not return `MOCK_MATCHES`.
- [ ] Missing-key state returns `503` with `api_football_key_missing`.
- [ ] Quota-exhausted state returns `429` with `api_football_quota_exhausted`.
- [ ] Today and Matches use `matchFeed` state.
- [ ] Visible live feed surfaces no longer show `Team Alpha vs Team Beta` or `Team Gamma vs Team Delta`.
- [ ] Odds and prediction behavior were not added.
- [ ] Raw CSV ingestion files were not changed in this phase.
- [ ] Focused tests pass.
- [ ] `pnpm run typecheck` passes.
- [ ] `pnpm run verify:lifecycle` passes.
- [ ] `git diff --check` passes.
- [ ] `pnpm run verify:local` passes before phase closeout.

## Recommended Next Lifecycle Command

After this implementation plan is approved, run:

```text
phase:code-slice Phase 8.6E API-Football Provider Client And Normalization
```

Do not start odds integration, raw CSV append-only merge, prediction runtime, or public traffic work from this plan. The earliest safe follow-up after Phase 8.6E is either:

```text
phase:plan Phase 8.6F Raw CSV Append-Only Snapshot Merge
```

or:

```text
phase:plan Phase 8.6G API-Football Match Detail Lazy Loading
```
