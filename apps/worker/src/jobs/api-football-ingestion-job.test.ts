import { describe, expect, it, vi } from 'vitest';
import {
  computeConcludingWindows,
  runApiFootballIngestionJob
} from './api-football-ingestion-job.js';
import { ApiFootballClient, type ApiFootballApiResponse, type ApiFootballFixtureItem } from '../sources/api-football/api-football-client.js';
import type { ApiFootballCompetitionEntry } from '@miraichi/config';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ApiFootballUsageLedger } from '../sources/api-football/api-football-usage-ledger.js';

const SAMPLE_REGISTRY: readonly ApiFootballCompetitionEntry[] = [
  {
    entryId: 'api-football-eng-premier-league',
    sourceId: 'api-football',
    competitionId: 'eng-premier-league',
    competitionName: 'Premier League',
    country: 'England',
    category: 'top5_europe',
    competitionType: 'club',
    providerLeagueId: 99998,
    currentSeason: 2026,
    historicalSeasons: [],
    sourceTimezone: 'Europe/London',
    enabled: true
  }
];

const MOCK_FIXTURE_SCHEDULED: ApiFootballFixtureItem = {
  fixture: {
    id: 1001,
    referee: 'Michael Oliver',
    timezone: 'UTC',
    date: '2026-08-25T15:00:00+00:00',
    timestamp: 1787670000,
    status: { long: 'Not Started', short: 'NS', elapsed: null }
  },
  league: {
    id: 99998,
    name: 'Premier League',
    country: 'England',
    season: 2026,
    round: 'Regular Season - 1'
  },
  teams: {
    home: { id: 33, name: 'Arsenal', winner: null },
    away: { id: 40, name: 'Chelsea', winner: null }
  },
  goals: { home: null, away: null },
  score: {
    halftime: { home: null, away: null },
    fulltime: { home: null, away: null },
    extratime: { home: null, away: null },
    penalty: { home: null, away: null }
  }
};

const MOCK_FIXTURE_FINISHED: ApiFootballFixtureItem = {
  ...MOCK_FIXTURE_SCHEDULED,
  fixture: {
    ...MOCK_FIXTURE_SCHEDULED.fixture,
    status: { long: 'Match Finished', short: 'FT', elapsed: 90 }
  },
  goals: { home: 2, away: 0 },
  score: {
    halftime: { home: 1, away: 0 },
    fulltime: { home: 2, away: 0 },
    extratime: { home: null, away: null },
    penalty: { home: null, away: null }
  }
};

const MOCK_FIXTURE_LIVE: ApiFootballFixtureItem = {
  ...MOCK_FIXTURE_SCHEDULED,
  fixture: {
    ...MOCK_FIXTURE_SCHEDULED.fixture,
    status: { long: 'Second Half', short: '2H', elapsed: 88 }
  },
  goals: { home: 1, away: 0 },
  score: {
    halftime: { home: 1, away: 0 },
    fulltime: { home: null, away: null },
    extratime: { home: null, away: null },
    penalty: { home: null, away: null }
  }
};

describe('computeConcludingWindows', () => {
  it('computes concluding window range [T+88m, T+115m] for scheduled matches', () => {
    const windows = computeConcludingWindows([
      { matchId: 'match-canonical-a', providerFixtureId: 1001, kickoffUtc: '2026-08-25T15:00:00.000Z', status: 'scheduled' },
      { matchId: 'match-canonical-b', providerFixtureId: 1002, kickoffUtc: '2026-08-25T15:00:00.000Z', status: 'completed' }
    ]);

    expect(windows).toHaveLength(1);
    expect(windows[0]?.providerFixtureId).toBe(1001);
    expect(windows[0]?.windowStartUtc).toBe('2026-08-25T16:28:00.000Z'); // 15:00 + 88m = 16:28
    expect(windows[0]?.windowEndUtc).toBe('2026-08-25T16:55:00.000Z');   // 15:00 + 115m = 16:55
  });

  it('does not derive provider fixture identity from a canonical match id', () => {
    expect(computeConcludingWindows([
      { matchId: 'match-1001', kickoffUtc: '2026-08-25T15:00:00.000Z', status: 'scheduled' }
    ])).toEqual([]);
  });
});

