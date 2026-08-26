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
    historicalSeasons: [2025, 2024],
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
    historicalSeasons: [2025, 2024],
    sourceTimezone: 'Europe/Madrid',
    enabled: true
  }
];

function createMockFixture(
  id: number,
  leagueId: number,
  season: number,
  homeId: number,
  awayId: number,
  status = 'FT',
  dateStr = `${season}-10-15T15:00:00+00:00`
): ApiFootballFixtureItem {
  return {
    fixture: {
      id,
      referee: 'Referee A',
      timezone: 'UTC',
      date: dateStr,
      timestamp: Math.floor(Date.parse(dateStr) / 1000),
      status: { long: status === 'FT' ? 'Match Finished' : 'Second Half', short: status, elapsed: 90 }
    },
    league: { id: leagueId, name: `League ${leagueId}`, country: 'Country', season, round: 'Regular Season - 1' },
    teams: {
      home: { id: homeId, name: `Team ${homeId}`, winner: status === 'FT' ? true : null },
      away: { id: awayId, name: `Team ${awayId}`, winner: status === 'FT' ? false : null }
    },
    goals: { home: status === 'FT' ? 2 : 1, away: status === 'FT' ? 1 : 1 },
    score: {
      halftime: { home: 1, away: 0 },
      fulltime: { home: status === 'FT' ? 2 : null, away: status === 'FT' ? 1 : null },
      extratime: { home: null, away: null },
      penalty: { home: null, away: null }
    }
  };
}

