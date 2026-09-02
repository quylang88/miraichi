import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SPORTSCORE_COMPETITION_REGISTRY } from '../../packages/config/src/index.js';
import type {
  LocalMatchDetail,
  LocalMatchFeedResponse
} from '../../packages/shared/src/index.js';
import { ServingMatchStoreRepository } from '../../apps/api/src/repositories/serving-match-store-repository.js';
import { readServingMatchStoreSnapshot } from '../../apps/api/src/repositories/serving-match-store.js';
import { LocalMatchDetailStore } from '../../apps/api/src/repositories/local-match-detail-store.js';
import { MatchDetailRefreshQueue } from '../../apps/api/src/repositories/match-detail-refresh-queue.js';
import { handleMatches } from '../../apps/api/src/routes/matches.js';
import { handleMatchDetail } from '../../apps/api/src/routes/match-detail.js';
import { runSportScoreDailySyncJob } from '../../apps/worker/src/jobs/sportscore-daily-sync-job.js';
import { runSportScoreMatchDetailJob } from '../../apps/worker/src/jobs/sportscore-match-detail-job.js';
import { runSportScorePublicationJob } from '../../apps/worker/src/jobs/sportscore-publication-job.js';
import { SportScoreClientError } from '../../apps/worker/src/sources/sportscore/sportscore-client.js';
import {
  SportScoreSourceLedger,
  sportScoreDailyCheckpointKey
} from '../../apps/worker/src/sources/sportscore/sportscore-source-ledger.js';
import { renderMatchDetailView } from '../../apps/web/src/components/match-detail-view.js';
import { renderMatchesScreen } from '../../apps/web/src/components/screens/matches-screen.js';
import { renderTodayScreen } from '../../apps/web/src/components/screens/today-screen.js';
import { createTranslator } from '../../apps/web/src/services/i18n-service.js';
import type { MatchFeedViewState } from '../../apps/web/src/services/match-feed-service.js';

const roots: string[] = [];
const targetDate = '2026-08-27';

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'miraichi-sportscore-integration-'));
  roots.push(root);
  return root;
}

function fixture(index: number, status: 'scheduled' | 'finished' | 'live') {
  const suffix = String(index).padStart(2, '0');
  return {
    home: `Mock Home ${suffix}`,
    away: `Mock Away ${suffix}`,
    home_score: status === 'finished' ? 2 : 0,
    away_score: status === 'finished' ? 1 : 0,
    status,
    status_text: status === 'finished' ? 'FT' : status,
    time: `${targetDate}T18:00:00Z`,
    slug: `mock-home-${suffix}-vs-mock-away-${suffix}`
  };
}

function fixtureResponse(index: number, status: 'scheduled' | 'finished' = 'scheduled') {
  return {
    sport: 'football',
    count: 1,
    matches: [fixture(index, status)]
  };
}

function terminalDetailResponse(slug: string) {
  return {
    match: {
      slug,
      status: 'finished',
      referee: 'Integration Referee',
      elapsed: 90,
      score: {
        halftime: { home: 1, away: 0 },
        fulltime: { home: 2, away: 1 },
        extratime: { home: null, away: null },
        penalty: { home: null, away: null }
      },
      events: [{
        type: 'goal',
        minute: 27,
        side: 'home',
        participant: 'Mock Striker',
        assist: 'Mock Winger'
      }],
      statistics: {
        home: { corners: 5, yellowCards: 0, redCards: 0, fouls: 9, offsides: 2 },
        away: { corners: 3, yellowCards: 1, redCards: 0, fouls: 12 }
      },
      lineups: {
        home: {
          formation: '4-3-3',
          starters: [{ name: 'Mock Home Keeper', number: 1, position: 'GK' }],
          substitutes: []
        },
        away: {
          formation: '4-4-2',
          starters: [{ name: 'Mock Away Keeper', number: 1, position: 'GK' }],
          substitutes: []
        }
      }
    }
  };
}

function responseMock() {
  return {
    statusCode: 0,
    headers: {} as Record<string, string>,
    body: '',
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    writeHead(statusCode: number, headers?: Record<string, string>) {
      this.statusCode = statusCode;
      if (headers) this.headers = { ...this.headers, ...headers };
    },
    end(body?: unknown) {
      this.body = typeof body === 'string' ? body : '';
    }
  };
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
}, 30_000);

