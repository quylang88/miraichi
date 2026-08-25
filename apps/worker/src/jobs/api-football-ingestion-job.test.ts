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

const SAMPLE_REGISTRY: readonly ApiFootballCompetitionEntry[] = [
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
    id: 39,
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

describe('computeConcludingWindows', () => {
  it('computes concluding window range [T+88m, T+115m] for scheduled matches', () => {
    const windows = computeConcludingWindows([
      { matchId: 'match-eng-premier-league-2026-1001', kickoffUtc: '2026-08-25T15:00:00.000Z', status: 'scheduled' },
      { matchId: 'match-eng-premier-league-2026-1002', kickoffUtc: '2026-08-25T15:00:00.000Z', status: 'completed' }
    ]);

    expect(windows).toHaveLength(1);
    expect(windows[0]?.providerFixtureId).toBe(1001);
    expect(windows[0]?.windowStartUtc).toBe('2026-08-25T16:28:00.000Z'); // 15:00 + 88m = 16:28
    expect(windows[0]?.windowEndUtc).toBe('2026-08-25T16:55:00.000Z');   // 15:00 + 115m = 16:55
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

      const client = new ApiFootballClient({ fetchFn: mockFetch as unknown as typeof fetch });
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

      const client = new ApiFootballClient({ fetchFn: mockFetch as unknown as typeof fetch });

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
});
