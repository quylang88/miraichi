import { describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleMatchDetail } from '../../apps/api/src/routes/match-detail.js';
import { LocalMatchDetailStore } from '../../apps/api/src/repositories/local-match-detail-store.js';
import { MatchDetailRefreshQueue } from '../../apps/api/src/repositories/match-detail-refresh-queue.js';
import { ServingMatchStoreRepository } from '../../apps/api/src/repositories/serving-match-store-repository.js';
import { runApiFootballMatchDetailJob } from '../../apps/worker/src/jobs/api-football-match-detail-job.js';
import { runApiFootballHydrationJob } from '../../apps/worker/src/jobs/api-football-hydration-job.js';
import { runApiFootballIngestionJob } from '../../apps/worker/src/jobs/api-football-ingestion-job.js';
import { ApiFootballClient, type ApiFootballApiResponse, type ApiFootballFixtureItem } from '../../apps/worker/src/sources/api-football/api-football-client.js';
import { HydrationCheckpointManager } from '../../apps/worker/src/sources/api-football/hydration-checkpoint-manager.js';
import type { ApiFootballCompetitionEntry } from '@miraichi/config';

const TEST_COMPETITIONS: readonly ApiFootballCompetitionEntry[] = [
  {
    entryId: 'api-football-eng-premier-league',
    sourceId: 'api-football',
    competitionId: 'eng-premier-league',
    competitionName: 'Premier League',
    country: 'England',
    category: 'top5_europe',
    competitionType: 'club',
    providerLeagueId: 39,
    currentSeason: 2026,
    historicalSeasons: [2025],
    sourceTimezone: 'Europe/London',
    enabled: true
  }
];

const RICH_MOCK_FIXTURE_FT: ApiFootballFixtureItem = {
  fixture: {
    id: 5001,
    referee: 'Michael Oliver',
    timezone: 'UTC',
    date: '2026-08-26T15:00:00+00:00',
    timestamp: 1787756400,
    venue: { id: 556, name: 'Emirates Stadium', city: 'London' },
    status: { long: 'Match Finished', short: 'FT', elapsed: 90 }
  },
  league: { id: 39, name: 'Premier League', country: 'England', season: 2026, round: 'Regular Season - 1' },
  teams: {
    home: { id: 42, name: 'Arsenal', winner: true },
    away: { id: 49, name: 'Chelsea', winner: false }
  },
  goals: { home: 2, away: 1 },
  score: {
    halftime: { home: 1, away: 0 },
    fulltime: { home: 2, away: 1 },
    extratime: { home: null, away: null },
    penalty: { home: null, away: null }
  },
  events: [
    {
      time: { elapsed: 25, extra: null },
      team: { id: 42, name: 'Arsenal' },
      player: { id: 145, name: 'Bukayo Saka' },
      assist: { id: 146, name: 'Martin Odegaard' },
      type: 'Goal',
      detail: 'Normal Goal'
    },
    {
      time: { elapsed: 65, extra: null },
      team: { id: 49, name: 'Chelsea' },
      player: { id: 210, name: 'Cole Palmer' },
      assist: { id: null, name: null },
      type: 'Card',
      detail: 'Yellow Card'
    }
  ],
  statistics: [
    {
      team: { id: 42, name: 'Arsenal' },
      statistics: [
        { type: 'Corner Kicks', value: 6 },
        { type: 'Yellow Cards', value: 1 },
        { type: 'Red Cards', value: 0 },
        { type: 'Total Shots', value: 14 },
        { type: 'Shots on Goal', value: 5 },
        { type: 'Ball Possession', value: '58%' }
      ]
    },
    {
      team: { id: 49, name: 'Chelsea' },
      statistics: [
        { type: 'Corner Kicks', value: 3 },
        { type: 'Yellow Cards', value: 2 },
        { type: 'Red Cards', value: 0 },
        { type: 'Total Shots', value: 8 },
        { type: 'Shots on Goal', value: 3 },
        { type: 'Ball Possession', value: '42%' }
      ]
    }
  ]
};

interface CapturedMatchDetailBody {
  status?: string;
  code?: string;
  match?: { id?: string };
  referee?: string | null;
  events?: unknown[];
  teamStats?: unknown[];
  notes?: unknown[];
}

