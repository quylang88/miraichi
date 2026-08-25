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
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async (): Promise<ApiFootballApiResponse<ApiFootballFixtureItem>> => ({
          get: 'fixtures',
          parameters: { league: '39', season: '2026' },
          errors: [],
          results: 1,
          response: [MOCK_FIXTURE]
        })
      });

      const client = new ApiFootballClient({ fetchFn: mockFetch as unknown as typeof fetch });
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

      const client = new ApiFootballClient();
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
});
