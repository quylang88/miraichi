import { describe, expect, it, vi } from 'vitest';
import { runApiFootballHydrationJob } from './api-football-hydration-job.js';
import { ApiFootballClient, type ApiFootballApiResponse, type ApiFootballFixtureItem } from '../sources/api-football/api-football-client.js';
import { HydrationCheckpointManager } from '../sources/api-football/hydration-checkpoint-manager.js';
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
    historicalSeasons: [2025],
    sourceTimezone: 'Europe/London',
    enabled: true
  }
];

const MOCK_FIXTURE: ApiFootballFixtureItem = {
  fixture: {
    id: 1001,
    referee: 'Michael Oliver',
    timezone: 'UTC',
    date: '2026-08-25T19:00:00+00:00',
    timestamp: 1787684400,
    status: { long: 'Match Finished', short: 'FT', elapsed: 90 }
  },
  league: {
    id: 39,
    name: 'Premier League',
    country: 'England',
    season: 2026,
    round: 'Regular Season - 1'
  },
  teams: {
    home: { id: 33, name: 'Arsenal', winner: true },
    away: { id: 40, name: 'Chelsea', winner: false }
  },
  goals: { home: 3, away: 0 },
  score: {
    halftime: { home: 1, away: 0 },
    fulltime: { home: 3, away: 0 },
    extratime: { home: null, away: null },
    penalty: { home: null, away: null }
  }
};

