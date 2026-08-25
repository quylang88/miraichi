import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { LocalMatch, LocalMatchDetail, LocalMatchStatus } from '@miraichi/shared';
import { LocalMatchDetailStore } from '../../../api/src/repositories/local-match-detail-store.js';
import { MatchDetailRefreshQueue } from '../../../api/src/repositories/match-detail-refresh-queue.js';
import { buildServingMatchStore } from '../../../api/src/repositories/serving-match-store.js';
import type { MatchSnapshotRepository } from '../../../api/src/repositories/match-snapshot-repository.js';
import {
  ApiFootballClient,
  ApiFootballQuotaExceededError,
  type ApiFootballFixtureItem
} from '../sources/api-football/api-football-client.js';
import { ApiFootballUsageLedger } from '../sources/api-football/api-football-usage-ledger.js';
import {
  runApiFootballMatchDetailJob
} from './api-football-match-detail-job.js';

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
  const statusShort = options.statusShort || 'FT';
  const isFinished = statusShort === 'FT' || statusShort === 'AET' || statusShort === 'PEN';
  const homeScore = options.homeScore !== undefined ? options.homeScore : isFinished ? 2 : null;
  const awayScore = options.awayScore !== undefined ? options.awayScore : isFinished ? 1 : null;

  return {
    fixture: {
      id,
      referee: options.referee || 'Referee Neutral',
      timezone: 'UTC',
      date: options.kickoffUtc || '2026-08-25T15:00:00+00:00',
      timestamp: 1787670000,
      venue: { id: 10, name: 'Neutral Stadium', city: 'Neutral City' },
      status: {
        long: isFinished ? 'Match Finished' : 'Not Started',
        short: statusShort,
        elapsed: isFinished ? 90 : null
      }
    },
    league: {
      id: 9999,
      name: 'Custom League 2026',
      country: 'Neutral Land',
      season: 2026,
      round: 'Regular Season - 1'
    },
    teams: {
      home: { id: 101, name: options.homeTeamName || 'Team Alpha', winner: homeScore !== null && awayScore !== null ? homeScore > awayScore : null },
      away: { id: 102, name: options.awayTeamName || 'Team Beta', winner: homeScore !== null && awayScore !== null ? awayScore > homeScore : null }
    },
    goals: {
      home: homeScore,
      away: awayScore
    },
    score: {
      halftime: { home: 1, away: 0 },
      fulltime: { home: homeScore, away: awayScore },
      extratime: { home: null, away: null },
      penalty: { home: null, away: null }
    },
    ...(options.events !== undefined ? { events: options.events } : {}),
    ...(options.statistics !== undefined ? { statistics: options.statistics } : {})
  };
}

function createCanonicalMatch(
  id: string,
  fixtureId?: number,
  options: {
    status?: LocalMatchStatus;
    homeName?: string;
    awayName?: string;
    homeScore?: number | null;
    awayScore?: number | null;
  } = {}
): LocalMatch {
  const status = options.status || 'completed';
  const isFinished = status === 'completed';
  const homeScore = options.homeScore !== undefined ? options.homeScore : isFinished ? 2 : null;
  const awayScore = options.awayScore !== undefined ? options.awayScore : isFinished ? 1 : null;

  return {
    id,
    competition: {
      id: 'custom-league-2026',
      name: 'Custom League 2026',
      type: 'club',
      season: '2026'
    },
    kickoffUtc: '2026-08-25T15:00:00.000Z',
    status,
    homeTeam: {
      id: 'team-alpha',
      name: options.homeName || 'Team Alpha'
    },
    awayTeam: {
      id: 'team-beta',
      name: options.awayName || 'Team Beta'
    },
    score: {
      home: homeScore,
      away: awayScore
    },
    venue: 'Neutral Stadium',
    round: 'Round 1',
    sourceRefs: fixtureId !== undefined
      ? [
          {
            sourceId: 'api-football',
            sourceMatchId: String(fixtureId),
            importedAt: '2026-08-25T12:00:00.000Z'
          }
        ]
      : [],
    updatedAt: '2026-08-25T17:00:00.000Z'
  };
}

