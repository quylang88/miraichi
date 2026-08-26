import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { LocalMatch } from '@miraichi/shared';
import { LocalMatchDetailStore } from '../../../api/src/repositories/local-match-detail-store.js';
import { MatchDetailRefreshQueue } from '../../../api/src/repositories/match-detail-refresh-queue.js';
import type { MatchSnapshotRepository } from '../../../api/src/repositories/match-snapshot-repository.js';
import { adaptSportScoreMatchDetail } from '../sources/sportscore/sportscore-match-detail-adapter.js';
import { runSportScoreMatchDetailJob } from './sportscore-match-detail-job.js';

const observedAt = '2026-08-27T12:00:00.000Z';

function match(id: string, status: LocalMatch['status'], sourceSlug?: string): LocalMatch {
  return {
    id,
    competition: {
      id: 'custom-league',
      name: 'Custom League',
      type: 'club',
      season: '2026-27'
    },
    kickoffUtc: '2026-08-27T09:00:00.000Z',
    status,
    homeTeam: { id: 'team-alpha', name: 'Alpha FC' },
    awayTeam: { id: 'team-beta', name: 'Beta United' },
    score: status === 'completed'
      ? { home: 2, away: 1 }
      : { home: null, away: null },
    sourceRefs: sourceSlug === undefined ? [] : [{
      sourceId: 'sportscore',
      sourceMatchId: sourceSlug,
      importedAt: '2026-08-27T11:00:00.000Z'
    }],
    updatedAt: '2026-08-27T11:00:00.000Z'
  };
}

function terminalResponse() {
  return {
    match: {
      slug: 'alpha-fc-vs-beta-united',
      status: 'finished',
      referee: 'Referee One',
      elapsed: 90,
      score: {
        halftime: { home: 1, away: 0 },
        fulltime: { home: 2, away: 1 },
        extratime: { home: null, away: null },
        penalty: { home: null, away: null }
      },
      events: [
        {
          type: 'goal',
          minute: 27,
          side: 'home',
          participant: 'Alpha Striker',
          assist: 'Alpha Winger'
        },
        {
          type: 'yellow_card',
          minute: 64,
          side: 'away',
          participant: 'Beta Defender'
        },
        {
          type: 'substitution',
          minute: 70,
          side: 'home',
          participant: 'Alpha Substitute',
          detail: 'Alpha Midfielder off'
        }
      ],
      statistics: {
        home: {
          corners: 7,
          yellowCards: 1,
          redCards: 0,
          totalShots: 14,
          shotsOnGoal: 6,
          possession: '54%',
          fouls: 9,
          offsides: 2
        },
        away: {
          corners: 4,
          yellowCards: 3,
          redCards: 0,
          totalShots: 10,
          shotsOnGoal: 4,
          possession: '46%',
          fouls: 13,
          offsides: 1
        }
      },
      lineups: {
        home: {
          formation: '4-3-3',
          starters: [{ name: 'Alpha Goalkeeper', number: 1, position: 'GK' }],
          substitutes: [{ name: 'Alpha Substitute', number: 18, position: 'MF' }]
        },
        away: {
          formation: '4-2-3-1',
          starters: [{ name: 'Beta Goalkeeper', number: 13, position: 'GK' }],
          substitutes: []
        }
      }
    }
  };
}

function repository(matches: LocalMatch[]): MatchSnapshotRepository {
  const byId = new Map(matches.map((item) => [item.id, item]));
  return {
    findById: async (id) => byId.get(id) ?? null,
    listMatches: async () => ({
      matches,
      snapshot: {
        snapshotId: 'test',
        generatedAt: observedAt,
        importedAt: observedAt,
        matchCount: matches.length,
        competitions: [],
        sources: [],
        freshness: 'fresh',
        warnings: []
      }
    }),
    getStatus: async () => ({
      snapshotId: 'test',
      generatedAt: observedAt,
      importedAt: observedAt,
      matchCount: matches.length,
      competitions: [],
      sources: [],
      freshness: 'fresh',
      warnings: []
    })
  };
}

