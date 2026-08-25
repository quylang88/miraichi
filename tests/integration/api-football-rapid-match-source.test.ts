import { describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runApiFootballHydrationJob } from '../../apps/worker/src/jobs/api-football-hydration-job.js';
import { runApiFootballIngestionJob } from '../../apps/worker/src/jobs/api-football-ingestion-job.js';
import { ApiFootballClient, type ApiFootballApiResponse, type ApiFootballFixtureItem } from '../../apps/worker/src/sources/api-football/api-football-client.js';
import { HydrationCheckpointManager } from '../../apps/worker/src/sources/api-football/hydration-checkpoint-manager.js';
import { ServingMatchStoreRepository } from '../../apps/api/src/repositories/serving-match-store-repository.js';
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
  },
  {
    entryId: 'api-football-esp-la-liga',
    sourceId: 'api-football',
    competitionId: 'esp-la-liga',
    competitionName: 'La Liga',
    country: 'Spain',
    category: 'top5_europe',
    competitionType: 'club',
    providerLeagueId: 140,
    currentSeason: 2026,
    historicalSeasons: [2025],
    sourceTimezone: 'Europe/Madrid',
    enabled: true
  }
];

const MOCK_FIXTURE_EPL_PAST: ApiFootballFixtureItem = {
  fixture: {
    id: 1001,
    referee: 'Michael Oliver',
    timezone: 'UTC',
    date: '2025-11-15T15:00:00+00:00',
    timestamp: 1763218800,
    status: { long: 'Match Finished', short: 'FT', elapsed: 90 }
  },
  league: { id: 39, name: 'Premier League', country: 'England', season: 2025, round: 'Regular Season - 12' },
  teams: { home: { id: 33, name: 'Manchester United', winner: true }, away: { id: 40, name: 'Liverpool', winner: false } },
  goals: { home: 2, away: 1 },
  score: {
    halftime: { home: 1, away: 0 },
    fulltime: { home: 2, away: 1 },
    extratime: { home: null, away: null },
    penalty: { home: null, away: null }
  }
};

const MOCK_FIXTURE_TODAY_LIVE: ApiFootballFixtureItem = {
  fixture: {
    id: 2001,
    referee: 'Anthony Taylor',
    timezone: 'UTC',
    date: '2026-08-25T15:00:00+00:00',
    timestamp: 1787670000,
    status: { long: 'Second Half', short: '2H', elapsed: 89 }
  },
  league: { id: 39, name: 'Premier League', country: 'England', season: 2026, round: 'Regular Season - 1' },
  teams: { home: { id: 42, name: 'Arsenal', winner: null }, away: { id: 49, name: 'Chelsea', winner: null } },
  goals: { home: 1, away: 1 },
  score: {
    halftime: { home: 1, away: 0 },
    fulltime: { home: null, away: null },
    extratime: { home: null, away: null },
    penalty: { home: null, away: null }
  }
};

const MOCK_FIXTURE_TODAY_FT: ApiFootballFixtureItem = {
  ...MOCK_FIXTURE_TODAY_LIVE,
  fixture: {
    ...MOCK_FIXTURE_TODAY_LIVE.fixture,
    status: { long: 'Match Finished', short: 'FT', elapsed: 90 }
  },
  goals: { home: 2, away: 1 },
  score: {
    halftime: { home: 1, away: 0 },
    fulltime: { home: 2, away: 1 },
    extratime: { home: null, away: null },
    penalty: { home: null, away: null }
  }
};