async function executeRouteRequest(
  matchId: string,
  dataRoot: string
): Promise<{
  statusCode: number;
  headers: Record<string, string>;
  body: CapturedMatchDetailBody;
}> {
  return new Promise((resolve, reject) => {
    let capturedStatusCode = 200;
    const capturedHeaders: Record<string, string> = {};
    let capturedBody = '';

    const req = {
      url: `/api/v1/matches/detail?id=${encodeURIComponent(matchId)}`,
      method: 'GET'
    } as unknown as IncomingMessage;

    const res = {
      writeHead(statusCode: number, headers?: Record<string, string>) {
        capturedStatusCode = statusCode;
        if (headers) Object.assign(capturedHeaders, headers);
        return this;
      },
      setHeader(name: string, value: string) {
        capturedHeaders[name.toLowerCase()] = value;
      },
      end(chunk?: string) {
        if (chunk) capturedBody += chunk;
        try {
          resolve({
            statusCode: capturedStatusCode,
            headers: capturedHeaders,
            body: capturedBody ? JSON.parse(capturedBody) as CapturedMatchDetailBody : {}
          });
        } catch (e) {
          reject(e);
        }
      }
    } as unknown as ServerResponse;

    handleMatchDetail(req, res, { dataRoot }).catch(reject);
  });
}