async function seedServingStore(
  servingRoot: string,
  matches: LocalMatch[],
  now = new Date('2026-08-26T12:00:00.000Z')
): Promise<void> {
  await buildServingMatchStore({
    servingRoot,
    version: 'v1',
    snapshotId: `snap-${now.getTime()}`,
    generatedAt: now.toISOString(),
    importedAt: now.toISOString(),
    sources: [],
    matches
  });
}

describe('runApiFootballMatchDetailJob', () => {
  let tempDir: string;
  let fixedNow: Date;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'miraichi-match-detail-job-test-'));
    fixedNow = new Date('2026-08-26T12:00:00.000Z');
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it('returns idle status when no items are due in the queue', async () => {
    const queue = new MatchDetailRefreshQueue({ dataRoot: tempDir, now: () => fixedNow });
    const ledger = new ApiFootballUsageLedger({ dataRoot: tempDir, now: () => fixedNow });
    const detailStore = new LocalMatchDetailStore({ dataRoot: tempDir });
    const client = new ApiFootballClient({ dataRoot: tempDir, ledger, now: () => fixedNow });

    const result = await runApiFootballMatchDetailJob({
      dataRoot: tempDir,
      queue,
      ledger,
      detailStore,
      client,
      now: () => fixedNow
    });

    expect(result).toEqual({
      status: 'idle',
      itemsProcessed: 0,
      itemsCompleted: 0,
      itemsDeferred: 0,
      itemsFailed: 0,
      quotaUsedToday: 0
    });
  });

  it('drains due items, resolves provider fixture IDs server-side, and marks queue items completed', async () => {
    const match1 = createCanonicalMatch('match-alpha-01', 1001);
    const servingRoot = join(tempDir, 'serving');
    await seedServingStore(servingRoot, [match1], fixedNow);

    const queue = new MatchDetailRefreshQueue({ dataRoot: tempDir, now: () => fixedNow });
    await queue.enqueue('match-alpha-01', { now: fixedNow });

    const detailStore = new LocalMatchDetailStore({ dataRoot: tempDir });
    const ledger = new ApiFootballUsageLedger({ dataRoot: tempDir, now: () => fixedNow });
    const client = new ApiFootballClient({ dataRoot: tempDir, ledger, now: () => fixedNow });

    const mockFixture = createMockFixture(1001, {
      events: [
        {
          time: { elapsed: 23, extra: null },
          team: { id: 101, name: 'Team Alpha' },
          player: { id: 201, name: 'Striker A' },
          assist: { id: 202, name: 'Midfielder B' },
          type: 'Goal',
          detail: 'Normal Goal'
        }
      ],
      statistics: [
        {
          team: { id: 101, name: 'Team Alpha' },
          statistics: [
            { type: 'Corner Kicks', value: 5 },
            { type: 'Ball Possession', value: '55%' }
          ]
        },
        {
          team: { id: 102, name: 'Team Beta' },
          statistics: [
            { type: 'Corner Kicks', value: 3 },
            { type: 'Ball Possession', value: '45%' }
          ]
        }
      ]
    });

    const fetchSpy = vi.spyOn(client, 'fetchFixturesByIds').mockResolvedValue({
      get: 'fixtures',
      parameters: { ids: '1001' },
      errors: [],
      results: 1,
      response: [mockFixture]
    });

    const result = await runApiFootballMatchDetailJob({
      dataRoot: tempDir,
      servingRoot,
      queue,
      ledger,
      detailStore,
      client,
      now: () => fixedNow
    });

    expect(result.status).toBe('success');
    expect(result.itemsProcessed).toBe(1);
    expect(result.itemsCompleted).toBe(1);
    expect(result.itemsFailed).toBe(0);
    expect(result.itemsDeferred).toBe(0);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith([1001]);

    // Queue item must be completed
    const queueItem = await queue.getItem('match-alpha-01');
    expect(queueItem?.status).toBe('completed');

    // LocalMatchDetailStore must have upserted normalized detail
    const detail = await detailStore.getDetail('match-alpha-01');
    expect(detail).not.toBeNull();
    expect(detail?.match.id).toBe('match-alpha-01');
    expect(detail?.events).toHaveLength(1);
    expect(detail?.events[0]?.player).toBe('Striker A');
    expect(detail?.teamStats).toBeDefined();
    expect(detail?.teamStats?.find((s) => s.teamId === 'team-alpha')?.cornerKicks).toBe(5);
    expect(detail?.teamStats?.find((s) => s.teamId === 'team-alpha')?.possessionPercentage).toBe(55);
  });

  it('rejects a queued non-completed match without spending provider quota', async () => {
    const scheduled = createCanonicalMatch('match-scheduled-01', 1099, { status: 'scheduled' });
    const servingRoot = join(tempDir, 'serving');
    await seedServingStore(servingRoot, [scheduled], fixedNow);
    const queue = new MatchDetailRefreshQueue({ dataRoot: tempDir, now: () => fixedNow });
    await queue.enqueue(scheduled.id, { now: fixedNow });
    const ledger = new ApiFootballUsageLedger({ dataRoot: tempDir, now: () => fixedNow });
    const client = new ApiFootballClient({ dataRoot: tempDir, ledger, now: () => fixedNow });
    const fetchSpy = vi.spyOn(client, 'fetchFixturesByIds');

    const result = await runApiFootballMatchDetailJob({
      dataRoot: tempDir,
      servingRoot,
      queue,
      ledger,
      client,
      now: () => fixedNow
    });

    expect(result.status).toBe('failed');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect((await queue.getItem(scheduled.id))?.status).toBe('failed');
  });

  it('keeps a non-terminal provider response retryable and does not cache it', async () => {
    const match = createCanonicalMatch('match-provider-live-01', 1100);
    const servingRoot = join(tempDir, 'serving');
    await seedServingStore(servingRoot, [match], fixedNow);
    const queue = new MatchDetailRefreshQueue({ dataRoot: tempDir, now: () => fixedNow });
    await queue.enqueue(match.id, { now: fixedNow });
    const detailStore = new LocalMatchDetailStore({ dataRoot: tempDir });
    const ledger = new ApiFootballUsageLedger({ dataRoot: tempDir, now: () => fixedNow });
    const client = new ApiFootballClient({ dataRoot: tempDir, ledger, now: () => fixedNow });
    vi.spyOn(client, 'fetchFixturesByIds').mockResolvedValue({
      get: 'fixtures', parameters: { ids: '1100' }, errors: [], results: 1,
      response: [createMockFixture(1100, { statusShort: '2H', homeScore: 1, awayScore: 0 })]
    });

    const result = await runApiFootballMatchDetailJob({
      dataRoot: tempDir, servingRoot, queue, detailStore, ledger, client,
      now: () => fixedNow
    });

    expect(result.status).toBe('failed');
    expect(await detailStore.hasDetail(match.id)).toBe(false);
    const item = await queue.getItem(match.id);
    expect(item?.status).toBe('pending');
    expect(item?.lastError).toBe('provider_non_terminal_response');
    expect(Date.parse(item!.nextAttemptAt)).toBeGreaterThan(fixedNow.getTime());
  });

  it('batches and chunks up to 20 fixture IDs (e.g. 21 -> 20 + 1)', async () => {
    const matches: LocalMatch[] = [];
    const mockFixtures: ApiFootballFixtureItem[] = [];

    for (let i = 1; i <= 21; i++) {
      const matchId = `match-batch-${String(i).padStart(2, '0')}`;
      const fixtureId = 2000 + i;
      matches.push(createCanonicalMatch(matchId, fixtureId));
      mockFixtures.push(createMockFixture(fixtureId));
    }

    const servingRoot = join(tempDir, 'serving');
    await seedServingStore(servingRoot, matches, fixedNow);

    const queue = new MatchDetailRefreshQueue({ dataRoot: tempDir, now: () => fixedNow });
    for (const match of matches) {
      await queue.enqueue(match.id, { now: fixedNow });
    }

    const detailStore = new LocalMatchDetailStore({ dataRoot: tempDir });
    const ledger = new ApiFootballUsageLedger({ dataRoot: tempDir, now: () => fixedNow });
    const client = new ApiFootballClient({ dataRoot: tempDir, ledger, now: () => fixedNow });

    const fetchSpy = vi.spyOn(client, 'fetchFixturesByIds').mockImplementation(async (ids) => {
      const idSet = new Set(ids);
      const filtered = mockFixtures.filter((f) => idSet.has(f.fixture.id));
      return {
        get: 'fixtures',
        parameters: { ids: ids.join('-') },
        errors: [],
        results: filtered.length,
        response: filtered
      };
    });

    const result = await runApiFootballMatchDetailJob({
      dataRoot: tempDir,
      servingRoot,
      queue,
      ledger,
      detailStore,
      client,
      batchSize: 21,
      now: () => fixedNow
    });

    expect(result.status).toBe('success');
    expect(result.itemsProcessed).toBe(21);
    expect(result.itemsCompleted).toBe(21);

    // Verify chunking: 2 calls to client.fetchFixturesByIds
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[0]?.[0]).toHaveLength(20);
    expect(fetchSpy.mock.calls[1]?.[0]).toHaveLength(1);

    // All 21 items completed in queue and detailStore
    for (const match of matches) {
      const item = await queue.getItem(match.id);
      expect(item?.status).toBe('completed');
      const detail = await detailStore.getDetail(match.id);
      expect(detail).not.toBeNull();
    }
  }, 20_000);

  it('marks due items quota_deferred and produces 0 provider requests when quota ceiling is exhausted', async () => {
    const match1 = createCanonicalMatch('match-alpha-01', 1001);
    const servingRoot = join(tempDir, 'serving');
    await seedServingStore(servingRoot, [match1], fixedNow);

    const queue = new MatchDetailRefreshQueue({ dataRoot: tempDir, now: () => fixedNow });
    await queue.enqueue('match-alpha-01', { now: fixedNow });

    const detailStore = new LocalMatchDetailStore({ dataRoot: tempDir });
    const ledger = new ApiFootballUsageLedger({
      dataRoot: tempDir,
      hardCeiling: 1,
      now: () => fixedNow
    });
    // Exhaust quota
    await ledger.reserveSlot();

    const client = new ApiFootballClient({ dataRoot: tempDir, ledger, now: () => fixedNow });
    const fetchSpy = vi.spyOn(client, 'fetchFixturesByIds');

    const result = await runApiFootballMatchDetailJob({
      dataRoot: tempDir,
      servingRoot,
      queue,
      ledger,
      detailStore,
      client,
      now: () => fixedNow
    });

    expect(result.status).toBe('skipped');
    expect(result.itemsProcessed).toBe(0);
    expect(result.itemsCompleted).toBe(0);
    expect(result.itemsDeferred).toBe(1);
    expect(result.itemsFailed).toBe(0);

    // Provider request must NOT be made
    expect(fetchSpy).not.toHaveBeenCalled();

    // Queue item status must be quota_deferred
    const item = await queue.getItem('match-alpha-01');
    expect(item?.status).toBe('quota_deferred');
    expect(item?.lastError).toBe('quota_deferred');
    expect(Date.parse(item!.nextAttemptAt)).toBeGreaterThan(fixedNow.getTime());
  });

  it('records retryable failure and preserves existing cached detail when provider fails', async () => {
    const match1 = createCanonicalMatch('match-alpha-01', 1001);
    const servingRoot = join(tempDir, 'serving');
    await seedServingStore(servingRoot, [match1], fixedNow);

    // Seed pre-existing valid detail in detailStore
    const detailStore = new LocalMatchDetailStore({ dataRoot: tempDir });
    const existingDetail: LocalMatchDetail = {
      match: {
        id: match1.id,
        competition: match1.competition,
        kickoffUtc: match1.kickoffUtc,
        status: match1.status,
        homeTeam: match1.homeTeam,
        awayTeam: match1.awayTeam,
        score: match1.score,
        sourceRefs: [],
        updatedAt: match1.updatedAt
      },
      status: 'completed',
      elapsedMinute: 90,
      events: [
        {
          minute: 10,
          type: 'goal',
          label: 'Goal - Old Scorer',
          player: 'Old Scorer'
        }
      ],
      updatedAt: '2026-08-20T10:00:00.000Z'
    };
    await detailStore.upsertDetail(existingDetail);

    const queue = new MatchDetailRefreshQueue({ dataRoot: tempDir, now: () => fixedNow });
    await queue.enqueue('match-alpha-01', { maxAttempts: 3, now: fixedNow });

    const ledger = new ApiFootballUsageLedger({ dataRoot: tempDir, now: () => fixedNow });
    const client = new ApiFootballClient({ dataRoot: tempDir, ledger, now: () => fixedNow });

    // Mock network/500 error
    const sensitiveFailure = 'https://v3.football.api-sports.io key=secret-key-123 fixture=1001';
    vi.spyOn(client, 'fetchFixturesByIds').mockRejectedValue(new Error(sensitiveFailure));
    const logs: string[] = [];

    const result = await runApiFootballMatchDetailJob({
      dataRoot: tempDir,
      servingRoot,
      queue,
      ledger,
      detailStore,
      client,
      logger: (message) => logs.push(message),
      now: () => fixedNow
    });

    expect(result.status).toBe('failed');
    expect(result.itemsProcessed).toBe(1);
    expect(result.itemsCompleted).toBe(0);
    expect(result.itemsFailed).toBe(1);

    // Queue item marked as pending retry with future nextAttemptAt
    const queueItem = await queue.getItem('match-alpha-01');
    expect(queueItem?.status).toBe('pending');
    expect(queueItem?.attempts).toBe(1);
    expect(queueItem?.lastError).toBe('provider_request_failed');
    expect(new Date(queueItem!.nextAttemptAt).getTime()).toBeGreaterThan(fixedNow.getTime());

    // Existing cached detail in store MUST NOT be deleted or corrupted
    const preservedDetail = await detailStore.getDetail('match-alpha-01');
    expect(preservedDetail).not.toBeNull();
    expect(preservedDetail?.events[0]?.player).toBe('Old Scorer');
    expect(logs.join('\n')).not.toContain('secret-key-123');
    expect(JSON.stringify(result)).not.toContain('1001');
  });

  it('marks match not found in serving store as permanent failure without calling provider', async () => {
    const queue = new MatchDetailRefreshQueue({ dataRoot: tempDir, now: () => fixedNow });
    await queue.enqueue('match-nonexistent-01', { now: fixedNow });

    const emptyRepo: MatchSnapshotRepository = {
      listMatches: async () => ({ matches: [], snapshot: { snapshotId: '', generatedAt: '', importedAt: '', matchCount: 0, competitions: [], sources: [], freshness: 'missing', warnings: [] } }),
      findById: async () => null,
      getStatus: async () => ({ snapshotId: '', generatedAt: '', importedAt: '', matchCount: 0, competitions: [], sources: [], freshness: 'missing', warnings: [] })
    };

    const detailStore = new LocalMatchDetailStore({ dataRoot: tempDir });
    const ledger = new ApiFootballUsageLedger({ dataRoot: tempDir, now: () => fixedNow });
    const client = new ApiFootballClient({ dataRoot: tempDir, ledger, now: () => fixedNow });
    const fetchSpy = vi.spyOn(client, 'fetchFixturesByIds');

    const result = await runApiFootballMatchDetailJob({
      dataRoot: tempDir,
      repository: emptyRepo,
      queue,
      ledger,
      detailStore,
      client,
      now: () => fixedNow
    });

    expect(result.status).toBe('failed');
    expect(result.itemsProcessed).toBe(1);
    expect(result.itemsFailed).toBe(1);
    expect(result.itemsCompleted).toBe(0);

    expect(fetchSpy).not.toHaveBeenCalled();

    const queueItem = await queue.getItem('match-nonexistent-01');
    expect(queueItem?.status).toBe('failed');
    expect(queueItem?.lastError).toBe('match_not_found');

    const dueItems = await queue.getDueItems(10, fixedNow);
    expect(dueItems).toHaveLength(0);
  });

  it('caches a terminal coverage warning when provider fixture ID is unavailable', async () => {
    const matchWithoutRef = createCanonicalMatch('match-no-ref-01'); // no sourceRefs
    const servingRoot = join(tempDir, 'serving');
    await seedServingStore(servingRoot, [matchWithoutRef], fixedNow);

    const queue = new MatchDetailRefreshQueue({ dataRoot: tempDir, now: () => fixedNow });
    await queue.enqueue('match-no-ref-01', { now: fixedNow });

    const detailStore = new LocalMatchDetailStore({ dataRoot: tempDir });
    const ledger = new ApiFootballUsageLedger({ dataRoot: tempDir, now: () => fixedNow });
    const client = new ApiFootballClient({ dataRoot: tempDir, ledger, now: () => fixedNow });
    const fetchSpy = vi.spyOn(client, 'fetchFixturesByIds');

    const result = await runApiFootballMatchDetailJob({
      dataRoot: tempDir,
      servingRoot,
      queue,
      ledger,
      detailStore,
      client,
      now: () => fixedNow
    });

    expect(result.status).toBe('success');
    expect(result.itemsProcessed).toBe(1);
    expect(result.itemsCompleted).toBe(1);
    expect(result.itemsFailed).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();

    const queueItem = await queue.getItem('match-no-ref-01');
    expect(queueItem?.status).toBe('completed');
    const unavailable = await detailStore.getDetail('match-no-ref-01');
    expect(unavailable?.warnings).toContain('provider_detail_unavailable');
    expect(unavailable?.events).toEqual([]);

    const dueItems = await queue.getDueItems(10, fixedNow);
    expect(dueItems).toHaveLength(0);
  });

  it('caches terminal coverage warning when a fixture is missing from provider response', async () => {
    const match1 = createCanonicalMatch('match-alpha-01', 1001);
    const match2 = createCanonicalMatch('match-alpha-02', 1002);
    const servingRoot = join(tempDir, 'serving');
    await seedServingStore(servingRoot, [match1, match2], fixedNow);

    const queue = new MatchDetailRefreshQueue({ dataRoot: tempDir, now: () => fixedNow });
    await queue.enqueue('match-alpha-01', { now: fixedNow });
    await queue.enqueue('match-alpha-02', { now: fixedNow });

    const detailStore = new LocalMatchDetailStore({ dataRoot: tempDir });
    const ledger = new ApiFootballUsageLedger({ dataRoot: tempDir, now: () => fixedNow });
    const client = new ApiFootballClient({ dataRoot: tempDir, ledger, now: () => fixedNow });

    // Provider returns fixture 1001 but NOT 1002
    vi.spyOn(client, 'fetchFixturesByIds').mockResolvedValue({
      get: 'fixtures',
      parameters: { ids: '1001-1002' },
      errors: [],
      results: 1,
      response: [createMockFixture(1001)]
    });

    const result = await runApiFootballMatchDetailJob({
      dataRoot: tempDir,
      servingRoot,
      queue,
      ledger,
      detailStore,
      client,
      now: () => fixedNow
    });

    expect(result.status).toBe('success');
    expect(result.itemsProcessed).toBe(2);
    expect(result.itemsCompleted).toBe(2);
    expect(result.itemsFailed).toBe(0);

    const item1 = await queue.getItem('match-alpha-01');
    expect(item1?.status).toBe('completed');

    const item2 = await queue.getItem('match-alpha-02');
    expect(item2?.status).toBe('completed');

    expect(await detailStore.hasDetail('match-alpha-01')).toBe(true);
    expect((await detailStore.getDetail('match-alpha-02'))?.warnings)
      .toContain('provider_detail_unavailable');
  });

  it('marks chunk quota_deferred when client throws ApiFootballQuotaExceededError', async () => {
    const match1 = createCanonicalMatch('match-alpha-01', 1001);
    const servingRoot = join(tempDir, 'serving');
    await seedServingStore(servingRoot, [match1], fixedNow);

    const queue = new MatchDetailRefreshQueue({ dataRoot: tempDir, now: () => fixedNow });
    await queue.enqueue('match-alpha-01', { now: fixedNow });

    const detailStore = new LocalMatchDetailStore({ dataRoot: tempDir });
    const ledger = new ApiFootballUsageLedger({ dataRoot: tempDir, now: () => fixedNow });
    const client = new ApiFootballClient({ dataRoot: tempDir, ledger, now: () => fixedNow });

    vi.spyOn(client, 'fetchFixturesByIds').mockRejectedValue(
      new ApiFootballQuotaExceededError('Api-Football quota exhausted for today', 85, 85)
    );

    const result = await runApiFootballMatchDetailJob({
      dataRoot: tempDir,
      servingRoot,
      queue,
      ledger,
      detailStore,
      client,
      now: () => fixedNow
    });

    expect(result.status).toBe('skipped');
    expect(result.itemsProcessed).toBe(1);
    expect(result.itemsDeferred).toBe(1);
    expect(result.itemsCompleted).toBe(0);

    const item = await queue.getItem('match-alpha-01');
    expect(item?.status).toBe('quota_deferred');
    expect(item?.lastError).toBe('quota_deferred');
    expect(Date.parse(item!.nextAttemptAt)).toBeGreaterThan(fixedNow.getTime());
  });

  it('never leaks API keys, raw URLs, or secret credentials in logs and results', async () => {
    const sensitiveKey = 'super-secret-provider-key-998877';
    const match1 = createCanonicalMatch('match-alpha-01', 1001);
    const servingRoot = join(tempDir, 'serving');
    await seedServingStore(servingRoot, [match1], fixedNow);

    const queue = new MatchDetailRefreshQueue({ dataRoot: tempDir, now: () => fixedNow });
    await queue.enqueue('match-alpha-01', { now: fixedNow });

    const detailStore = new LocalMatchDetailStore({ dataRoot: tempDir });
    const ledger = new ApiFootballUsageLedger({ dataRoot: tempDir, now: () => fixedNow });
    const client = new ApiFootballClient({
      apiKey: sensitiveKey,
      dataRoot: tempDir,
      ledger,
      now: () => fixedNow
    });

    const logs: string[] = [];
    const logger = (msg: string) => {
      logs.push(msg);
    };

    vi.spyOn(client, 'fetchFixturesByIds').mockResolvedValue({
      get: 'fixtures',
      parameters: { ids: '1001' },
      errors: [],
      results: 1,
      response: [createMockFixture(1001)]
    });

    const result = await runApiFootballMatchDetailJob({
      dataRoot: tempDir,
      servingRoot,
      queue,
      ledger,
      detailStore,
      client,
      logger,
      now: () => fixedNow
    });

    expect(result.status).toBe('success');

    // Verify sensitive API key is nowhere in logs or results or store
    const logDump = logs.join('\n');
    expect(logDump).not.toContain(sensitiveKey);

    const resultDump = JSON.stringify(result);
    expect(resultDump).not.toContain(sensitiveKey);

    const detail = await detailStore.getDetail('match-alpha-01');
    const detailDump = JSON.stringify(detail);
    expect(detailDump).not.toContain(sensitiveKey);
    expect(detailDump).not.toContain('v3.football.api-sports.io');
  });
});
