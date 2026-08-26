import { describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  getSeedHistoryCliExitCode,
  parseSeedHistoryArgs,
  runSeedApiFootballHistoryCli
} from './seed-api-football-history.js';
import { ApiFootballClient, type ApiFootballApiResponse, type ApiFootballFixtureItem } from '../apps/worker/src/sources/api-football/api-football-client.js';
import { ApiFootballUsageLedger } from '../apps/worker/src/sources/api-football/api-football-usage-ledger.js';
import type { ApiFootballCompetitionEntry } from '../packages/config/src/index.js';

const SAMPLE_CLI_REGISTRY: readonly ApiFootballCompetitionEntry[] = [
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

describe('parseSeedHistoryArgs', () => {
  it('parses valid CLI options with default values', () => {
    const parsed = parseSeedHistoryArgs([]);
    expect(parsed.limit).toBeUndefined();
    expect(parsed.competition).toBeUndefined();
    expect(parsed.category).toBeUndefined();
    expect(parsed.season).toBeUndefined();
    expect(parsed.dataRoot).toBe(resolve(process.cwd(), 'apps/api/data'));
  });

  it('parses explicit arguments correctly', () => {
    const parsed = parseSeedHistoryArgs([
      '--competition=eng-premier-league',
      '--season=current',
      '--limit=10',
      `--data-root=${resolve(process.cwd(), 'custom/data')}`
    ]);

    expect(parsed.competition).toBe('eng-premier-league');
    expect(parsed.category).toBeUndefined();
    expect(parsed.season).toBe('current');
    expect(parsed.limit).toBe(10);
    expect(parsed.dataRoot).toBe(resolve(process.cwd(), 'custom/data'));
  });

  it('accepts valid 4-digit year as season argument', () => {
    const parsed = parseSeedHistoryArgs(['--season=2025']);
    expect(parsed.season).toBe(2025);
  });

  it('rejects invalid limit values (0, negative, NaN)', () => {
    expect(() => parseSeedHistoryArgs(['--limit=0'])).toThrow(/limit must be a positive integer/i);
    expect(() => parseSeedHistoryArgs(['--limit=-5'])).toThrow(/limit must be a positive integer/i);
    expect(() => parseSeedHistoryArgs(['--limit=abc'])).toThrow(/limit must be a positive integer/i);
  });

  it('rejects invalid season option', () => {
    expect(() => parseSeedHistoryArgs(['--season=invalid_season'])).toThrow(/invalid --season option/i);
    expect(() => parseSeedHistoryArgs(['--season=99'])).toThrow(/invalid --season option/i);
  });

  it('rejects invalid category', () => {
    expect(() => parseSeedHistoryArgs(['--category=unknown_cat'])).toThrow(/invalid --category option/i);
  });

  it('rejects ambiguous competition and category filters', () => {
    expect(() => parseSeedHistoryArgs([
      '--competition=eng-premier-league',
      '--category=top5_europe'
    ])).toThrow(/cannot be combined/i);
  });

  it('rejects unknown arguments', () => {
    expect(() => parseSeedHistoryArgs(['--unknown-flag=123'])).toThrow(/unknown argument: --unknown-flag=123/i);
    expect(() => parseSeedHistoryArgs(['--mock-mode'])).toThrow(/unknown argument: --mock-mode/i);
  });

  it('rejects relative, workspace root, or outside-workspace data roots', () => {
    expect(() => parseSeedHistoryArgs(['--data-root=relative/path'])).toThrow(/--data-root must be an absolute path/i);
    expect(() => parseSeedHistoryArgs([`--data-root=${process.cwd()}`])).toThrow(/contained child path/i);
    expect(() => parseSeedHistoryArgs([`--data-root=${resolve(process.cwd(), '..', 'outside-data')}`])).toThrow(/contained child path/i);
  });

  it('rejects invalid arguments before creating a provider request', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-seed-invalid-'));
    const dataRoot = join(tempDir, 'data');
    const mockFetch = vi.fn();

    try {
      const ledger = new ApiFootballUsageLedger({ dataRoot });
      const client = new ApiFootballClient({
        apiKey: 'secret-key',
        fetchFn: mockFetch as unknown as typeof fetch,
        ledger,
        dataRoot
      });

      await expect(runSeedApiFootballHistoryCli({
        args: [`--data-root=${resolve(tempDir, '..', 'outside-data')}`],
        apiKey: 'secret-key',
        registry: SAMPLE_CLI_REGISTRY,
        client,
        cwd: tempDir
      })).rejects.toThrow(/contained child path/i);
      expect(mockFetch).not.toHaveBeenCalled();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe('runSeedApiFootballHistoryCli', () => {
  it('returns a failing process code when any hydration target failed', () => {
    const baseResult = {
      status: 'completed' as const,
      runId: 'run-test',
      seasonsHydrated: 1,
      matchesHydrated: 1,
      emptyCount: 0,
      failedCount: 0,
      pendingCount: 0,
      quotaUsedToday: 1
    };

    expect(getSeedHistoryCliExitCode(baseResult)).toBe(0);
    expect(getSeedHistoryCliExitCode({ ...baseResult, status: 'failed', failedCount: 1 })).toBe(1);
    expect(getSeedHistoryCliExitCode({ ...baseResult, status: 'partial', failedCount: 1, pendingCount: 1 })).toBe(1);
  });

  it('executes hydration job and returns structured result without leaking API keys', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-seed-cli-'));
    const dataRoot = join(tempDir, 'data');

    try {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        const parsed = new URL(url);
        const league = Number(parsed.searchParams.get('league'));
        const season = Number(parsed.searchParams.get('season'));
        return {
          ok: true,
          status: 200,
          json: async (): Promise<ApiFootballApiResponse<ApiFootballFixtureItem>> => ({
            get: 'fixtures',
            parameters: { league: String(league), season: String(season) },
            errors: [],
            results: 1,
            response: [
              {
                fixture: {
                  id: 5001,
                  referee: 'Referee',
                  timezone: 'UTC',
                  date: '2026-08-25T15:00:00+00:00',
                  timestamp: 1787670000,
                  status: { long: 'Match Finished', short: 'FT', elapsed: 90 }
                },
                league: { id: league, name: 'League', country: 'Country', season, round: '1' },
                teams: { home: { id: 1, name: 'Home', winner: true }, away: { id: 2, name: 'Away', winner: false } },
                goals: { home: 1, away: 0 },
                score: {
                  halftime: { home: 1, away: 0 },
                  fulltime: { home: 1, away: 0 },
                  extratime: { home: null, away: null },
                  penalty: { home: null, away: null }
                }
              }
            ]
          })
        };
      });

      const ledger = new ApiFootballUsageLedger({ dataRoot });
      const client = new ApiFootballClient({
        apiKey: 'super-secret-api-key-12345',
        fetchFn: mockFetch as unknown as typeof fetch,
        ledger,
        dataRoot
      });

      const logs: string[] = [];
      const logFn = (msg: string) => logs.push(msg);

      const result = await runSeedApiFootballHistoryCli({
        args: ['--season=current', `--data-root=${dataRoot}`],
        apiKey: 'super-secret-api-key-12345',
        registry: SAMPLE_CLI_REGISTRY,
        client,
        cwd: tempDir,
        logFn
      });

      expect(result.status).toBe('completed');
      expect(result.seasonsHydrated).toBe(2);
      expect(result.matchesHydrated).toBe(2);
      expect(result.pendingCount).toBe(0);

      // Verify log output never contains the raw secret API key
      const combinedLog = logs.join('\n');
      expect(combinedLog).not.toContain('super-secret-api-key-12345');
      expect(combinedLog).toContain('API Key: Configured');
      expect(combinedLog).toContain('HYDRATION PROGRESS REPORT');
      expect(combinedLog).toContain('Completed targets: 2');
      expect(combinedLog).toContain('ALL SELECTED HYDRATION TARGETS ARE COMPLETE');
      expect(combinedLog).not.toContain('ALL CONFIGURED SEASONS ARE FULLY HYDRATED');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('stops when durable quota is exhausted without exceeding limit', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-seed-cli-quota-'));
    const dataRoot = join(tempDir, 'data');

    try {
      const ledger = new ApiFootballUsageLedger({ dataRoot, hardCeiling: 1 });
      await ledger.reserveSlot();

      const mockFetch = vi.fn();
      const client = new ApiFootballClient({
        apiKey: 'secret-key',
        fetchFn: mockFetch as unknown as typeof fetch,
        ledger,
        dataRoot
      });

      const result = await runSeedApiFootballHistoryCli({
        args: [`--data-root=${dataRoot}`],
        apiKey: 'secret-key',
        registry: SAMPLE_CLI_REGISTRY,
        client,
        cwd: tempDir
      });

      expect(result.seasonsHydrated).toBe(0);
      expect(result.quotaUsedToday).toBe(1);
      expect(mockFetch).not.toHaveBeenCalled();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