describe('SportScore terminal match detail', () => {
  let dataRoot: string;
  const now = new Date(observedAt);

  beforeEach(async () => {
    dataRoot = await mkdtemp(join(tmpdir(), 'miraichi-sportscore-detail-'));
  });

  afterEach(async () => {
    await rm(dataRoot, { recursive: true, force: true });
  });

  it('maps terminal events, formations, lineups, score breakdown and basic betting-view stats', () => {
    const detail = adaptSportScoreMatchDetail({
      response: terminalResponse(),
      canonicalMatch: match('match-completed', 'completed', 'alpha-fc-vs-beta-united'),
      expectedSlug: 'alpha-fc-vs-beta-united',
      observedAt
    });

    expect(detail.events).toEqual([
      expect.objectContaining({
        minute: 27,
        teamId: 'team-alpha',
        type: 'goal',
        player: 'Alpha Striker',
        assist: 'Alpha Winger'
      }),
      expect.objectContaining({
        minute: 64,
        teamId: 'team-beta',
        type: 'card',
        player: 'Beta Defender'
      }),
      expect.objectContaining({
        minute: 70,
        type: 'substitution',
        player: 'Alpha Substitute'
      })
    ]);
    expect(detail.scoreBreakdown?.halftime).toEqual({ home: 1, away: 0 });
    expect(detail.lineups?.[0]).toMatchObject({
      teamId: 'team-alpha',
      formation: '4-3-3',
      starters: [{ name: 'Alpha Goalkeeper', shirtNumber: 1, position: 'GK' }]
    });
    expect(detail.teamStats?.[0]).toMatchObject({
      teamId: 'team-alpha',
      cornerKicks: 7,
      yellowCards: 1,
      totalShots: 14,
      shotsOnGoal: 6,
      possessionPercentage: 54,
      fouls: 9,
      offsides: 2
    });
    expect(JSON.stringify(detail)).not.toContain('sourceMatchId');
  });

  it('keeps unavailable optional statistics as null instead of inventing zeroes', () => {
    const response = terminalResponse();
    response.match.statistics = {
      home: { corners: 0 },
      away: {}
    } as typeof response.match.statistics;

    const detail = adaptSportScoreMatchDetail({
      response,
      canonicalMatch: match('match-completed', 'completed', 'alpha-fc-vs-beta-united'),
      expectedSlug: 'alpha-fc-vs-beta-united',
      observedAt
    });

    expect(detail.teamStats?.[0]).toMatchObject({
      cornerKicks: 0,
      yellowCards: null,
      redCards: null,
      totalShots: null,
      shotsOnGoal: null,
      possessionPercentage: null,
      fouls: null,
      offsides: null
    });
    expect(detail.teamStats?.[1]?.cornerKicks).toBeNull();
    expect(detail.warnings).toContain('statistics_partial');
  });

  it('spends one request only for completed queue items and never requests scheduled or in-play detail', async () => {
    const scheduled = match('match-scheduled', 'scheduled', 'scheduled-match');
    const inPlay = {
      ...match('match-in-play', 'scheduled', 'in-play-match'),
      status: 'in_play'
    } as unknown as LocalMatch;
    const completed = match('match-completed', 'completed', 'alpha-fc-vs-beta-united');
    const queue = new MatchDetailRefreshQueue({ dataRoot, now: () => now });
    const detailStore = new LocalMatchDetailStore({ dataRoot });
    await queue.enqueue(scheduled.id, { now });
    await queue.enqueue(inPlay.id, { now });
    await queue.enqueue(completed.id, { now });
    const client = { getMatch: vi.fn(async () => terminalResponse()) };

    const result = await runSportScoreMatchDetailJob({
      dataRoot,
      repository: repository([scheduled, inPlay, completed]),
      queue,
      detailStore,
      client,
      batchSize: 3,
      maxRequestsPerRun: 1,
      now: () => now
    });

    expect(client.getMatch).toHaveBeenCalledTimes(1);
    expect(client.getMatch).toHaveBeenCalledWith({
      slug: 'alpha-fc-vs-beta-united',
      maxRetries: 0
    });
    expect((await queue.getItem(scheduled.id))?.lastError).toBe('match_not_completed');
    expect((await queue.getItem(scheduled.id))?.status).toBe('failed');
    expect((await queue.getItem(inPlay.id))?.lastError).toBe('match_not_completed');
    expect((await queue.getItem(inPlay.id))?.status).toBe('failed');
    expect((await queue.getItem(completed.id))?.status).toBe('completed');
    expect((await detailStore.getDetail(completed.id))?.events).toHaveLength(3);
    expect(result).toMatchObject({
      status: 'partial',
      requestsMade: 1,
      itemsCompleted: 1,
      itemsFailed: 2
    });
  });

  it('negative-caches unavailable terminal coverage so later runs spend no requests', async () => {
    const completed = match('match-no-detail', 'completed', 'alpha-fc-vs-beta-united');
    const queue = new MatchDetailRefreshQueue({ dataRoot, now: () => now });
    const detailStore = new LocalMatchDetailStore({ dataRoot });
    await queue.enqueue(completed.id, { now });
    const client = { getMatch: vi.fn(async () => ({})) };

    const first = await runSportScoreMatchDetailJob({
      dataRoot,
      repository: repository([completed]),
      queue,
      detailStore,
      client,
      now: () => now
    });
    const second = await runSportScoreMatchDetailJob({
      dataRoot,
      repository: repository([completed]),
      queue,
      detailStore,
      client,
      now: () => now
    });

    expect(first.status).toBe('success');
    expect(second.status).toBe('idle');
    expect(client.getMatch).toHaveBeenCalledTimes(1);
    expect((await queue.getItem(completed.id))?.status).toBe('completed');
    expect((await detailStore.getDetail(completed.id))?.warnings)
      .toContain('provider_detail_unavailable');
  });

  it('does not publish a provider response that is still live', async () => {
    const completed = match('match-source-still-live', 'completed', 'alpha-fc-vs-beta-united');
    const queue = new MatchDetailRefreshQueue({ dataRoot, now: () => now });
    const detailStore = new LocalMatchDetailStore({ dataRoot });
    await queue.enqueue(completed.id, { maxAttempts: 2, now });
    const client = {
      getMatch: vi.fn(async () => ({
        match: { ...terminalResponse().match, status: 'live' }
      }))
    };

    const result = await runSportScoreMatchDetailJob({
      dataRoot,
      repository: repository([completed]),
      queue,
      detailStore,
      client,
      retryDelayMs: 60_000,
      now: () => now
    });

    expect(result.status).toBe('failed');
    expect(await detailStore.getDetail(completed.id)).toBeNull();
    expect(await queue.getItem(completed.id)).toMatchObject({
      status: 'pending',
      attempts: 1,
      lastError: 'provider_non_terminal_response'
    });
  });
});