describe('runApiFootballHydrationJob', () => {
  it('hydrates all pending seasons and builds serving store', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-hydration-test-'));

    try {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        const season = Number(new URL(url).searchParams.get('season'));
        return {
          ok: true,
          status: 200,
          json: async (): Promise<ApiFootballApiResponse<ApiFootballFixtureItem>> => ({
            get: 'fixtures',
            parameters: { league: '39', season: String(season) },
            errors: [],
            results: 1,
            response: [{ ...MOCK_FIXTURE, league: { ...MOCK_FIXTURE.league, season } }]
          })
        };
      });

      const client = new ApiFootballClient({
        apiKey: 'test-api-key',
        fetchFn: mockFetch as unknown as typeof fetch,
        dataRoot: tempDir
      });
      const checkpointManager = new HydrationCheckpointManager();

      const result = await runApiFootballHydrationJob({
        dataRoot: tempDir,
        client,
        checkpointManager,
        registry: SAMPLE_REGISTRY,
        now: () => new Date('2026-08-25T12:00:00.000Z')
      });

      expect(result.status).toBe('completed');
      expect(result.seasonsHydrated).toBe(2); // 2025 and 2026
      expect(result.matchesHydrated).toBe(2);
      expect(result.pendingCount).toBe(0);
      expect(checkpointManager.isHydrated(39, 2025)).toBe(true);
      expect(checkpointManager.isHydrated(39, 2026)).toBe(true);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('skips when all seasons are already hydrated', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-hydration-test-'));

    try {
      const checkpointManager = new HydrationCheckpointManager();
      await checkpointManager.markCompleted('eng-premier-league', 39, 2025, 380);
      await checkpointManager.markCompleted('eng-premier-league', 39, 2026, 380);

      const client = new ApiFootballClient({ apiKey: 'test-api-key', dataRoot: tempDir });
      const result = await runApiFootballHydrationJob({
        dataRoot: tempDir,
        client,
        checkpointManager,
        registry: SAMPLE_REGISTRY
      });

      expect(result.status).toBe('skipped');
      expect(result.seasonsHydrated).toBe(0);
      expect(result.pendingCount).toBe(0);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('preserves both targets across two separate 1-target hydration runs', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-hydration-test-'));
    const { readServingMatchStoreSnapshot } = await import('../../../api/src/repositories/serving-match-store.js');

    try {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        const season = Number(new URL(url).searchParams.get('season'));
        return {
          ok: true,
          status: 200,
          json: async (): Promise<ApiFootballApiResponse<ApiFootballFixtureItem>> => ({
            get: 'fixtures',
            parameters: { league: '39', season: String(season) },
            errors: [],
            results: 1,
            response: [
              {
                ...MOCK_FIXTURE,
                fixture: { ...MOCK_FIXTURE.fixture, id: 1000 + season },
                league: { ...MOCK_FIXTURE.league, season }
              }
            ]
          })
        };
      });

      const client = new ApiFootballClient({
        apiKey: 'test-api-key',
        fetchFn: mockFetch as unknown as typeof fetch,
        dataRoot: tempDir
      });
      const checkpointManager = new HydrationCheckpointManager({
        storagePath: join(tempDir, 'hydration-checkpoints.json')
      });

      // Run 1: Hydrate only 1 batch (e.g. season 2025)
      const res1 = await runApiFootballHydrationJob({
        dataRoot: tempDir,
        client,
        checkpointManager,
        registry: SAMPLE_REGISTRY,
        maxBatchesPerRun: 1,
        now: () => new Date('2026-08-25T12:00:00.000Z')
      });

      expect(res1.seasonsHydrated).toBe(1);
      const servingSnap1 = await readServingMatchStoreSnapshot(join(tempDir, 'serving'));
      expect(servingSnap1.matches).toHaveLength(1);

      // Run 2: Hydrate next batch (season 2026)
      const res2 = await runApiFootballHydrationJob({
        dataRoot: tempDir,
        client,
        checkpointManager,
        registry: SAMPLE_REGISTRY,
        maxBatchesPerRun: 1,
        now: () => new Date('2026-08-25T12:01:00.000Z')
      });

      expect(res2.seasonsHydrated).toBe(1);

      // CRITICAL CHECK: Final serving store snapshot MUST contain BOTH seasons (2 matches), NOT just the 2nd!
      const servingSnap2 = await readServingMatchStoreSnapshot(join(tempDir, 'serving'));
      expect(servingSnap2.matches).toHaveLength(2);
      expect(servingSnap2.matches.map((m) => m.competition.season).sort()).toEqual(['2025', '2026']);
      expect(checkpointManager.isHydrated(39, 2025)).toBe(true);
      expect(checkpointManager.isHydrated(39, 2026)).toBe(true);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('leaves prior serving manifest and checkpoint unchanged when publication fails', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-hydration-test-'));
    const { readServingMatchStoreSnapshot, readServingMatchStoreManifest } = await import('../../../api/src/repositories/serving-match-store.js');

    try {
      let callCount = 0;
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        callCount++;
        const season = Number(new URL(url).searchParams.get('season'));
        // For 2nd call, return invalid fixture that fails validation / causes publish error
        if (callCount === 2) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              get: 'fixtures',
              parameters: { league: '39', season: String(season) },
              errors: [],
              results: 1,
              response: [
                {
                  ...MOCK_FIXTURE,
                  fixture: {
                    ...MOCK_FIXTURE.fixture,
                    status: { long: 'Finished', short: 'FT', elapsed: 90 }
                  },
                  goals: { home: null, away: null },
                  score: { halftime: { home: null, away: null }, fulltime: { home: null, away: null }, extratime: { home: null, away: null }, penalty: { home: null, away: null } }
                  // Completed match with missing scores -> publication validation will fail!
                }
              ]
            })
          };
        }
        return {
          ok: true,
          status: 200,
          json: async (): Promise<ApiFootballApiResponse<ApiFootballFixtureItem>> => ({
            get: 'fixtures',
            parameters: { league: '39', season: String(season) },
            errors: [],
            results: 1,
            response: [{ ...MOCK_FIXTURE, league: { ...MOCK_FIXTURE.league, season } }]
          })
        };
      });

      const client = new ApiFootballClient({
        apiKey: 'test-api-key',
        fetchFn: mockFetch as unknown as typeof fetch,
        dataRoot: tempDir
      });
      const checkpointManager = new HydrationCheckpointManager({
        storagePath: join(tempDir, 'hydration-checkpoints.json')
      });

      // Run 1: Succeeds
      await runApiFootballHydrationJob({
        dataRoot: tempDir,
        client,
        checkpointManager,
        registry: SAMPLE_REGISTRY,
        maxBatchesPerRun: 1,
        now: () => new Date('2026-08-25T12:00:00.000Z')
      });

      const manifestBefore = await readServingMatchStoreManifest(join(tempDir, 'serving'));
      expect(checkpointManager.isHydrated(39, 2025)).toBe(true);
      expect(checkpointManager.isHydrated(39, 2026)).toBe(false);

      // Run 2: Fails during publication validation
      await expect(
        runApiFootballHydrationJob({
          dataRoot: tempDir,
          client,
          checkpointManager,
          registry: SAMPLE_REGISTRY,
          maxBatchesPerRun: 1,
          now: () => new Date('2026-08-25T12:01:00.000Z')
        })
      ).rejects.toThrow();

      // Manifest and checkpoint for 2026 must remain uncompleted / unchanged
      const manifestAfter = await readServingMatchStoreManifest(join(tempDir, 'serving'));
      expect(manifestAfter.currentVersion).toBe(manifestBefore.currentVersion);
      expect(checkpointManager.isHydrated(39, 2026)).toBe(false);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }, 20_000);

  it('fails closed when checkpoint file is corrupt and does not restart from 0', async () => {
    const { writeFile } = await import('node:fs/promises');
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-hydration-test-'));
    const checkpointStoragePath = join(tempDir, 'hydration-checkpoints.json');

    try {
      await writeFile(checkpointStoragePath, 'CORRUPT_JSON', 'utf8');

      const client = new ApiFootballClient({ apiKey: 'test-api-key', dataRoot: tempDir });
      await expect(
        runApiFootballHydrationJob({
          dataRoot: tempDir,
          client,
          registry: SAMPLE_REGISTRY
        })
      ).rejects.toThrow('hydration_checkpoint_corrupt');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('does not complete a hydration target when every provider fixture is rejected by the adapter', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-hydration-invalid-adapter-'));

    try {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          get: 'fixtures',
          parameters: { league: '39', season: '2025' },
          errors: [],
          results: 1,
          response: [{
            ...MOCK_FIXTURE,
            league: { ...MOCK_FIXTURE.league, season: 2025 },
            teams: {
              ...MOCK_FIXTURE.teams,
              home: { ...MOCK_FIXTURE.teams.home, name: '' }
            }
          }]
        })
      });
      const client = new ApiFootballClient({
        apiKey: 'test-api-key',
        fetchFn: mockFetch as unknown as typeof fetch,
        dataRoot: tempDir
      });
      const checkpointManager = new HydrationCheckpointManager({
        storagePath: join(tempDir, 'hydration-checkpoints.json')
      });

      const result = await runApiFootballHydrationJob({
        dataRoot: tempDir,
        client,
        checkpointManager,
        registry: SAMPLE_REGISTRY,
        maxBatchesPerRun: 1,
        now: () => new Date('2026-08-25T12:00:00.000Z')
      });

      expect(result.seasonsHydrated).toBe(0);
      expect(checkpointManager.isHydrated(39, 2025)).toBe(false);
      expect(checkpointManager.getRecord(39, 2025)?.status).toBe('failed');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