describe('SportScore large source boundary', () => {
  it('hydrates all 50 equal competitions, resumes checkpoints, recovers from 503, serves sanitized API/detail, and renders attribution', async () => {
    const dataRoot = await makeRoot();
    const calls: Array<{ date: string; competition: string; limit?: number; maxRetries?: number }> = [];
    const fixtureClient = {
      getFixtures: vi.fn(async (request: {
        date: string;
        competition: string;
        limit?: number;
        maxRetries?: number;
      }) => {
        calls.push(request);
        const index = SPORTSCORE_COMPETITION_REGISTRY.findIndex((entry) => (
          entry.providerCompetitionSlug === request.competition
        ));
        if (index < 0) throw new Error('Unexpected competition slug in integration mock.');
        return fixtureResponse(index);
      })
    };

    const runTimes = [
      '2026-08-27T10:00:00.000Z',
      '2026-08-27T10:01:00.000Z',
      '2026-08-27T10:02:00.000Z'
    ];
    const runResults = [];
    for (const runTime of runTimes) {
      runResults.push(await runSportScoreDailySyncJob({
        dataRoot,
        client: fixtureClient,
        registry: SPORTSCORE_COMPETITION_REGISTRY,
        targetDate,
        now: () => new Date(runTime),
        resolveSeason: () => '2026-27',
        maxRequestsPerRun: 17,
        maxConcurrency: 4
      }));
    }
    const restartedIdle = await runSportScoreDailySyncJob({
      dataRoot,
      client: fixtureClient,
      registry: SPORTSCORE_COMPETITION_REGISTRY,
      targetDate,
      now: () => new Date('2026-08-27T10:03:00.000Z'),
      resolveSeason: () => '2026-27',
      maxRequestsPerRun: 17,
      maxConcurrency: 4
    });

    expect(runResults.map((result) => result.requestsSucceeded)).toEqual([17, 17, 16]);
    expect(restartedIdle).toMatchObject({ status: 'idle', requestsAttempted: 0 });
    expect(calls).toHaveLength(50);
    expect(new Set(calls.map((call) => call.competition))).toEqual(new Set(
      SPORTSCORE_COMPETITION_REGISTRY.map((entry) => entry.providerCompetitionSlug)
    ));
    expect(calls.every((call) => (
      call.date === targetDate && call.limit === 200 && call.maxRetries === 0
    ))).toBe(true);

    const ledgerAfterRestart = await new SportScoreSourceLedger({ dataRoot }).getState();
    expect(Object.keys(ledgerAfterRestart.daily)).toHaveLength(50);
    for (const entry of SPORTSCORE_COMPETITION_REGISTRY) {
      expect(ledgerAfterRestart.daily[
        sportScoreDailyCheckpointKey(entry.competitionId, targetDate)
      ]?.completedAt).toBeDefined();
    }

    const initialServing = await readServingMatchStoreSnapshot(path.join(dataRoot, 'serving'));
    expect(initialServing.matches).toHaveLength(50);
    expect(new Set(initialServing.matches.map((match) => match.competition.id)).size).toBe(50);

    const terminalOnlyResult = await runSportScorePublicationJob({
      dataRoot,
      runId: 'integration-terminal-only-proof',
      competitionEntry: SPORTSCORE_COMPETITION_REGISTRY[0]!,
      season: '2026-27',
      response: {
        sport: 'football',
        count: 2,
        matches: [
          fixture(0, 'scheduled'),
          {
            ...fixture(99, 'live'),
            home: 'Hidden Live Home',
            away: 'Hidden Live Away',
            events: [{ minute: 82, type: 'goal', player: 'Hidden Live Player' }]
          }
        ]
      },
      observedAt: '2026-08-27T10:05:00.000Z'
    });
    const afterLiveAttempt = await readServingMatchStoreSnapshot(path.join(dataRoot, 'serving'));
    expect(terminalOnlyResult.ignoredInPlayCount).toBe(1);
    expect(afterLiveAttempt.matches).toHaveLength(50);
    expect(JSON.stringify(afterLiveAttempt)).not.toContain('Hidden Live');

    const firstEntry = SPORTSCORE_COMPETITION_REGISTRY[0]!;
    const failingClient = {
      getFixtures: vi.fn(async () => {
        throw new SportScoreClientError('http_status', 'mock 503', 503);
      })
    };
    const failedTerminalCheck = await runSportScoreDailySyncJob({
      dataRoot,
      client: failingClient,
      registry: [firstEntry],
      targetDate,
      now: () => new Date('2026-08-27T20:15:00.000Z'),
      resolveSeason: () => '2026-27'
    });
    const immediateClient = { getFixtures: vi.fn(async () => fixtureResponse(0, 'finished')) };
    const immediateRestart = await runSportScoreDailySyncJob({
      dataRoot,
      client: immediateClient,
      registry: [firstEntry],
      targetDate,
      now: () => new Date('2026-08-27T20:20:00.000Z'),
      resolveSeason: () => '2026-27'
    });
    const recoveryClient = { getFixtures: vi.fn(async () => fixtureResponse(0, 'finished')) };
    const recoveredTerminalCheck = await runSportScoreDailySyncJob({
      dataRoot,
      client: recoveryClient,
      registry: [firstEntry],
      targetDate,
      now: () => new Date('2026-08-27T20:30:00.000Z'),
      resolveSeason: () => '2026-27'
    });

    expect(failedTerminalCheck).toMatchObject({ status: 'partial', requestsFailed: 1 });
    expect(immediateRestart).toMatchObject({ status: 'idle', requestsAttempted: 0 });
    expect(immediateClient.getFixtures).not.toHaveBeenCalled();
    expect(recoveredTerminalCheck).toMatchObject({ requestsSucceeded: 1, terminalWindowsChecked: 1 });

    const repository = new ServingMatchStoreRepository({
      servingRoot: path.join(dataRoot, 'serving'),
      now: () => new Date('2026-08-27T20:31:00.000Z')
    });
    const matchResponse = responseMock();
    await handleMatches(
      { url: `/api/v1/matches?date=${targetDate}`, method: 'GET' } as import('node:http').IncomingMessage,
      matchResponse as unknown as import('node:http').ServerResponse,
      { repository }
    );
    expect(matchResponse.statusCode).toBe(200);
    const publicFeed = JSON.parse(matchResponse.body) as LocalMatchFeedResponse;
    expect(publicFeed.matches).toHaveLength(50);
    expect(publicFeed.snapshot.competitions).toHaveLength(50);
    expect(publicFeed.snapshot.sources).toHaveLength(1);
    expect(publicFeed.snapshot.sources[0]?.sourceId).toBe('sportscore');
    expect(matchResponse.body).not.toContain('sourceMatchId');
    expect(matchResponse.body).not.toContain('sourceUrl');

    const completedMatch = publicFeed.matches.find((match) => (
      match.competition.id === firstEntry.competitionId
    ));
    expect(completedMatch?.status).toBe('completed');
    const pendingResponse = responseMock();
    const queue = new MatchDetailRefreshQueue({
      dataRoot,
      now: () => new Date('2026-08-27T20:31:00.000Z')
    });
    const detailStore = new LocalMatchDetailStore({ dataRoot });
    await handleMatchDetail(
      { url: `/api/v1/matches/detail?id=${completedMatch!.id}`, method: 'GET' } as import('node:http').IncomingMessage,
      pendingResponse as unknown as import('node:http').ServerResponse,
      { repository, queue, detailStore, dataRoot }
    );
    expect(pendingResponse.statusCode).toBe(202);

    const providerSlug = fixture(0, 'finished').slug;
    const detailClient = { getMatch: vi.fn(async () => terminalDetailResponse(providerSlug)) };
    const detailJob = await runSportScoreMatchDetailJob({
      dataRoot,
      repository,
      queue,
      detailStore,
      client: detailClient,
      now: () => new Date('2026-08-27T20:31:01.000Z')
    });
    expect(detailJob).toMatchObject({ requestsMade: 1, itemsCompleted: 1 });

    const readyResponse = responseMock();
    await handleMatchDetail(
      { url: `/api/v1/matches/detail?id=${completedMatch!.id}`, method: 'GET' } as import('node:http').IncomingMessage,
      readyResponse as unknown as import('node:http').ServerResponse,
      { repository, queue, detailStore, dataRoot }
    );
    expect(readyResponse.statusCode).toBe(200);
    const publicDetail = JSON.parse(readyResponse.body) as LocalMatchDetail;
    expect(publicDetail.events[0]).toMatchObject({ minute: 27, player: 'Mock Striker' });
    expect(publicDetail.teamStats?.[0]).toMatchObject({
      cornerKicks: 5,
      yellowCards: 0,
      fouls: 9,
      offsides: 2
    });
    expect(publicDetail.teamStats?.[1]?.offsides).toBeNull();
    expect(readyResponse.body).not.toContain('sourceMatchId');

    const feedState: MatchFeedViewState = {
      status: 'ready',
      date: targetDate,
      matches: publicFeed.matches,
      snapshot: publicFeed.snapshot,
      warnings: []
    };
    const translate = createTranslator('en');
    const matchesHtml = renderMatchesScreen({
      activeTabId: 'matches',
      translate,
      locale: 'en',
      matchFeed: feedState,
      timezone: 'UTC',
      filters: { groupby: 'league', type: 'all', gender: 'all', selectedLeagues: new Set() },
      searchQuery: '',
      isFilterPanelOpen: false
    });
    const todayHtml = renderTodayScreen({
      activeTabId: 'today',
      translate,
      matchFeed: feedState,
      locale: 'en',
      timezone: 'UTC',
      bets: { status: 'empty' },
      bankroll: { status: 'empty' },
      discipline: { status: 'unavailable', code: 'integration' },
      report: { status: 'unavailable', code: 'integration' }
    });
    const detailHtml = renderMatchDetailView(
      { status: 'ready', detail: publicDetail },
      translate,
      'en',
      'UTC'
    );
    expect(todayHtml).not.toContain('Powered by SportScore');
    for (const html of [matchesHtml, detailHtml]) {
      expect(html).toContain('<a href="https://sportscore.com/">Powered by SportScore</a>');
      expect(html).not.toContain('nofollow');
    }
  }, 60_000);
});
