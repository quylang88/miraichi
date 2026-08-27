import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SPORTSCORE_COMPETITION_REGISTRY } from '@miraichi/config';
import {
  readServingMatchStoreManifest,
  readServingMatchStoreSnapshot
} from '../../../api/src/repositories/serving-match-store.js';
import { SportScoreClientError } from '../sources/sportscore/sportscore-client.js';
import {
  SportScoreSourceLedger,
  sportScoreDailyCheckpointKey
} from '../sources/sportscore/sportscore-source-ledger.js';
import { runSportScoreDailySyncJob } from './sportscore-daily-sync-job.js';
import { startSportScoreWorkerSchedule } from './sportscore-worker-schedule.js';

const roots: string[] = [];
const registry = SPORTSCORE_COMPETITION_REGISTRY.slice(0, 3);
const targetDate = '2026-08-26';

function responseFor(index: number, status = 'scheduled') {
  const names = [
    ['Northbridge Athletic', 'Rivergate City', 'northbridge-athletic-vs-rivergate-city'],
    ['Harbour Town', 'Mountain United', 'harbour-town-vs-mountain-united'],
    ['Forest Rovers', 'Lakeside FC', 'forest-rovers-vs-lakeside-fc']
  ] as const;
  const [home, away, slug] = names[index] ?? names[0];
  return {
    sport: 'football',
    count: 1,
    matches: [{
      home,
      away,
      home_score: status === 'finished' ? 2 : 0,
      away_score: status === 'finished' ? 1 : 0,
      status,
      status_text: status === 'finished' ? 'FT' : status,
      time: '2026-08-26T18:00:00Z',
      slug
    }]
  };
}

function simultaneousResponse(status: string) {
  return {
    sport: 'football',
    count: 2,
    matches: [
      responseFor(0, status).matches[0],
      responseFor(1, status).matches[0]
    ]
  };
}

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'miraichi-sportscore-daily-'));
  roots.push(root);
  return root;
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(roots.splice(0).map((root) => rm(root, {
    recursive: true,
    force: true
  })));
});