describe('runApiFootballIngestionJob', () => {
  it('runs daily sync and sets up serving store with concluding windows', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-ingest-daily-'));

    try {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async (): Promise<ApiFootballApiResponse<ApiFootballFixtureItem>> => ({
          get: 'fixtures',
          parameters: { date: '2026-08-25' },
          errors: [],
          results: 1,
          response: [MOCK_FIXTURE_SCHEDULED]
        })
      });

      const client = new ApiFootballClient({
        apiKey: 'test-api-key',
        fetchFn: mockFetch as unknown as typeof fetch,
        dataRoot: tempDir
      });
      const result = await runApiFootballIngestionJob({
        dataRoot: tempDir,
        mode: 'daily_sync',
        date: '2026-08-25',
        client,
        registry: SAMPLE_REGISTRY,
        now: () => new Date('2026-08-25T05:00:00.000Z')
      });

      expect(result.status).toBe('synced');
      expect(result.matchesProcessed).toBe(1);
      expect(result.concludingWindows).toHaveLength(1);
      expect(result.concludingWindows![0]?.providerFixtureId).toBe(1001);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('runs window poll when in concluding window, updates FT score, and publishes serving store', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-ingest-poll-'));

    try {
      // Step 1: Initial daily sync to populate scheduled match
      let fetchCount = 0;
      const mockFetch = vi.fn().mockImplementation(async () => {
        fetchCount += 1;
        if (fetchCount === 1) {
          // Daily sync
          return {
            ok: true,
            status: 200,
            json: async (): Promise<ApiFootballApiResponse<ApiFootballFixtureItem>> => ({
              get: 'fixtures',
              parameters: { date: '2026-08-25' },
              errors: [],
              results: 1,
              response: [MOCK_FIXTURE_SCHEDULED]
            })
          };
        } else {
          // Window poll response with FT score
          return {
            ok: true,
            status: 200,
            json: async (): Promise<ApiFootballApiResponse<ApiFootballFixtureItem>> => ({
              get: 'fixtures',
              parameters: { ids: '1001' },
              errors: [],
              results: 1,
              response: [MOCK_FIXTURE_FINISHED]
            })
          };
        }
      });

      const client = new ApiFootballClient({
        apiKey: 'test-api-key',
        fetchFn: mockFetch as unknown as typeof fetch,
        dataRoot: tempDir
      });

      await runApiFootballIngestionJob({
        dataRoot: tempDir,
        mode: 'daily_sync',
        date: '2026-08-25',
        client,
        registry: SAMPLE_REGISTRY,
        now: () => new Date('2026-08-25T05:00:00.000Z')
      });

      // Step 2: Simulate window poll at 16:35 UTC (kickoff was 15:00, so 95 min into the game)
      const pollResult = await runApiFootballIngestionJob({
        dataRoot: tempDir,
        mode: 'window_poll',
        client,
        registry: SAMPLE_REGISTRY,
        now: () => new Date('2026-08-25T16:35:00.000Z')
      });

      expect(pollResult.status).toBe('published');
      expect(pollResult.matchesProcessed).toBe(1);
      expect(pollResult.matchesCompleted).toBe(1);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('does not publish or expose scores when a concluding-window response is still live', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-ingest-live-noop-'));

    try {
      let fetchCount = 0;
      const mockFetch = vi.fn().mockImplementation(async () => {
        fetchCount += 1;
        const fixture = fetchCount === 1 ? MOCK_FIXTURE_SCHEDULED : MOCK_FIXTURE_LIVE;
        return {
          ok: true,
          status: 200,
          json: async (): Promise<ApiFootballApiResponse<ApiFootballFixtureItem>> => ({
            get: 'fixtures',
            parameters: fetchCount === 1 ? { date: '2026-08-25' } : { ids: '1001' },
            errors: [],
            results: 1,
            response: [fixture]
          })
        };
      });

      const client = new ApiFootballClient({
        apiKey: 'test-api-key',
        fetchFn: mockFetch as unknown as typeof fetch,
        dataRoot: tempDir
      });
      await runApiFootballIngestionJob({
        dataRoot: tempDir,
        mode: 'daily_sync',
        date: '2026-08-25',
        client,
        registry: SAMPLE_REGISTRY,
        now: () => new Date('2026-08-25T05:00:00.000Z')
      });

      const pollResult = await runApiFootballIngestionJob({
        dataRoot: tempDir,
        mode: 'window_poll',
        client,
        registry: SAMPLE_REGISTRY,
        now: () => new Date('2026-08-25T16:35:00.000Z')
      });

      expect(pollResult.status).toBe('not_modified');
      expect(pollResult.matchesProcessed).toBe(1);
      expect(pollResult.matchesCompleted).toBe(0);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('skips before network when the durable normal quota is exhausted', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-ingest-durable-quota-'));

    try {
      const ledger = new ApiFootballUsageLedger({ dataRoot: tempDir, hardCeiling: 1 });
      await ledger.reserveSlot();
      const mockFetch = vi.fn();
      const client = new ApiFootballClient({
        apiKey: 'test-api-key',
        fetchFn: mockFetch as unknown as typeof fetch,
        ledger
      });

      const result = await runApiFootballIngestionJob({
        dataRoot: tempDir,
        mode: 'daily_sync',
        date: '2026-08-25',
        client,
        registry: SAMPLE_REGISTRY,
        now: () => new Date('2026-08-25T05:00:00.000Z')
      });

      expect(result.status).toBe('skipped');
      expect(result.quotaUsedToday).toBe(1);
      expect(mockFetch).not.toHaveBeenCalled();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('preserves historical matches when running daily sync', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-ingest-preserve-history-'));
    const { runApiFootballHydrationJob } = await import('./api-football-hydration-job.js');
    const { readServingMatchStoreSnapshot } = await import('../../../api/src/repositories/serving-match-store.js');

    try {
      let mockCount = 0;
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        mockCount++;
        if (url.includes('season=')) {
          // Hydration response for 2025
          return {
            ok: true,
            status: 200,
            json: async () => ({
              get: 'fixtures',
              parameters: { league: '99998', season: '2025' },
              errors: [],
              results: 1,
              response: [
                {
                  ...MOCK_FIXTURE_FINISHED,
                  fixture: { ...MOCK_FIXTURE_FINISHED.fixture, id: 9001 },
                  league: { ...MOCK_FIXTURE_FINISHED.league, season: 2025 }
                }
              ]
            })
          };
        } else {
          // Daily sync response for 2026-08-25
          return {
            ok: true,
            status: 200,
            json: async () => ({
              get: 'fixtures',
              parameters: { date: '2026-08-25' },
              errors: [],
              results: 1,
              response: [MOCK_FIXTURE_SCHEDULED]
            })
          };
        }
      });

      const client = new ApiFootballClient({
        apiKey: 'test-api-key',
        fetchFn: mockFetch as unknown as typeof fetch,
        dataRoot: tempDir
      });

      // 1. Initial hydration: season 2025
      await runApiFootballHydrationJob({
        dataRoot: tempDir,
        client,
        registry: [
          {
            ...SAMPLE_REGISTRY[0]!,
            currentSeason: 2025,
            historicalSeasons: []
          }
        ]
      });

      const snapAfterHydration = await readServingMatchStoreSnapshot(join(tempDir, 'serving'));
      expect(snapAfterHydration.matches).toHaveLength(1);
      expect(snapAfterHydration.matches[0]?.competition.season).toBe('2025');

      // 2. Daily sync for date 2026-08-25
      const syncResult = await runApiFootballIngestionJob({
        dataRoot: tempDir,
        mode: 'daily_sync',
        date: '2026-08-25',
        client,
        registry: SAMPLE_REGISTRY,
        now: () => new Date('2026-08-25T05:00:00.000Z')
      });

      expect(syncResult.status).toBe('synced');

      // CRITICAL CHECK: Final serving store MUST retain both 2025 historical match and 2026 scheduled match
      const snapAfterDailySync = await readServingMatchStoreSnapshot(join(tempDir, 'serving'));
      expect(snapAfterDailySync.matches).toHaveLength(2);
      expect(snapAfterDailySync.matches.map((m) => m.competition.season).sort()).toEqual(['2025', '2026']);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }, 20_000);
});