describe('API-Football Match Detail Lazy Refresh & Security Integration', () => {
  it('implements 202 pending -> worker refresh -> 200 cached detail without second provider call', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-match-detail-integration-'));

    try {
      let fetchCallCount = 0;
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        fetchCallCount += 1;
        if (url.includes('season=2025')) {
          return {
            ok: true,
            status: 200,
            json: async (): Promise<ApiFootballApiResponse<ApiFootballFixtureItem>> => ({
              get: 'fixtures',
              parameters: {},
              errors: [],
              results: 1,
              response: [{
                ...RICH_MOCK_FIXTURE_FT,
                fixture: { ...RICH_MOCK_FIXTURE_FT.fixture, id: 5001 },
                league: { ...RICH_MOCK_FIXTURE_FT.league, season: 2025 }
              }]
            })
          };
        }

        if (url.includes('ids=5001')) {
          return {
            ok: true,
            status: 200,
            json: async (): Promise<ApiFootballApiResponse<ApiFootballFixtureItem>> => ({
              get: 'fixtures',
              parameters: {},
              errors: [],
              results: 1,
              response: [RICH_MOCK_FIXTURE_FT]
            })
          };
        }

        return {
          ok: true,
          status: 200,
          json: async (): Promise<ApiFootballApiResponse<ApiFootballFixtureItem>> => ({
            get: 'fixtures',
            parameters: {},
            errors: [],
            results: 0,
            response: []
          })
        };
      });

      const client = new ApiFootballClient({
        apiKey: 'test-api-key',
        fetchFn: mockFetch as unknown as typeof fetch,
        dataRoot: tempDir,
        sleepFn: async () => {}
      });

      // 1. Hydrate historical season (creates completed match in serving store, without detail cache)
      const checkpointManager = new HydrationCheckpointManager({
        storagePath: join(tempDir, 'hydration-checkpoints.json')
      });
      await runApiFootballHydrationJob({
        dataRoot: tempDir,
        client,
        checkpointManager,
        registry: TEST_COMPETITIONS,
        now: () => new Date('2026-08-26T04:00:00.000Z')
      });

      const repo = new ServingMatchStoreRepository({ servingRoot: join(tempDir, 'serving') });
      const snap = await repo.listMatches();
      expect(snap.matches).toHaveLength(1);
      const match = snap.matches[0]!;
      expect(match.status).toBe('completed');

      // 2. Request match detail via API route -> Cache miss on completed match returns 202 pending
      const res1 = await executeRouteRequest(match.id, tempDir);
      expect(res1.statusCode).toBe(202);
      expect(res1.body.status).toBe('pending');
      expect(res1.body.code).toBe('detail_pending');
      expect(res1.body.match?.id).toBe(match.id);
      expect(res1.headers['Retry-After']).toBe('150');

      // Verify item is enqueued in refresh queue
      const queue = new MatchDetailRefreshQueue({ dataRoot: tempDir });
      const item = await queue.getItem(match.id);
      expect(item).not.toBeNull();
      expect(item!.matchId).toBe(match.id);
      expect(item!.status).toBe('pending');

      const callsBeforeWorker = fetchCallCount;

      // 3. Worker detail job runs and processes the refresh queue
      const workerResult = await runApiFootballMatchDetailJob({
        dataRoot: tempDir,
        client,
        now: () => new Date('2026-08-26T04:10:00.000Z')
      });

      expect(workerResult.status).toBe('success');
      expect(workerResult.itemsProcessed).toBe(1);

      // Verify detail is now cached in LocalMatchDetailStore
      const detailStore = new LocalMatchDetailStore({ dataRoot: tempDir });
      const cached = await detailStore.getDetail(match.id);
      expect(cached).not.toBeNull();
      expect(cached!.referee).toBe('Michael Oliver');
      expect(cached!.events).toHaveLength(2);
      expect(cached!.teamStats).toHaveLength(2);

      const callsAfterWorker = fetchCallCount;
      expect(callsAfterWorker).toBe(callsBeforeWorker + 1); // exactly 1 provider request for the detail batch

      // 4. Request match detail again via API route -> Returns 200 with cached detail
      const res2 = await executeRouteRequest(match.id, tempDir);
      expect(res2.statusCode).toBe(200);
      expect(res2.body.match?.id).toBe(match.id);
      expect(res2.body.referee).toBe('Michael Oliver');
      expect(res2.body.events).toHaveLength(2);
      expect(res2.body.teamStats).toHaveLength(2);

      // Verify NO additional provider calls were made on 2nd API request
      expect(fetchCallCount).toBe(callsAfterWorker);

      // 5. Security & Provider Neutrality Check on API payload:
      const rawJson = JSON.stringify(res2.body);
      expect(rawJson).not.toContain('5001'); // provider fixture ID stripped from sourceRefs
      expect(rawJson).not.toContain('test-api-key'); // API key never leaked
      expect(rawJson).not.toContain('api-sports.io'); // provider URL not leaked
      expect(rawJson).not.toContain('providerFixtureId');
      expect(rawJson).not.toContain('sourceMatchId');
      expect(rawJson).not.toContain('sourceUrl');
      expect(rawJson).not.toContain('prediction');
      expect(rawJson).not.toContain('xG');
      expect(rawJson).not.toContain('odds');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }, 25_000);

  it('keeps extra-time and penalty matches pollable after +115 minutes and caches AET/PEN detail only when terminal', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-terminal-detail-integration-'));

    try {
      const fixtureAt = (id: number, date: string, short: string, elapsed: number): ApiFootballFixtureItem => ({
        ...RICH_MOCK_FIXTURE_FT,
        fixture: {
          ...RICH_MOCK_FIXTURE_FT.fixture,
          id,
          date,
          timestamp: Math.floor(Date.parse(date) / 1000),
          status: { long: short, short, elapsed }
        },
        league: {
          ...RICH_MOCK_FIXTURE_FT.league,
          round: id === 5102 ? 'Regular Season - 2' : 'Regular Season - 1'
        }
      });
      const initialFixtures = [
        fixtureAt(5101, '2026-08-26T15:00:00+00:00', '2H', 89),
        fixtureAt(5102, '2026-08-26T15:05:00+00:00', '2H', 89)
      ];
      const activeExtendedFixtures = [
        fixtureAt(5101, '2026-08-26T15:00:00+00:00', 'ET', 105),
        fixtureAt(5102, '2026-08-26T15:05:00+00:00', 'P', 120)
      ];
      const terminalFixtures = [
        fixtureAt(5101, '2026-08-26T15:00:00+00:00', 'AET', 120),
        fixtureAt(5102, '2026-08-26T15:05:00+00:00', 'PEN', 120)
      ];
      let pollCount = 0;
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        const response = url.includes('ids=')
          ? (++pollCount === 1 ? activeExtendedFixtures : terminalFixtures)
          : initialFixtures;
        return {
          ok: true,
          status: 200,
          json: async (): Promise<ApiFootballApiResponse<ApiFootballFixtureItem>> => ({
            get: 'fixtures',
            parameters: {},
            errors: [],
            results: response.length,
            response
          })
        };
      });
      const client = new ApiFootballClient({
        apiKey: 'test-api-key',
        fetchFn: mockFetch as unknown as typeof fetch,
        dataRoot: tempDir,
        sleepFn: async () => {}
      });

      await runApiFootballIngestionJob({
        dataRoot: tempDir,
        mode: 'daily_sync',
        date: '2026-08-26',
        client,
        registry: TEST_COMPETITIONS,
        now: () => new Date('2026-08-26T05:00:00.000Z')
      });
      const firstPoll = await runApiFootballIngestionJob({
        dataRoot: tempDir,
        mode: 'window_poll',
        client,
        registry: TEST_COMPETITIONS,
        now: () => new Date('2026-08-26T16:55:00.000Z')
      });
      expect(firstPoll.status).toBe('not_modified');

      const repository = new ServingMatchStoreRepository({ servingRoot: join(tempDir, 'serving') });
      const beforeTerminal = await repository.listMatches();
      expect(beforeTerminal.matches.every((match) => match.status === 'scheduled')).toBe(true);
      const detailStore = new LocalMatchDetailStore({ dataRoot: tempDir });
      for (const match of beforeTerminal.matches) {
        expect(await detailStore.getDetail(match.id)).toBeNull();
      }

      const terminalPoll = await runApiFootballIngestionJob({
        dataRoot: tempDir,
        mode: 'window_poll',
        client,
        registry: TEST_COMPETITIONS,
        now: () => new Date('2026-08-26T17:05:00.000Z')
      });
      expect(terminalPoll.status).toBe('published');
      expect(terminalPoll.matchesCompleted).toBe(2);
      expect(pollCount).toBe(2);

      const afterTerminal = await repository.listMatches();
      expect(afterTerminal.matches).toHaveLength(2);
      expect(afterTerminal.matches.every((match) => match.status === 'completed')).toBe(true);
      for (const match of afterTerminal.matches) {
        const detail = await detailStore.getDetail(match.id);
        expect(detail?.status).toBe('completed');
        expect(detail?.events.length).toBeGreaterThan(0);
        expect(detail?.teamStats).toHaveLength(2);
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }, 25_000);

  it('does not enqueue detail refresh for scheduled matches', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-scheduled-detail-'));

    try {
      const scheduledFixture: ApiFootballFixtureItem = {
        ...RICH_MOCK_FIXTURE_FT,
        fixture: {
          ...RICH_MOCK_FIXTURE_FT.fixture,
          id: 6001,
          date: '2026-08-26T20:00:00+00:00',
          status: { long: 'Not Started', short: 'NS', elapsed: null }
        },
        goals: { home: null, away: null },
        score: {
          halftime: { home: null, away: null },
          fulltime: { home: null, away: null },
          extratime: { home: null, away: null },
          penalty: { home: null, away: null }
        },
        events: [],
        statistics: []
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async (): Promise<ApiFootballApiResponse<ApiFootballFixtureItem>> => ({
          get: 'fixtures',
          parameters: {},
          errors: [],
          results: 1,
          response: [scheduledFixture]
        })
      });

      const client = new ApiFootballClient({
        apiKey: 'test-api-key',
        fetchFn: mockFetch as unknown as typeof fetch,
        dataRoot: tempDir,
        sleepFn: async () => {}
      });

      // Daily sync imports scheduled match
      await runApiFootballIngestionJob({
        dataRoot: tempDir,
        mode: 'daily_sync',
        date: '2026-08-26',
        client,
        registry: TEST_COMPETITIONS,
        now: () => new Date('2026-08-26T05:00:00.000Z')
      });

      const repo = new ServingMatchStoreRepository({ servingRoot: join(tempDir, 'serving') });
      const snap = await repo.listMatches();
      expect(snap.matches).toHaveLength(1);
      const match = snap.matches[0]!;
      expect(match.status).toBe('scheduled');

      // Request detail on scheduled match
      const res = await executeRouteRequest(match.id, tempDir);
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('scheduled');
      expect(res.body.events).toEqual([]);
      expect(res.body.notes).toBeDefined();

      // Ensure queue remains empty
      const queue = new MatchDetailRefreshQueue({ dataRoot: tempDir });
      const due = await queue.getDueItems();
      expect(due).toHaveLength(0);
      const item = await queue.getItem(match.id);
      expect(item).toBeNull();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }, 15_000);
});