describe('SportScore daily per-competition sync job', () => {
  it('caps a run, persists successful checkpoints, and resumes fairly after restart', async () => {
    const dataRoot = await makeRoot();
    const calls: Array<{
      date: string;
      competition: string;
      limit?: number;
      maxRetries?: number;
    }> = [];
    const client = {
      getFixtures: vi.fn(async (request: {
        date: string;
        competition: string;
        limit?: number;
        maxRetries?: number;
      }) => {
        calls.push(request);
        const index = registry.findIndex((entry) =>
          entry.providerCompetitionSlug === request.competition
        );
        return responseFor(index);
      })
    };

    const first = await runSportScoreDailySyncJob({
      dataRoot,
      client,
      registry,
      targetDate,
      now: () => new Date('2026-08-26T10:00:00.000Z'),
      resolveSeason: () => '2026-27',
      maxRequestsPerRun: 2,
      maxConcurrency: 1
    });
    const second = await runSportScoreDailySyncJob({
      dataRoot,
      client,
      registry,
      targetDate,
      now: () => new Date('2026-08-26T10:01:00.000Z'),
      resolveSeason: () => '2026-27',
      maxRequestsPerRun: 2,
      maxConcurrency: 1
    });
    const third = await runSportScoreDailySyncJob({
      dataRoot,
      client,
      registry,
      targetDate,
      now: () => new Date('2026-08-26T10:02:00.000Z'),
      resolveSeason: () => '2026-27',
      maxRequestsPerRun: 2,
      maxConcurrency: 1
    });

    expect(first).toMatchObject({ status: 'completed', requestsAttempted: 2, requestsSucceeded: 2 });
    expect(second).toMatchObject({ status: 'completed', requestsAttempted: 1, requestsSucceeded: 1 });
    expect(third).toMatchObject({ status: 'idle', requestsAttempted: 0 });
    expect(calls.map((call) => call.competition)).toEqual(
      registry.map((entry) => entry.providerCompetitionSlug)
    );
    expect(calls.every((call) =>
      call.date === targetDate && call.limit === 200 && call.maxRetries === 0
    )).toBe(true);

    const ledger = await new SportScoreSourceLedger({ dataRoot }).getState();
    for (const entry of registry) {
      expect(ledger.daily[sportScoreDailyCheckpointKey(entry.competitionId, targetDate)]?.completedAt)
        .toBeDefined();
    }
  });

  it('records terminal schedules when the provider identifies matches by relative URL', async () => {
    const dataRoot = await makeRoot();
    const urlOnly: {
      sport: string;
      count: number;
      matches: Record<string, unknown>[];
    } = responseFor(0);
    urlOnly.matches[0] = {
      ...urlOnly.matches[0],
      slug: undefined,
      url: '/football/match/northbridge-athletic-vs-rivergate-city/'
    };

    await runSportScoreDailySyncJob({
      dataRoot,
      client: { getFixtures: vi.fn(async () => urlOnly) },
      registry: [registry[0]!],
      targetDate,
      now: () => new Date('2026-08-26T10:00:00.000Z'),
      resolveSeason: () => '2026-27'
    });
    const ledger = await new SportScoreSourceLedger({ dataRoot }).getState();
    const schedules = Object.values(ledger.terminalSchedules);

    expect(schedules).toHaveLength(1);
    expect(schedules[0]?.sourceMatchSlugs).toEqual([
      'northbridge-athletic-vs-rivergate-city'
    ]);
  });

  it('uses one competition-level request for simultaneous matches at +15, +30, and bounded recovery', async () => {
    const dataRoot = await makeRoot();
    const entry = registry[0]!;
    const initialClient = { getFixtures: vi.fn(async () => simultaneousResponse('scheduled')) };
    await runSportScoreDailySyncJob({
      dataRoot,
      client: initialClient,
      registry: [entry],
      targetDate,
      now: () => new Date('2026-08-26T10:00:00.000Z'),
      resolveSeason: () => '2026-27'
    });

    const plus15Client = { getFixtures: vi.fn(async () => simultaneousResponse('live')) };
    const plus15 = await runSportScoreDailySyncJob({
      dataRoot,
      client: plus15Client,
      registry: [entry],
      targetDate,
      now: () => new Date('2026-08-26T20:15:00.000Z'),
      resolveSeason: () => '2026-27'
    });
    const betweenClient = { getFixtures: vi.fn(async () => simultaneousResponse('live')) };
    const between = await runSportScoreDailySyncJob({
      dataRoot,
      client: betweenClient,
      registry: [entry],
      targetDate,
      now: () => new Date('2026-08-26T20:20:00.000Z'),
      resolveSeason: () => '2026-27'
    });
    const plus30Client = { getFixtures: vi.fn(async () => simultaneousResponse('live')) };
    const plus30 = await runSportScoreDailySyncJob({
      dataRoot,
      client: plus30Client,
      registry: [entry],
      targetDate,
      now: () => new Date('2026-08-26T20:30:00.000Z'),
      resolveSeason: () => '2026-27'
    });
    const recoveryClient = { getFixtures: vi.fn(async () => simultaneousResponse('finished')) };
    const recovery = await runSportScoreDailySyncJob({
      dataRoot,
      client: recoveryClient,
      registry: [entry],
      targetDate,
      now: () => new Date('2026-08-26T21:00:00.000Z'),
      resolveSeason: () => '2026-27'
    });

    expect(plus15).toMatchObject({ requestsAttempted: 1, terminalWindowsChecked: 1 });
    expect(plus15Client.getFixtures).toHaveBeenCalledTimes(1);
    expect(between).toMatchObject({ status: 'idle', requestsAttempted: 0 });
    expect(betweenClient.getFixtures).not.toHaveBeenCalled();
    expect(plus30).toMatchObject({ requestsAttempted: 1, terminalWindowsChecked: 1 });
    expect(plus30Client.getFixtures).toHaveBeenCalledTimes(1);
    expect(recovery).toMatchObject({ requestsAttempted: 1, terminalWindowsChecked: 1 });
    expect(recoveryClient.getFixtures).toHaveBeenCalledTimes(1);

    const serving = await readServingMatchStoreSnapshot(path.join(dataRoot, 'serving'));
    expect(serving.matches).toHaveLength(2);
    expect(serving.matches.every((match) => match.status === 'completed')).toBe(true);
  });

  it('retains only terminal-check metadata when the first daily observation is already live', async () => {
    const dataRoot = await makeRoot();
    const entry = registry[0]!;
    const livePayload: {
      sport: string;
      count: number;
      matches: Record<string, unknown>[];
    } = responseFor(0, 'live');
    livePayload.matches[0] = {
      ...livePayload.matches[0],
      home_score: 4,
      away_score: 3,
      events: [{ type: 'goal', minute: 82, player: 'Invented Live Player' }]
    };
    const daily = await runSportScoreDailySyncJob({
      dataRoot,
      client: { getFixtures: vi.fn(async () => livePayload) },
      registry: [entry],
      targetDate,
      now: () => new Date('2026-08-26T20:15:00.000Z'),
      resolveSeason: () => '2026-27'
    });
    const ledgerAfterLive = await new SportScoreSourceLedger({ dataRoot }).getState();
    const serializedLedger = JSON.stringify(ledgerAfterLive);

    expect(daily).toMatchObject({ status: 'completed', requestsAttempted: 1, publications: 0 });
    expect(serializedLedger).toContain('northbridge-athletic-vs-rivergate-city');
    expect(serializedLedger).not.toContain('Invented Live Player');
    expect(serializedLedger).not.toContain('home_score');
    await expect(readServingMatchStoreSnapshot(path.join(dataRoot, 'serving'))).rejects.toMatchObject({
      code: 'serving_match_store_missing'
    });

    const terminal = await runSportScoreDailySyncJob({
      dataRoot,
      client: { getFixtures: vi.fn(async () => responseFor(0, 'finished')) },
      registry: [entry],
      targetDate,
      now: () => new Date('2026-08-26T20:30:00.000Z'),
      resolveSeason: () => '2026-27'
    });
    const serving = await readServingMatchStoreSnapshot(path.join(dataRoot, 'serving'));

    expect(terminal).toMatchObject({ requestsAttempted: 1, terminalWindowsChecked: 1 });
    expect(serving.matches[0]).toMatchObject({
      status: 'completed',
      score: { home: 2, away: 1 }
    });
  });

  it.each([429, 503])(
    'defers HTTP %i without advancing terminal success or erasing the last-good snapshot',
    async (statusCode) => {
    const dataRoot = await makeRoot();
    const entry = registry[0]!;
    await runSportScoreDailySyncJob({
      dataRoot,
      client: { getFixtures: vi.fn(async () => responseFor(0)) },
      registry: [entry],
      targetDate,
      now: () => new Date('2026-08-26T10:00:00.000Z'),
      resolveSeason: () => '2026-27'
    });
    const before = await readServingMatchStoreManifest(path.join(dataRoot, 'serving'));
    const failingClient = {
      getFixtures: vi.fn(async () => {
        throw new SportScoreClientError('http_status', 'provider unavailable', statusCode);
      })
    };
    const failed = await runSportScoreDailySyncJob({
      dataRoot,
      client: failingClient,
      registry: [entry],
      targetDate,
      now: () => new Date('2026-08-26T20:15:00.000Z'),
      resolveSeason: () => '2026-27'
    });
    const immediateClient = { getFixtures: vi.fn(async () => responseFor(0, 'finished')) };
    const immediate = await runSportScoreDailySyncJob({
      dataRoot,
      client: immediateClient,
      registry: [entry],
      targetDate,
      now: () => new Date('2026-08-26T20:20:00.000Z'),
      resolveSeason: () => '2026-27'
    });
    const after = await readServingMatchStoreManifest(path.join(dataRoot, 'serving'));
    const ledger = await new SportScoreSourceLedger({ dataRoot }).getState();
    const terminal = Object.values(ledger.terminalWindows)[0];

    expect(failed).toMatchObject({ status: 'partial', requestsAttempted: 1, requestsFailed: 1 });
    expect(after.currentVersion).toBe(before.currentVersion);
    expect(terminal?.plus15CompletedAt).toBeUndefined();
    expect(terminal?.nextAttemptAt).toBe('2026-08-26T20:30:00.000Z');
    expect(immediate).toMatchObject({ status: 'idle', requestsAttempted: 0 });
    expect(immediateClient.getFixtures).not.toHaveBeenCalled();
    }
  );

  it('exhausts a terminal window after four consecutive provider failures', async () => {
    const dataRoot = await makeRoot();
    const entry = registry[0]!;
    await runSportScoreDailySyncJob({
      dataRoot,
      client: { getFixtures: vi.fn(async () => responseFor(0)) },
      registry: [entry],
      targetDate,
      now: () => new Date('2026-08-26T10:00:00.000Z'),
      resolveSeason: () => '2026-27'
    });
    const failureTimes = [
      '2026-08-26T20:15:00.000Z',
      '2026-08-26T20:30:00.000Z',
      '2026-08-26T21:00:00.000Z',
      '2026-08-26T22:00:00.000Z'
    ];
    const failingClient = {
      getFixtures: vi.fn(async () => {
        throw new SportScoreClientError('http_status', 'provider unavailable', 503);
      })
    };
    for (const now of failureTimes) {
      await runSportScoreDailySyncJob({
        dataRoot,
        client: failingClient,
        registry: [entry],
        targetDate,
        now: () => new Date(now),
        resolveSeason: () => '2026-27'
      });
    }
    const afterExhaustionClient = { getFixtures: vi.fn(async () => responseFor(0, 'finished')) };
    const afterExhaustion = await runSportScoreDailySyncJob({
      dataRoot,
      client: afterExhaustionClient,
      registry: [entry],
      targetDate,
      now: () => new Date('2026-08-26T23:00:00.000Z'),
      resolveSeason: () => '2026-27'
    });
    const ledger = await new SportScoreSourceLedger({ dataRoot }).getState();
    const checkpoint = Object.values(ledger.terminalWindows)[0];

    expect(failingClient.getFixtures).toHaveBeenCalledTimes(4);
    expect(checkpoint).toMatchObject({
      failureCount: 4,
      exhaustedAt: '2026-08-26T22:00:00.000Z'
    });
    expect(afterExhaustion).toMatchObject({ status: 'idle', requestsAttempted: 0 });
    expect(afterExhaustionClient.getFixtures).not.toHaveBeenCalled();
  });

  it('caps transport concurrency independently from the request budget', async () => {
    const dataRoot = await makeRoot();
    let active = 0;
    let maxActive = 0;
    const client = {
      getFixtures: vi.fn(async (request: { competition: string }) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        return responseFor(registry.findIndex((entry) =>
          entry.providerCompetitionSlug === request.competition
        ));
      })
    };

    const result = await runSportScoreDailySyncJob({
      dataRoot,
      client,
      registry,
      targetDate,
      now: () => new Date('2026-08-26T10:00:00.000Z'),
      resolveSeason: () => '2026-27',
      maxRequestsPerRun: 3,
      maxConcurrency: 2
    });

    expect(result.requestsAttempted).toBe(3);
    expect(client.getFixtures).toHaveBeenCalledTimes(3);
    expect(maxActive).toBe(2);
  });

  it('returns lease_busy instead of overlapping two publication runs', async () => {
    const dataRoot = await makeRoot();
    let releaseFetch!: (payload: ReturnType<typeof responseFor>) => void;
    let markFetchStarted!: () => void;
    const fetchStarted = new Promise<void>((resolve) => {
      markFetchStarted = resolve;
    });
    const pendingResponse = new Promise<ReturnType<typeof responseFor>>((resolve) => {
      releaseFetch = resolve;
    });
    const client = {
      getFixtures: vi.fn(async () => {
        markFetchStarted();
        return pendingResponse;
      })
    };
    const baseOptions = {
      dataRoot,
      client,
      registry: [registry[0]!],
      targetDate,
      resolveSeason: () => '2026-27'
    };

    const firstRun = runSportScoreDailySyncJob({
      ...baseOptions,
      now: () => new Date('2026-08-26T10:00:00.000Z')
    });
    await fetchStarted;
    const overlappingRun = await runSportScoreDailySyncJob({
      ...baseOptions,
      now: () => new Date('2026-08-26T10:00:01.000Z')
    });
    releaseFetch(responseFor(0));
    const completedRun = await firstRun;

    expect(overlappingRun).toMatchObject({ status: 'lease_busy', requestsAttempted: 0 });
    expect(completedRun).toMatchObject({ status: 'completed', requestsAttempted: 1 });
    expect(client.getFixtures).toHaveBeenCalledTimes(1);
  });

  it('prevents overlapping timer ticks and stops the injected worker schedule', async () => {
    let tick: (() => void) | undefined;
    const clearIntervalFn = vi.fn();
    let finishFirstRun!: () => void;
    const firstRun = new Promise<void>((resolve) => {
      finishFirstRun = resolve;
    });
    const completedResult = {
      status: 'completed' as const,
      requestsAttempted: 1,
      requestsSucceeded: 1,
      requestsFailed: 0,
      publications: 1,
      terminalWindowsChecked: 0,
      nextRotationCursor: 1,
      errors: []
    };
    const run = vi.fn(async () => {
      if (run.mock.calls.length === 1) await firstRun;
      return completedResult;
    });
    const handle = startSportScoreWorkerSchedule({
      run,
      intervalMs: 60_000,
      setIntervalFn: ((callback: () => void) => {
        tick = callback;
        return 42 as unknown as ReturnType<typeof setInterval>;
      }) as unknown as typeof setInterval,
      clearIntervalFn: clearIntervalFn as unknown as typeof clearInterval
    });

    tick?.();
    tick?.();
    expect(run).toHaveBeenCalledTimes(1);
    finishFirstRun();
    await new Promise((resolve) => setTimeout(resolve, 0));
    tick?.();
    expect(run).toHaveBeenCalledTimes(2);
    handle.stop();
    handle.stop();
    expect(clearIntervalFn).toHaveBeenCalledTimes(1);
  });
});