describe('API-Football Rapid Match Source End-to-End Integration', () => {
  it('executes multi-season historical hydration, daily sync, smart window polling, and API serving', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-api-football-e2e-'));

    try {
      let callCount = 0;
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        callCount += 1;
        const parsedUrl = new URL(url);
        const leagueParam = parsedUrl.searchParams.get('league');
        const seasonParam = parsedUrl.searchParams.get('season');
        if (seasonParam) {
          const parsedLeague = leagueParam ? Number(leagueParam) : 39;
          const parsedSeason = Number(seasonParam);
          return {
            ok: true,
            status: 200,
            json: async (): Promise<ApiFootballApiResponse<ApiFootballFixtureItem>> => ({
              get: 'fixtures',
              parameters: {},
              errors: [],
              results: 1,
              response: [
                {
                  ...MOCK_FIXTURE_EPL_PAST,
                  fixture: { ...MOCK_FIXTURE_EPL_PAST.fixture, id: parsedLeague * 10000 + parsedSeason },
                  league: { ...MOCK_FIXTURE_EPL_PAST.league, id: parsedLeague, season: parsedSeason }
                }
              ]
            })
          };
        } else if (url.includes('date=2026-08-25')) {
          return {
            ok: true,
            status: 200,
            json: async (): Promise<ApiFootballApiResponse<ApiFootballFixtureItem>> => ({
              get: 'fixtures',
              parameters: {},
              errors: [],
              results: 1,
              response: [MOCK_FIXTURE_TODAY_LIVE]
            })
          };
        } else if (url.includes('ids=2001')) {
          return {
            ok: true,
            status: 200,
            json: async (): Promise<ApiFootballApiResponse<ApiFootballFixtureItem>> => ({
              get: 'fixtures',
              parameters: {},
              errors: [],
              results: 1,
              response: [MOCK_FIXTURE_TODAY_FT]
            })
          };
        } else {
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
        }
      });

      const client = new ApiFootballClient({
        apiKey: 'test-api-key',
        fetchFn: mockFetch as unknown as typeof fetch,
        dataRoot: tempDir,
        sleepFn: async () => {}
      });
      const checkpointManager = new HydrationCheckpointManager({
        storagePath: join(tempDir, 'hydration-checkpoints.json')
      });

      // 1. Run Historical Hydration
      const hydrationResult = await runApiFootballHydrationJob({
        dataRoot: tempDir,
        client,
        checkpointManager,
        registry: TEST_COMPETITIONS,
        now: () => new Date('2026-08-25T04:00:00.000Z')
      });

      expect(hydrationResult.status).toBe('completed');
      expect(checkpointManager.isHydrated(39, 2025)).toBe(true);

      // 2. Run Daily Sync at 05:00 UTC
      const dailySyncResult = await runApiFootballIngestionJob({
        dataRoot: tempDir,
        mode: 'daily_sync',
        date: '2026-08-25',
        client,
        registry: TEST_COMPETITIONS,
        now: () => new Date('2026-08-25T05:00:00.000Z')
      });

      expect(dailySyncResult.status).toBe('synced');
      expect(dailySyncResult.matchesProcessed).toBe(1);

      // 3. Fast Poll when match is finishing at 16:35 UTC (95 min into 15:00 kickoff)
      const pollResult = await runApiFootballIngestionJob({
        dataRoot: tempDir,
        mode: 'window_poll',
        client,
        registry: TEST_COMPETITIONS,
        now: () => new Date('2026-08-25T16:35:00.000Z')
      });

      expect(pollResult.status).toBe('published');
      expect(pollResult.matchesCompleted).toBe(1);

      // 4. Verify API Repository Reads the Updated FT Score
      const repository = new ServingMatchStoreRepository({
        servingRoot: join(tempDir, 'serving')
      });

      const apiResult = await repository.listMatches({
        date: '2026-08-25'
      });

      expect(apiResult.matches).toHaveLength(1);
      const match = apiResult.matches[0]!;
      expect(match.status).toBe('completed');
      expect(match.score.home).toBe(2);
      expect(match.score.away).toBe(1);
      expect(match.homeTeam.name).toBe('Arsenal');
      expect(match.awayTeam.name).toBe('Chelsea');
      expect(match.sourceRefs[0]?.sourceId).toBe('api-football');

      // Verify quota usage remains strictly within bounds
      expect((await client.ledger.getState()).dailyUsage.reserved).toBeLessThanOrEqual(85);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }, 20_000);
});