describe('API-Football Quota, Resume, and Batching Integration', () => {
  it('resumes multi-season hydration across process restarts and preserves union of snapshots', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-hydration-resume-'));

    try {
      const requestedTargets: Array<{ league: number; season: number }> = [];

      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        const parsedUrl = new URL(url);
        const league = Number(parsedUrl.searchParams.get('league') || 39);
        const season = Number(parsedUrl.searchParams.get('season') || 2026);
        requestedTargets.push({ league, season });

        return {
          ok: true,
          status: 200,
          json: async (): Promise<ApiFootballApiResponse<ApiFootballFixtureItem>> => ({
            get: 'fixtures',
            parameters: {},
            errors: [],
            results: 1,
            response: [createMockFixture(league * 10000 + season, league, season, league * 10 + 1, league * 10 + 2)]
          })
        };
      });

      // --- RUN 1: Hydrate first 2 targets only (layer 1: current seasons for 39 and 140) ---
      const client1 = new ApiFootballClient({
        apiKey: 'test-api-key',
        fetchFn: mockFetch as unknown as typeof fetch,
        dataRoot: tempDir,
        sleepFn: async () => {}
      });
      const checkpointManager1 = new HydrationCheckpointManager({
        storagePath: join(tempDir, 'hydration-checkpoints.json')
      });

      const run1Result = await runApiFootballHydrationJob({
        dataRoot: tempDir,
        client: client1,
        checkpointManager: checkpointManager1,
        registry: TEST_COMPETITIONS,
        maxBatchesPerRun: 2,
        now: () => new Date('2026-08-26T04:00:00.000Z')
      });

      expect(run1Result.status).toBe('partial');
      expect(run1Result.seasonsHydrated).toBe(2);
      expect(checkpointManager1.isHydrated(39, 2026)).toBe(true);
      expect(checkpointManager1.isHydrated(140, 2026)).toBe(true);
      expect(checkpointManager1.isHydrated(39, 2025)).toBe(false);

      // Verify serving store after Run 1 has 2 matches
      const repo1 = new ServingMatchStoreRepository({ servingRoot: join(tempDir, 'serving') });
      const snap1 = await repo1.listMatches();
      expect(snap1.matches).toHaveLength(2);
      const firstRunIds = new Map(snap1.matches.map((match) => [
        `${match.competition.id}:${match.competition.season}`,
        match.id
      ]));

      // --- RUN 2: Restart with fresh process/client instances on same dataRoot ---
      const client2 = new ApiFootballClient({
        apiKey: 'test-api-key',
        fetchFn: mockFetch as unknown as typeof fetch,
        dataRoot: tempDir,
        sleepFn: async () => {}
      });
      const checkpointManager2 = new HydrationCheckpointManager({
        storagePath: join(tempDir, 'hydration-checkpoints.json')
      });

      // Reset target tracker to verify only remaining targets are requested
      requestedTargets.length = 0;

      const run2Result = await runApiFootballHydrationJob({
        dataRoot: tempDir,
        client: client2,
        checkpointManager: checkpointManager2,
        registry: TEST_COMPETITIONS,
        maxBatchesPerRun: 2,
        now: () => new Date('2026-08-26T04:05:00.000Z')
      });

      expect(run2Result.status).toBe('partial');
      expect(run2Result.seasonsHydrated).toBe(2);

      // Verify that season 2026 was NOT re-requested
      expect(requestedTargets).toEqual([
        { league: 39, season: 2025 },
        { league: 140, season: 2025 }
      ]);

      const repo2 = new ServingMatchStoreRepository({ servingRoot: join(tempDir, 'serving') });
      const snap2 = await repo2.listMatches();
      expect(snap2.matches).toHaveLength(4);

      // --- RUN 3: Restart again and complete only the oldest season layer ---
      const client3 = new ApiFootballClient({
        apiKey: 'test-api-key',
        fetchFn: mockFetch as unknown as typeof fetch,
        dataRoot: tempDir,
        sleepFn: async () => {}
      });
      const checkpointManager3 = new HydrationCheckpointManager({
        storagePath: join(tempDir, 'hydration-checkpoints.json')
      });
      requestedTargets.length = 0;

      const run3Result = await runApiFootballHydrationJob({
        dataRoot: tempDir,
        client: client3,
        checkpointManager: checkpointManager3,
        registry: TEST_COMPETITIONS,
        maxBatchesPerRun: 2,
        now: () => new Date('2026-08-26T04:10:00.000Z')
      });

      expect(run3Result.status).toBe('completed');
      expect(run3Result.seasonsHydrated).toBe(2);
      expect(requestedTargets).toEqual([
        { league: 39, season: 2024 },
        { league: 140, season: 2024 }
      ]);

      // All checkpoints should now be marked hydrated
      expect(checkpointManager3.isHydrated(39, 2026)).toBe(true);
      expect(checkpointManager3.isHydrated(140, 2026)).toBe(true);
      expect(checkpointManager3.isHydrated(39, 2025)).toBe(true);
      expect(checkpointManager3.isHydrated(140, 2025)).toBe(true);
      expect(checkpointManager3.isHydrated(39, 2024)).toBe(true);
      expect(checkpointManager3.isHydrated(140, 2024)).toBe(true);

      // Verify final serving store contains all 6 matches (union preserved!)
      const repo3 = new ServingMatchStoreRepository({ servingRoot: join(tempDir, 'serving') });
      const snap3 = await repo3.listMatches();
      expect(snap3.matches).toHaveLength(6);
      for (const [target, matchId] of firstRunIds) {
        expect(snap3.matches.find((match) => `${match.competition.id}:${match.competition.season}` === target)?.id)
          .toBe(matchId);
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }, 25_000);

  it('persists the successful owner-date daily sync across a fresh client restart', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-daily-sync-restart-'));
    const ownerNow = () => new Date('2026-08-26T05:00:00.000Z');

    try {
      const scheduled = createMockFixture(7001, 39, 2026, 701, 702, 'NS', '2026-08-26T20:00:00+00:00');
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async (): Promise<ApiFootballApiResponse<ApiFootballFixtureItem>> => ({
          get: 'fixtures',
          parameters: { date: '2026-08-26' },
          errors: [],
          results: 1,
          response: [scheduled]
        })
      });
      const client1 = new ApiFootballClient({
        apiKey: 'test-api-key',
        fetchFn: mockFetch as unknown as typeof fetch,
        dataRoot: tempDir,
        now: ownerNow,
        sleepFn: async () => {}
      });

      const first = await runApiFootballIngestionJob({
        dataRoot: tempDir,
        mode: 'auto',
        client: client1,
        registry: TEST_COMPETITIONS,
        now: ownerNow
      });
      expect(first.status).toBe('synced');

      const client2 = new ApiFootballClient({
        apiKey: 'test-api-key',
        fetchFn: mockFetch as unknown as typeof fetch,
        dataRoot: tempDir,
        now: ownerNow,
        sleepFn: async () => {}
      });
      const second = await runApiFootballIngestionJob({
        dataRoot: tempDir,
        mode: 'auto',
        client: client2,
        registry: TEST_COMPETITIONS,
        now: ownerNow
      });

      expect(second.status).toBe('skipped');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect((await client2.ledger.getState(ownerNow())).lastSuccessfulDailySyncDate).toBe('2026-08-26');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }, 15_000);

  it('shares durable quota ledger across client instances and enforces 85 ceiling', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-quota-ceiling-'));

    try {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async (): Promise<ApiFootballApiResponse<ApiFootballFixtureItem>> => ({
          get: 'fixtures',
          parameters: {},
          errors: [],
          results: 0,
          response: []
        })
      });

      const clientA = new ApiFootballClient({
        apiKey: 'test-api-key',
        fetchFn: mockFetch as unknown as typeof fetch,
        dataRoot: tempDir,
        sleepFn: async () => {}
      });

      // Make 5 requests on clientA
      for (let i = 0; i < 5; i++) {
        await clientA.fetchFixturesByDate('2026-08-26', { timezone: 'Europe/London' });
      }

      const stateA = await clientA.ledger.getState();
      expect(stateA.dailyUsage.reserved).toBe(5);

      // Create clientB on same dataRoot - it should read 5 used
      const clientB = new ApiFootballClient({
        apiKey: 'test-api-key',
        fetchFn: mockFetch as unknown as typeof fetch,
        dataRoot: tempDir,
        sleepFn: async () => {}
      });

      const stateB = await clientB.ledger.getState();
      expect(stateB.dailyUsage.reserved).toBe(5);

      // Reconcile header to 85 used (limit 100, remaining 15)
      await clientB.ledger.reconcileHeaders({
        'x-ratelimit-requests-limit': '100',
        'x-ratelimit-requests-remaining': '15'
      });

      const stateMax = await clientB.ledger.getState();
      expect(stateMax.dailyUsage.reserved).toBe(85);

      // 86th request attempt throws ApiFootballQuotaExceededError
      await expect(clientB.fetchFixturesByDate('2026-08-26', { timezone: 'Europe/London' })).rejects.toThrow();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }, 15_000);

  it('chunks 21 due fixtures into batches of at most 20 IDs during window polling', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-chunking-'));

    try {
      // 21 live fixtures scheduled for today at 15:00 UTC
      const liveFixtures: ApiFootballFixtureItem[] = [];
      const ftFixtures: Record<number, ApiFootballFixtureItem> = {};

      for (let i = 1; i <= 21; i++) {
        const fixtureId = 2000 + i;
        const live = createMockFixture(fixtureId, 39, 2026, 100 + i, 200 + i, '2H', '2026-08-26T15:00:00+00:00');
        liveFixtures.push(live);

        const ft = createMockFixture(fixtureId, 39, 2026, 100 + i, 200 + i, 'FT', '2026-08-26T15:00:00+00:00');
        ftFixtures[fixtureId] = ft;
      }
      const unrelatedScheduledFixture = createMockFixture(
        9999,
        39,
        2026,
        999,
        1000,
        'NS',
        '2026-08-26T23:00:00+00:00'
      );

      const requestedIdsBatches: string[] = [];

      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        const parsedUrl = new URL(url);
        const idsParam = parsedUrl.searchParams.get('ids');

        if (idsParam) {
          requestedIdsBatches.push(idsParam);
          const requestedIds = idsParam.split('-').map(Number);
          const response = requestedIds.map(id => ftFixtures[id]!).filter(Boolean);
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
        }

        if (url.includes('date=2026-08-26')) {
          return {
            ok: true,
            status: 200,
            json: async (): Promise<ApiFootballApiResponse<ApiFootballFixtureItem>> => ({
              get: 'fixtures',
              parameters: {},
              errors: [],
              results: liveFixtures.length + 1,
              response: [...liveFixtures, unrelatedScheduledFixture]
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

      // 1. Daily sync at 05:00 UTC
      await runApiFootballIngestionJob({
        dataRoot: tempDir,
        mode: 'daily_sync',
        date: '2026-08-26',
        client,
        registry: TEST_COMPETITIONS,
        now: () => new Date('2026-08-26T05:00:00.000Z')
      });

      // 2. Poll due fixtures at 16:45 UTC (kickoff is 15:00 -> +105 min due)
      const pollResult = await runApiFootballIngestionJob({
        dataRoot: tempDir,
        mode: 'window_poll',
        client,
        registry: TEST_COMPETITIONS,
        now: () => new Date('2026-08-26T16:45:00.000Z')
      });

      expect(pollResult.status).toBe('published');
      expect(pollResult.matchesCompleted).toBe(21);

      // Verify that requests were chunked into exactly 2 requests: batch of 20 and batch of 1
      expect(requestedIdsBatches).toHaveLength(2);
      const batch1Ids = requestedIdsBatches[0]!.split('-');
      const batch2Ids = requestedIdsBatches[1]!.split('-');
      expect(batch1Ids).toHaveLength(20);
      expect(batch2Ids).toHaveLength(1);
      expect(requestedIdsBatches.join('-')).not.toContain('9999');

      // The 21 due matches complete without evicting the unrelated future fixture.
      const repo = new ServingMatchStoreRepository({ servingRoot: join(tempDir, 'serving') });
      const snap = await repo.listMatches();
      expect(snap.matches).toHaveLength(22);
      expect(snap.matches.filter((match) => match.status === 'completed')).toHaveLength(21);
      const unrelated = snap.matches.find((match) => match.homeTeam.name === 'Team 999');
      expect(unrelated?.status).toBe('scheduled');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }, 20_000);

  it('enforces rolling rate limiter pacing via sleepFn for rapid requests', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-rate-limiter-'));

    try {
      let simulatedTime = 1756200000000; // base epoch ms
      const sleepTimes: number[] = [];
      const sleepFn = vi.fn().mockImplementation(async (ms: number) => {
        sleepTimes.push(ms);
        simulatedTime += ms;
      });

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async (): Promise<ApiFootballApiResponse<ApiFootballFixtureItem>> => ({
          get: 'fixtures',
          parameters: {},
          errors: [],
          results: 0,
          response: []
        })
      });

      const client = new ApiFootballClient({
        apiKey: 'test-api-key',
        fetchFn: mockFetch as unknown as typeof fetch,
        dataRoot: tempDir,
        now: () => new Date(simulatedTime),
        sleepFn
      });

      // Make 10 requests immediately within the same second
      for (let i = 0; i < 10; i++) {
        await client.fetchFixturesByDate('2026-08-26', { timezone: 'Europe/London' });
        simulatedTime += 100;
      }

      expect(sleepFn).not.toHaveBeenCalled();

      // 11th request must trigger sleep to pace within 60s rolling window
      await client.fetchFixturesByDate('2026-08-26', { timezone: 'Europe/London' });
      expect(sleepFn).toHaveBeenCalledTimes(1);
      expect(sleepTimes[0]).toBeGreaterThan(0);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }, 15_000);
});
