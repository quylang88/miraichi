import { describe, expect, it, vi } from 'vitest';
import {
  computeConcludingWindows,
  runApiFootballIngestionJob
} from './api-football-ingestion-job.js';
import {
  ApiFootballClient,
  type ApiFootballApiResponse,
  type ApiFootballFixtureItem
} from '../sources/api-football/api-football-client.js';
import type { ApiFootballCompetitionEntry } from '@miraichi/config';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ApiFootballUsageLedger } from '../sources/api-football/api-football-usage-ledger.js';
import { LocalMatchDetailStore } from '../../../api/src/repositories/local-match-detail-store.js';
import { readServingMatchStoreSnapshot } from '../../../api/src/repositories/serving-match-store.js';

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

function createMockFixture(
  id: number,
  options: {
    kickoffUtc?: string;
    statusShort?: string;
    homeScore?: number | null;
    awayScore?: number | null;
    homeTeamName?: string;
    awayTeamName?: string;
    events?: ApiFootballFixtureItem['events'];
    statistics?: ApiFootballFixtureItem['statistics'];
    referee?: string;
  } = {}
): ApiFootballFixtureItem {
  const statusShort = options.statusShort || 'NS';
  const isFinished = statusShort === 'FT' || statusShort === 'AET' || statusShort === 'PEN';
  const homeScore = options.homeScore !== undefined ? options.homeScore : isFinished ? 2 : null;
  const awayScore = options.awayScore !== undefined ? options.awayScore : isFinished ? 1 : null;

  return {
    fixture: {
      id,
      referee: options.referee || 'Michael Oliver',
      timezone: 'UTC',
      date: options.kickoffUtc || '2026-08-25T15:00:00+00:00',
      timestamp: 1787670000,
      status: {
        long: isFinished ? 'Match Finished' : statusShort === '2H' ? 'Second Half' : 'Not Started',
        short: statusShort,
        elapsed: isFinished ? 90 : statusShort === '2H' ? 88 : null
      }
    },
    league: {
      id: 99998,
      name: 'Premier League',
      country: 'England',
      season: 2026,
      round: 'Regular Season - 1'
    },
    teams: {
      home: { id: 30 + (id % 10), name: options.homeTeamName || `Arsenal ${id}`, winner: null },
      away: { id: 40 + (id % 10), name: options.awayTeamName || `Chelsea ${id}`, winner: null }
    },
    goals: { home: homeScore, away: awayScore },
    score: {
      halftime: { home: isFinished ? 1 : null, away: isFinished ? 0 : null },
      fulltime: { home: homeScore, away: awayScore },
      extratime: { home: null, away: null },
      penalty: { home: null, away: null }
    },
    ...(options.events ? { events: options.events } : {}),
    ...(options.statistics ? { statistics: options.statistics } : {})
  };
}

const MOCK_FIXTURE_SCHEDULED = createMockFixture(1001, {
  kickoffUtc: '2026-08-25T15:00:00+00:00',
  statusShort: 'NS',
  homeTeamName: 'Arsenal',
  awayTeamName: 'Chelsea'
});

const MOCK_FIXTURE_FINISHED = createMockFixture(1001, {
  kickoffUtc: '2026-08-25T15:00:00+00:00',
  statusShort: 'FT',
  homeScore: 2,
  awayScore: 0,
  homeTeamName: 'Arsenal',
  awayTeamName: 'Chelsea',
  events: [
    {
      time: { elapsed: 30, extra: null },
      team: { id: 31, name: 'Arsenal' },
      player: { id: 101, name: 'Bukayo Saka' },
      assist: { id: 102, name: 'Martin Odegaard' },
      type: 'Goal',
      detail: 'Normal Goal'
    }
  ],
  statistics: [
    {
      team: { id: 31, name: 'Arsenal' },
      statistics: [
        { type: 'Corner Kicks', value: 6 },
        { type: 'Yellow Cards', value: 1 },
        { type: 'Red Cards', value: 0 },
        { type: 'Total Shots', value: 14 },
        { type: 'Shots on Goal', value: 5 },
        { type: 'Ball Possession', value: '55%' }
      ]
    },
    {
      team: { id: 41, name: 'Chelsea' },
      statistics: [
        { type: 'Corner Kicks', value: 4 },
        { type: 'Yellow Cards', value: 2 },
        { type: 'Red Cards', value: 0 },
        { type: 'Total Shots', value: 8 },
        { type: 'Shots on Goal', value: 3 },
        { type: 'Ball Possession', value: '45%' }
      ]
    }
  ]
});

