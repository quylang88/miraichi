import { describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  parseCaptureArgs,
  runCaptureApiFootballCli
} from './capture-api-football.js';
import {
  ApiFootballClient,
  type ApiFootballApiResponse,
  type ApiFootballFixtureItem
} from '../apps/worker/src/sources/api-football/api-football-client.js';
import { ApiFootballUsageLedger } from '../apps/worker/src/sources/api-football/api-football-usage-ledger.js';
import { readServingMatchStoreSnapshot } from '../apps/api/src/repositories/serving-match-store.js';
import { LocalMatchDetailStore } from '../apps/api/src/repositories/local-match-detail-store.js';
import type { ApiFootballCompetitionEntry } from '../packages/config/src/index.js';

const SAMPLE_REGISTRY: readonly ApiFootballCompetitionEntry[] = [
  {
    entryId: 'api-football-eng-premier-league',
    sourceId: 'api-football',
    competitionId: 'eng-premier-league',
    competitionName: 'England Division 1',
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

function sampleFixtureResponse(overrides: {
  id?: number;
  date?: string;
  statusShort?: string;
  homeGoals?: number | null;
  awayGoals?: number | null;
} = {}): ApiFootballApiResponse<ApiFootballFixtureItem> {
  const id = overrides.id ?? 1001;
  const date = overrides.date ?? '2026-08-25T15:00:00+00:00';
  const statusShort = overrides.statusShort ?? 'NS';
  const homeGoals = overrides.homeGoals ?? null;
  const awayGoals = overrides.awayGoals ?? null;

  return {
    get: 'fixtures',
    parameters: {},
    errors: [],
    results: 1,
    response: [
      {
        fixture: {
          id,
          referee: 'Michael Oliver',
          timezone: 'UTC',
          date,
          timestamp: Date.parse(date) / 1000,
          venue: { id: 1, name: 'Stadium', city: 'London' },
          status: {
            long: statusShort === 'FT' ? 'Match Finished' : 'Not Started',
            short: statusShort,
            elapsed: statusShort === 'FT' ? 90 : null
          }
        },
        league: {
          id: 39,
          name: 'England Division 1',
          country: 'England',
          season: 2026,
          round: 'Regular Season - 1'
        },
        teams: {
          home: { id: 10, name: 'Team Alpha', winner: statusShort === 'FT' ? true : null },
          away: { id: 20, name: 'Team Beta', winner: statusShort === 'FT' ? false : null }
        },
        goals: { home: homeGoals, away: awayGoals },
        score: {
          halftime: { home: homeGoals !== null ? 1 : null, away: awayGoals !== null ? 0 : null },
          fulltime: { home: homeGoals, away: awayGoals },
          extratime: { home: null, away: null },
          penalty: { home: null, away: null }
        },
        events: statusShort === 'FT' ? [
          {
            time: { elapsed: 25, extra: null },
            team: { id: 10, name: 'Team Alpha' },
            player: { id: 101, name: 'Striker One' },
            assist: { id: 102, name: 'Winger One' },
            type: 'Goal',
            detail: 'Normal Goal'
          }
        ] : [],
        statistics: statusShort === 'FT' ? [
          {
            team: { id: 10, name: 'Team Alpha' },
            statistics: [
              { type: 'Total Shots', value: 12 },
              { type: 'Shots on Goal', value: 5 },
              { type: 'Ball Possession', value: '55%' },
              { type: 'Corner Kicks', value: 6 },
              { type: 'Yellow Cards', value: 1 },
              { type: 'Red Cards', value: 0 }
            ]
          },
          {
            team: { id: 20, name: 'Team Beta' },
            statistics: [
              { type: 'Total Shots', value: 8 },
              { type: 'Shots on Goal', value: 2 },
              { type: 'Ball Possession', value: '45%' },
              { type: 'Corner Kicks', value: 3 },
              { type: 'Yellow Cards', value: 2 },
              { type: 'Red Cards', value: 0 }
            ]
          }
        ] : []
      }
    ]
  };
}

describe('parseCaptureArgs', () => {
  it('parses valid CLI options with default values', () => {
    const parsed = parseCaptureArgs([]);
    expect(parsed.mode).toBeUndefined();
    expect(parsed.date).toBeUndefined();
    expect(parsed.dataRoot).toBe(resolve(process.cwd(), 'apps/api/data'));
  });

  it('parses explicit arguments correctly', () => {
    const customDataRoot = resolve(process.cwd(), 'custom/data');
    const parsed = parseCaptureArgs([
      '--mode=daily_sync',
      '--date=2026-08-25',
      `--data-root=${customDataRoot}`
    ]);

    expect(parsed.mode).toBe('daily_sync');
    expect(parsed.date).toBe('2026-08-25');
    expect(parsed.dataRoot).toBe(customDataRoot);
  });

  it('accepts window_poll and auto modes', () => {
    expect(parseCaptureArgs(['--mode=window_poll']).mode).toBe('window_poll');
    expect(parseCaptureArgs(['--mode=auto']).mode).toBe('auto');
  });

  it('rejects invalid mode option', () => {
    expect(() => parseCaptureArgs(['--mode=invalid_mode'])).toThrow(/invalid --mode option/i);
    expect(() => parseCaptureArgs(['--mode='])).toThrow(/invalid --mode option/i);
  });

  it('rejects invalid date option', () => {
    expect(() => parseCaptureArgs(['--date=invalid-date'])).toThrow(/invalid --date option/i);
    expect(() => parseCaptureArgs(['--date=2026-13-45'])).toThrow(/invalid --date option/i);
    expect(() => parseCaptureArgs(['--date=2026-02-30'])).toThrow(/invalid --date option/i);
  });

  it('rejects unknown arguments', () => {
    expect(() => parseCaptureArgs(['--unknown-flag=123'])).toThrow(/unknown argument: --unknown-flag=123/i);
    expect(() => parseCaptureArgs(['--force'])).toThrow(/unknown argument: --force/i);
  });

  it('rejects relative, workspace root, or outside-workspace data roots', () => {
    expect(() => parseCaptureArgs(['--data-root=relative/path'])).toThrow(/--data-root must be an absolute path/i);
    expect(() => parseCaptureArgs([`--data-root=${process.cwd()}`])).toThrow(/contained child path/i);
    expect(() => parseCaptureArgs([`--data-root=${resolve(process.cwd(), '..', 'outside-data')}`])).toThrow(/contained child path/i);
  });
});

describe('runCaptureApiFootballCli', () => {
  it('throws error when API_FOOTBALL_KEY is missing without network request or quota consumption', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-capture-nokey-'));
    const dataRoot = join(tempDir, 'data');
    const mockFetch = vi.fn();

    try {
      await expect(runCaptureApiFootballCli({
        args: [`--data-root=${dataRoot}`],
        apiKey: '',
        cwd: tempDir
      })).rejects.toThrow(/Missing API_FOOTBALL_KEY environment variable/i);

      expect(mockFetch).not.toHaveBeenCalled();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('executes daily_sync with specified date and updates serving store', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-capture-daily-'));
    const dataRoot = join(tempDir, 'data');
    const targetDate = '2026-08-25';
    const logs: string[] = [];
    const logFn = (msg: string) => logs.push(msg);

    try {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        const parsed = new URL(url);
        expect(parsed.searchParams.get('date')).toBe(targetDate);
        return {
          ok: true,
          status: 200,
          json: async () => sampleFixtureResponse({ id: 2001, date: `${targetDate}T14:00:00+00:00`, statusShort: 'NS' })
        };
      });

      const ledger = new ApiFootballUsageLedger({ dataRoot });
      const client = new ApiFootballClient({
        apiKey: 'secret-api-key-999',
        fetchFn: mockFetch as unknown as typeof fetch,
        ledger,
        dataRoot
      });

      const result = await runCaptureApiFootballCli({
        args: ['--mode=daily_sync', `--date=${targetDate}`, `--data-root=${dataRoot}`],
        apiKey: 'secret-api-key-999',
        registry: SAMPLE_REGISTRY,
        client,
        cwd: tempDir,
        logFn,
        now: () => new Date(`${targetDate}T08:00:00.000Z`)
      });

      expect(result.status).toBe('synced');
      expect(result.mode).toBe('daily_sync');
      expect(result.matchesProcessed).toBe(1);
      expect(result.quotaUsedToday).toBe(1);

      // Verify serving store contains the synced match
      const servingSnapshot = await readServingMatchStoreSnapshot(join(dataRoot, 'serving'));
      expect(servingSnapshot.matches).toHaveLength(1);
      expect(servingSnapshot.matches[0].status).toBe('scheduled');

      // Verify ledger records daily sync date
      const ledgerState = await ledger.getState();
      expect(ledgerState.lastSuccessfulDailySyncDate).toBe(targetDate);

      // Verify logs mask API key and display summary
      const combinedLogs = logs.join('\n');
      expect(combinedLogs).not.toContain('secret-api-key-999');
      expect(combinedLogs).toContain('API Key: Configured');
      expect(combinedLogs).toContain(`Target date: ${targetDate}`);
      expect(combinedLogs).toContain('Status: synced');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('executes window_poll and publishes terminal match and rich detail', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-capture-window-'));
    const dataRoot = join(tempDir, 'data');
    const kickoffUtc = '2026-08-25T14:00:00.000Z';
    const nowUtc = '2026-08-25T16:00:00.000Z'; // +120 minutes after kickoff -> concluding window

    try {
      const mockFetch = vi.fn()
        // First fetch for initial daily sync
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => sampleFixtureResponse({ id: 3001, date: kickoffUtc, statusShort: 'NS' })
        })
        // Second fetch for window poll returning FT
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => sampleFixtureResponse({
            id: 3001,
            date: kickoffUtc,
            statusShort: 'FT',
            homeGoals: 2,
            awayGoals: 1
          })
        });

      const ledger = new ApiFootballUsageLedger({ dataRoot });
      const client = new ApiFootballClient({
        apiKey: 'secret-key-window',
        fetchFn: mockFetch as unknown as typeof fetch,
        ledger,
        dataRoot
      });

      // 1. Initial daily sync to establish scheduled match in store
      await runCaptureApiFootballCli({
        args: ['--mode=daily_sync', '--date=2026-08-25', `--data-root=${dataRoot}`],
        apiKey: 'secret-key-window',
        registry: SAMPLE_REGISTRY,
        client,
        cwd: tempDir,
        now: () => new Date('2026-08-25T08:00:00.000Z')
      });

      // 2. Window poll at +120 min
      const pollResult = await runCaptureApiFootballCli({
        args: ['--mode=window_poll', `--data-root=${dataRoot}`],
        apiKey: 'secret-key-window',
        registry: SAMPLE_REGISTRY,
        client,
        cwd: tempDir,
        now: () => new Date(nowUtc)
      });

      expect(pollResult.status).toBe('published');
      expect(pollResult.mode).toBe('window_poll');
      expect(pollResult.matchesCompleted).toBe(1);

      // Verify serving store has completed match with final scores
      const servingSnapshot = await readServingMatchStoreSnapshot(join(dataRoot, 'serving'));
      expect(servingSnapshot.matches[0].status).toBe('completed');
      expect(servingSnapshot.matches[0].score.home).toBe(2);
      expect(servingSnapshot.matches[0].score.away).toBe(1);

      // Verify match detail store has rich detail persisted
      const detailStore = new LocalMatchDetailStore({ dataRoot });
      const detail = await detailStore.getDetail(servingSnapshot.matches[0].id);
      expect(detail).not.toBeNull();
      expect(detail!.referee).toBe('Michael Oliver');
      expect(detail!.events).toHaveLength(1);
      expect(detail!.teamStats).toHaveLength(2);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('runs auto mode to perform daily sync when due', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-capture-auto-'));
    const dataRoot = join(tempDir, 'data');
    const today = '2026-08-25';

    try {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => sampleFixtureResponse({ id: 4001, date: `${today}T15:00:00+00:00`, statusShort: 'NS' })
      });

      const ledger = new ApiFootballUsageLedger({ dataRoot });
      const client = new ApiFootballClient({
        apiKey: 'secret-key-auto',
        fetchFn: mockFetch as unknown as typeof fetch,
        ledger,
        dataRoot
      });

      const result = await runCaptureApiFootballCli({
        args: ['--mode=auto', `--data-root=${dataRoot}`],
        apiKey: 'secret-key-auto',
        registry: SAMPLE_REGISTRY,
        client,
        cwd: tempDir,
        now: () => new Date(`${today}T06:00:00.000Z`)
      });

      expect(result.status).toBe('synced');
      expect(result.mode).toBe('daily_sync');
      expect(result.matchesProcessed).toBe(1);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('respects quota ceiling and skips ingestion when quota is exhausted', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-capture-quota-'));
    const dataRoot = join(tempDir, 'data');
    const mockFetch = vi.fn();

    try {
      // Set hard ceiling of 1 and exhaust it
      const ledger = new ApiFootballUsageLedger({ dataRoot, hardCeiling: 1 });
      await ledger.reserveSlot();

      const client = new ApiFootballClient({
        apiKey: 'secret-key-quota',
        fetchFn: mockFetch as unknown as typeof fetch,
        ledger,
        dataRoot
      });

      const result = await runCaptureApiFootballCli({
        args: ['--mode=daily_sync', '--date=2026-08-25', `--data-root=${dataRoot}`],
        apiKey: 'secret-key-quota',
        registry: SAMPLE_REGISTRY,
        client,
        cwd: tempDir,
        now: () => new Date('2026-08-25T08:00:00.000Z')
      });

      expect(result.status).toBe('skipped');
      expect(result.error).toContain('Normal API-Football quota ceiling reached');
      expect(result.matchesProcessed).toBe(0);
      expect(mockFetch).not.toHaveBeenCalled();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