const MOCK_FIXTURE_LIVE = createMockFixture(1001, {
  kickoffUtc: '2026-08-25T15:00:00+00:00',
  statusShort: '2H',
  homeScore: 1,
  awayScore: 0,
  homeTeamName: 'Arsenal',
  awayTeamName: 'Chelsea'
});

describe('computeConcludingWindows', () => {
  it('computes normal concluding window range [T+100m, T+120m] for scheduled matches', () => {
    const windows = computeConcludingWindows([
      { matchId: 'match-canonical-a', providerFixtureId: 1001, kickoffUtc: '2026-08-25T15:00:00.000Z', status: 'scheduled' },
      { matchId: 'match-canonical-b', providerFixtureId: 1002, kickoffUtc: '2026-08-25T15:00:00.000Z', status: 'completed' }
    ]);

    expect(windows).toHaveLength(1);
    expect(windows[0]?.providerFixtureId).toBe(1001);
    expect(windows[0]?.windowStartUtc).toBe('2026-08-25T16:40:00.000Z');
    expect(windows[0]?.windowEndUtc).toBe('2026-08-25T17:00:00.000Z');
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
      expect(mockFetch.mock.calls[0]?.[0]).toContain('timezone=Asia%2FTokyo');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('does not cache live events or scores returned incidentally by the one daily request', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-ingest-daily-live-control-only-'));
    try {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async (): Promise<ApiFootballApiResponse<ApiFootballFixtureItem>> => ({
          get: 'fixtures',
          parameters: { date: '2026-08-25' },
          errors: [],
          results: 1,
          response: [{
            ...MOCK_FIXTURE_LIVE,
            events: MOCK_FIXTURE_FINISHED.events ?? [],
            statistics: MOCK_FIXTURE_FINISHED.statistics ?? []
          }]
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
      const serving = await readServingMatchStoreSnapshot(join(tempDir, 'serving'));
      expect(serving.matches[0]?.status).toBe('scheduled');
      expect(serving.matches[0]?.score).toEqual({ home: null, away: null });
      expect(await new LocalMatchDetailStore({ dataRoot: tempDir }).getDetail(serving.matches[0]!.id))
        .toBeNull();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('100 scheduler heartbeats outside a concluding window produce exactly ONE daily-sync request for the owner-local date', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-ingest-100-heartbeats-'));

    try {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async (): Promise<ApiFootballApiResponse<ApiFootballFixtureItem>> => ({
          get: 'fixtures',
          parameters: { date: '2026-08-25' },
          errors: [],
          results: 1,
          response: [
            createMockFixture(1001, {
              kickoffUtc: '2026-08-25T19:00:00+00:00', // 19:00 kickoff
              statusShort: 'NS'
            })
          ]
        })
      });

      const client = new ApiFootballClient({
        apiKey: 'test-api-key',
        fetchFn: mockFetch as unknown as typeof fetch,
        dataRoot: tempDir
      });

      // 100 heartbeats at 09:00 UTC (well before kickoff +100m)
      const heartbeatTime = new Date('2026-08-25T09:00:00.000Z');

      for (let i = 0; i < 100; i++) {
        const res = await runApiFootballIngestionJob({
          dataRoot: tempDir,
          mode: 'auto',
          client,
          registry: SAMPLE_REGISTRY,
          now: () => heartbeatTime
        });

        if (i === 0) {
          expect(res.status).toBe('synced');
          expect(res.matchesProcessed).toBe(1);
        } else {
          expect(res.status).toBe('skipped');
          expect(res.matchesProcessed).toBe(0);
        }
      }

      // Exactly ONE fetch call was made across all 100 heartbeats!
      expect(mockFetch).toHaveBeenCalledTimes(1);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }, 40_000);

  it('a failed daily sync remains due; a published daily sync is not retried until next local date', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-ingest-failed-retry-'));

    try {
      let failNext = true;
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (failNext) {
          throw new Error('Network timeout');
        }
        const dateMatch = url.match(/date=([^&]+)/u);
        const dateParam = dateMatch ? dateMatch[1] : '2026-08-25';
        return {
          ok: true,
          status: 200,
          json: async (): Promise<ApiFootballApiResponse<ApiFootballFixtureItem>> => ({
            get: 'fixtures',
            parameters: { date: dateParam },
            errors: [],
            results: 1,
            response: [
              createMockFixture(1001, {
                kickoffUtc: `${dateParam}T19:00:00+00:00`,
                statusShort: 'NS'
              })
            ]
          })
        };
      });

      const client = new ApiFootballClient({
        apiKey: 'test-api-key',
        fetchFn: mockFetch as unknown as typeof fetch,
        dataRoot: tempDir
      });

      // 1. First heartbeat: fails with network error
      const res1 = await runApiFootballIngestionJob({
        dataRoot: tempDir,
        mode: 'auto',
        client,
        registry: SAMPLE_REGISTRY,
        now: () => new Date('2026-08-25T05:00:00.000Z')
      });
      expect(res1.status).toBe('failed');
      expect(res1.error).toContain('Network timeout');

      // 2. Second heartbeat on same date: network recovered -> sync succeeds
      failNext = false;
      const res2 = await runApiFootballIngestionJob({
        dataRoot: tempDir,
        mode: 'auto',
        client,
        registry: SAMPLE_REGISTRY,
        now: () => new Date('2026-08-25T05:01:00.000Z')
      });
      expect(res2.status).toBe('synced');
      expect(res2.matchesProcessed).toBe(1);

      // 3. Third heartbeat on same date: already synced -> skipped, 0 new fetches
      const res3 = await runApiFootballIngestionJob({
        dataRoot: tempDir,
        mode: 'auto',
        client,
        registry: SAMPLE_REGISTRY,
        now: () => new Date('2026-08-25T06:00:00.000Z')
      });
      expect(res3.status).toBe('skipped');
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // 4. Fourth heartbeat on next local date (2026-08-26): sync is due again!
      const res4 = await runApiFootballIngestionJob({
        dataRoot: tempDir,
        mode: 'auto',
        client,
        registry: SAMPLE_REGISTRY,
        now: () => new Date('2026-08-26T05:00:00.000Z')
      });
      expect(res4.status).toBe('synced');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('21 due fixtures become two requests of 20 and 1; 41 become three requests (20 + 20 + 1)', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-ingest-chunks-'));

    try {
      const fixtures21 = Array.from({ length: 21 }, (_, i) =>
        createMockFixture(2000 + i, {
          kickoffUtc: '2026-08-25T15:00:00+00:00',
          statusShort: 'NS',
          homeTeamName: `Home ${i}`,
          awayTeamName: `Away ${i}`
        })
      );

      const polledUrls: string[] = [];
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        polledUrls.push(url);
        if (url.includes('date=')) {
          return {
            ok: true,
            status: 200,
            json: async (): Promise<ApiFootballApiResponse<ApiFootballFixtureItem>> => ({
              get: 'fixtures',
              parameters: { date: '2026-08-25' },
              errors: [],
              results: fixtures21.length,
              response: fixtures21
            })
          };
        } else {
          // ids request
          const idsMatch = url.match(/ids=([^&]+)/u);
          const idList = idsMatch ? idsMatch[1]!.split('-').map(Number) : [];
          const responseFixtures = idList.map((id) =>
            createMockFixture(id, {
              kickoffUtc: '2026-08-25T15:00:00+00:00',
              statusShort: 'FT',
              homeScore: 1,
              awayScore: 0
            })
          );
          return {
            ok: true,
            status: 200,
            json: async (): Promise<ApiFootballApiResponse<ApiFootballFixtureItem>> => ({
              get: 'fixtures',
              parameters: { ids: idsMatch ? idsMatch[1]! : '' },
              errors: [],
              results: responseFixtures.length,
              response: responseFixtures
            })
          };
        }
      });

      const client = new ApiFootballClient({
        apiKey: 'test-api-key',
        fetchFn: mockFetch as unknown as typeof fetch,
        dataRoot: tempDir
      });

      // Initial daily sync to populate 21 scheduled matches
      await runApiFootballIngestionJob({
        dataRoot: tempDir,
        mode: 'daily_sync',
        date: '2026-08-25',
        client,
        registry: SAMPLE_REGISTRY,
        now: () => new Date('2026-08-25T05:00:00.000Z')
      });

      polledUrls.length = 0; // reset URL tracking

      // Poll at kickoff +105m (16:45 UTC)
      const pollResult = await runApiFootballIngestionJob({
        dataRoot: tempDir,
        mode: 'window_poll',
        client,
        registry: SAMPLE_REGISTRY,
        now: () => new Date('2026-08-25T16:45:00.000Z')
      });

      expect(pollResult.status).toBe('published');
      expect(pollResult.matchesProcessed).toBe(21);
      expect(pollResult.matchesCompleted).toBe(21);

      // Verify 2 requests: chunk 1 has 20 IDs, chunk 2 has 1 ID
      const idsRequests = polledUrls.filter((u) => u.includes('ids='));
      expect(idsRequests).toHaveLength(2);

      const chunk1Ids = idsRequests[0]?.match(/ids=([^&]+)/u)?.[1]?.split('-') ?? [];
      const chunk2Ids = idsRequests[1]?.match(/ids=([^&]+)/u)?.[1]?.split('-') ?? [];
      expect(chunk1Ids).toHaveLength(20);
      expect(chunk2Ids).toHaveLength(1);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('resolves provider IDs from server-side source refs, never canonical match IDs', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-ingest-source-refs-'));

    try {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('date=')) {
          return {
            ok: true,
            status: 200,
            json: async (): Promise<ApiFootballApiResponse<ApiFootballFixtureItem>> => ({
              get: 'fixtures',
              parameters: { date: '2026-08-25' },
              errors: [],
              results: 1,
              response: [
                createMockFixture(88888, {
                  kickoffUtc: '2026-08-25T15:00:00+00:00',
                  statusShort: 'NS',
                  homeTeamName: 'Arsenal',
                  awayTeamName: 'Chelsea'
                })
              ]
            })
          };
        } else {
          return {
            ok: true,
            status: 200,
            json: async (): Promise<ApiFootballApiResponse<ApiFootballFixtureItem>> => ({
              get: 'fixtures',
              parameters: { ids: '88888' },
              errors: [],
              results: 1,
              response: [
                createMockFixture(88888, {
                  kickoffUtc: '2026-08-25T15:00:00+00:00',
                  statusShort: 'FT',
                  homeScore: 1,
                  awayScore: 0
                })
              ]
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

      // Check serving snapshot
      const snapshot = await readServingMatchStoreSnapshot(join(tempDir, 'serving'));
      const storedMatch = snapshot.matches[0]!;
      expect(storedMatch.id).toMatch(/^match-/u);
      expect(storedMatch.id).not.toContain('88888'); // Canonical ID does NOT contain provider ID

      // Window poll at kickoff +100m
      await runApiFootballIngestionJob({
        dataRoot: tempDir,
        mode: 'window_poll',
        client,
        registry: SAMPLE_REGISTRY,
        now: () => new Date('2026-08-25T16:40:00.000Z')
      });

      const lastCallUrl = mockFetch.mock.calls[1]?.[0] as string;
      expect(lastCallUrl).toContain('ids=88888');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('starts result polling at kickoff +100m', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-ingest-kickoff-100m-'));

    try {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('date=')) {
          return {
            ok: true,
            status: 200,
            json: async (): Promise<ApiFootballApiResponse<ApiFootballFixtureItem>> => ({
              get: 'fixtures',
              parameters: { date: '2026-08-25' },
              errors: [],
              results: 1,
              response: [
                createMockFixture(1001, {
                  kickoffUtc: '2026-08-25T15:00:00+00:00', // Kickoff 15:00 UTC
                  statusShort: 'NS'
                })
              ]
            })
          };
        } else {
          return {
            ok: true,
            status: 200,
            json: async (): Promise<ApiFootballApiResponse<ApiFootballFixtureItem>> => ({
              get: 'fixtures',
              parameters: { ids: '1001' },
              errors: [],
              results: 1,
              response: [
                createMockFixture(1001, {
                  kickoffUtc: '2026-08-25T15:00:00+00:00',
                  statusShort: 'FT',
                  homeScore: 2,
                  awayScore: 1
                })
              ]
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

      // Poll at +99m (16:39 UTC) -> NOT due yet, should skip without network call
      const res99 = await runApiFootballIngestionJob({
        dataRoot: tempDir,
        mode: 'window_poll',
        client,
        registry: SAMPLE_REGISTRY,
        now: () => new Date('2026-08-25T16:39:00.000Z')
      });
      expect(res99.status).toBe('skipped');
      expect(mockFetch).toHaveBeenCalledTimes(1); // only daily sync

      // Poll at +100m (16:40 UTC) -> DUE!
      const res100 = await runApiFootballIngestionJob({
        dataRoot: tempDir,
        mode: 'window_poll',
        client,
        registry: SAMPLE_REGISTRY,
        now: () => new Date('2026-08-25T16:40:00.000Z')
      });
      expect(res100.status).toBe('published');
      expect(res100.matchesCompleted).toBe(1);
      expect(mockFetch).toHaveBeenCalledTimes(2);
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

      const initialSnapshot = await readServingMatchStoreSnapshot(join(tempDir, 'serving'));
      const initialSnapshotId = initialSnapshot.snapshotId;

      // Window poll at kickoff +105m (16:45 UTC)
      const pollResult = await runApiFootballIngestionJob({
        dataRoot: tempDir,
        mode: 'window_poll',
        client,
        registry: SAMPLE_REGISTRY,
        now: () => new Date('2026-08-25T16:45:00.000Z')
      });

      expect(pollResult.status).toBe('not_modified');
      expect(pollResult.matchesProcessed).toBe(1);
      expect(pollResult.matchesCompleted).toBe(0);

      // Serving store manifest must remain completely unmutated
      const snapshotAfterLivePoll = await readServingMatchStoreSnapshot(join(tempDir, 'serving'));
      expect(snapshotAfterLivePoll.snapshotId).toBe(initialSnapshotId);
      expect(snapshotAfterLivePoll.matches[0]?.status).toBe('scheduled');
      expect(snapshotAfterLivePoll.matches[0]?.score?.home).toBeNull();
      expect(snapshotAfterLivePoll.matches[0]?.score?.away).toBeNull();

      // Ledger must record the live reported status '2H'
      const ledgerState = await client.ledger.getState();
      const matchId = snapshotAfterLivePoll.matches[0]!.id;
      expect(ledgerState.matchPollStates?.[matchId]?.lastReportedStatus).toBe('2H');
      expect(ledgerState.matchPollStates?.[matchId]?.nextDueAt).toBe('2026-08-25T16:47:30.000Z');
      expect(ledgerState.matchPollStates?.[matchId]?.sloEligibleAt).toBe('2026-08-25T16:40:00.000Z');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('does not partially publish when a provider batch omits one requested fixture', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-ingest-incomplete-batch-'));
    const scheduledFixtures = [
      createMockFixture(5101, { homeTeamName: 'Home A', awayTeamName: 'Away A' }),
      createMockFixture(5102, { homeTeamName: 'Home B', awayTeamName: 'Away B' })
    ];
    try {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            get: 'fixtures', parameters: { date: '2026-08-25' }, errors: [],
            results: 2, response: scheduledFixtures
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            get: 'fixtures', parameters: { ids: '5101-5102' }, errors: [],
            results: 1,
            response: [createMockFixture(5101, { statusShort: 'FT', homeScore: 1, awayScore: 0 })]
          })
        });
      const client = new ApiFootballClient({
        apiKey: 'test-api-key',
        fetchFn: mockFetch as unknown as typeof fetch,
        dataRoot: tempDir
      });
      await runApiFootballIngestionJob({
        dataRoot: tempDir, mode: 'daily_sync', date: '2026-08-25', client,
        registry: SAMPLE_REGISTRY, now: () => new Date('2026-08-25T05:00:00.000Z')
      });

      const result = await runApiFootballIngestionJob({
        dataRoot: tempDir, mode: 'window_poll', client, registry: SAMPLE_REGISTRY,
        now: () => new Date('2026-08-25T16:45:00.000Z')
      });

      expect(result.status).toBe('not_modified');
      const serving = await readServingMatchStoreSnapshot(join(tempDir, 'serving'));
      expect(serving.matches.map((match) => match.status)).toEqual(['scheduled', 'scheduled']);
      const missingMatch = serving.matches.find((match) =>
        match.sourceRefs.some((ref) => ref.sourceMatchId === '5102')
      )!;
      const ledger = await client.ledger.getState();
      expect(ledger.matchPollStates?.[missingMatch.id]?.deferralReason).toBe('unknown_fixture');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('terminal response (FT) publishes serving store and upserts LocalMatchDetailStore', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-ingest-ft-detail-'));

    try {
      let fetchCount = 0;
      const mockFetch = vi.fn().mockImplementation(async () => {
        fetchCount += 1;
        const fixture = fetchCount === 1 ? MOCK_FIXTURE_SCHEDULED : MOCK_FIXTURE_FINISHED;
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

      // Window poll at 16:45 UTC (kickoff 15:00 + 105m)
      const pollResult = await runApiFootballIngestionJob({
        dataRoot: tempDir,
        mode: 'window_poll',
        client,
        registry: SAMPLE_REGISTRY,
        now: () => new Date('2026-08-25T16:45:00.000Z')
      });

      expect(pollResult.status).toBe('published');
      expect(pollResult.matchesProcessed).toBe(1);
      expect(pollResult.matchesCompleted).toBe(1);

      // Serving store must have completed match with scores
      const servingSnapshot = await readServingMatchStoreSnapshot(join(tempDir, 'serving'));
      const completedMatch = servingSnapshot.matches[0]!;
      expect(completedMatch.status).toBe('completed');
      expect(completedMatch.score?.home).toBe(2);
      expect(completedMatch.score?.away).toBe(0);

      // LocalMatchDetailStore must have upserted rich match detail
      const detailStore = new LocalMatchDetailStore({ dataRoot: tempDir });
      const detail = await detailStore.getDetail(completedMatch.id);
      expect(detail).not.toBeNull();
      expect(detail?.status).toBe('completed');
      expect(detail?.referee).toBe('Michael Oliver');
      expect(detail?.elapsedMinute).toBe(90);
      expect(detail?.events).toHaveLength(1);
      expect(detail?.events[0]?.player).toBe('Bukayo Saka');
      expect(detail?.teamStats).toBeDefined();
      expect(detail?.teamStats?.[0]?.cornerKicks).toBe(6);
      expect(detail?.teamStats?.[0]?.possessionPercentage).toBe(55);

      const ledgerState = await client.ledger.getState();
      expect(ledgerState.matchPollStates?.[completedMatch.id]?.lastReportedStatus).toBe('FT');
      expect(ledgerState.matchPollStates?.[completedMatch.id]?.nextDueAt).toBeNull();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('no due work or no quota makes 0 fetch calls and does not mutate serving store', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-ingest-no-quota-'));

    try {
      const ledger = new ApiFootballUsageLedger({ dataRoot: tempDir, hardCeiling: 1 });
      await ledger.reserveSlot(); // Quota exhausted (1/1)

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
      expect(result.error).toBe('Normal API-Football quota ceiling reached');
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
