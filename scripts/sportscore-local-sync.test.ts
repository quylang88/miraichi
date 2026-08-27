import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SPORTSCORE_ACTIVE_ROOT_CONFIRMATION,
  bootstrapSportScoreActiveRoot,
  prepareSportScoreSmokeRoot
} from './sportscore-operations.js';
import {
  SPORTSCORE_ACTIVE_LOCAL_SYNC_CONFIRMATION,
  SPORTSCORE_ANONYMOUS_ONE_SHOT_CONFIRMATION,
  parseSportScoreLocalSyncArgs,
  runSportScoreLocalSyncOnce
} from './sportscore-local-sync.js';

const roots: string[] = [];

async function makeRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), prefix));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('SportScore anonymous local one-shot sync', () => {
  it('requires an explicit network confirmation and exact one-competition inputs', () => {
    expect(() => parseSportScoreLocalSyncArgs([
      '--data-root', 'C:\\miraichi-isolated\\sportscore-local',
      '--date', '2026-08-27',
      '--competition-id', 'eng-premier-league',
      '--season', '2026-27'
    ])).toThrow(/confirm-network/iu);

    expect(parseSportScoreLocalSyncArgs([
      '--data-root', 'C:\\miraichi-isolated\\sportscore-local',
      '--date', '2026-08-27',
      '--competition-id', 'eng-premier-league',
      '--season', '2026-27',
      '--confirm-network', SPORTSCORE_ANONYMOUS_ONE_SHOT_CONFIRMATION
    ])).toMatchObject({
      date: '2026-08-27',
      competitionId: 'eng-premier-league',
      season: '2026-27',
      confirmation: SPORTSCORE_ANONYMOUS_ONE_SHOT_CONFIRMATION
    });
  });

  it('performs one anonymous competition/day request only inside a prepared smoke root', async () => {
    const dataRoot = await makeRoot('miraichi-sportscore-local-sync-');
    const activeRoot = await makeRoot('miraichi-sportscore-active-');
    await prepareSportScoreSmokeRoot({ dataRoot, activeDataRoot: activeRoot });
    const getFixtures = vi.fn(async () => ({
      sport: 'football' as const,
      count: 1,
      matches: [{
        home: 'Local Smoke Home',
        away: 'Local Smoke Away',
        home_score: 2,
        away_score: 1,
        status: 'finished',
        status_text: 'FT',
        time: '2026-08-27T10:00:00Z',
        slug: 'local-smoke-home-vs-local-smoke-away'
      }]
    }));

    const result = await runSportScoreLocalSyncOnce({
      dataRoot,
      activeDataRoot: activeRoot,
      date: '2026-08-27',
      competitionId: 'eng-premier-league',
      season: '2026-27',
      confirmation: SPORTSCORE_ANONYMOUS_ONE_SHOT_CONFIRMATION,
      client: { getFixtures },
      now: () => new Date('2026-08-27T12:00:00.000Z')
    });

    expect(getFixtures).toHaveBeenCalledTimes(1);
    expect(getFixtures).toHaveBeenCalledWith({
      date: '2026-08-27',
      competition: 'english-premier-league',
      limit: 200,
      maxRetries: 0
    });
    expect(result).toMatchObject({
      authenticated: false,
      competitionId: 'eng-premier-league',
      requestsAttempted: 1,
      requestsSucceeded: 1,
      matchCount: 1
    });
  });

  it('refuses an unprepared or active data root', async () => {
    const unpreparedRoot = await makeRoot('miraichi-sportscore-unprepared-');

    await expect(runSportScoreLocalSyncOnce({
      dataRoot: unpreparedRoot,
      activeDataRoot: unpreparedRoot,
      date: '2026-08-27',
      competitionId: 'eng-premier-league',
      season: '2026-27',
      confirmation: SPORTSCORE_ANONYMOUS_ONE_SHOT_CONFIRMATION,
      client: { getFixtures: vi.fn() }
    })).rejects.toThrow(/isolated|prepared|active/iu);
  });

  it('allows one active-root request only after a validated smoke snapshot is bootstrapped', async () => {
    const smokeRoot = await makeRoot('miraichi-sportscore-smoke-source-');
    const activeRoot = await makeRoot('miraichi-sportscore-active-target-');
    await prepareSportScoreSmokeRoot({ dataRoot: smokeRoot, activeDataRoot: activeRoot });
    const response = (date: string) => ({
      sport: 'football' as const,
      count: 1,
      matches: [{
        home: 'Active Local Home',
        away: 'Active Local Away',
        home_score: 0,
        away_score: 0,
        status: 'upcoming',
        status_text: 'upcoming',
        time: `${date}T10:00:00Z`,
        url: `/football/match/active-local-home-vs-active-local-away-${date.replaceAll('-', '')}/`
      }]
    });
    await runSportScoreLocalSyncOnce({
      dataRoot: smokeRoot,
      activeDataRoot: activeRoot,
      date: '2026-08-27',
      competitionId: 'eng-premier-league',
      season: '2026-27',
      confirmation: SPORTSCORE_ANONYMOUS_ONE_SHOT_CONFIRMATION,
      client: { getFixtures: vi.fn(async () => response('2026-08-27')) },
      now: () => new Date('2026-08-27T12:00:00.000Z')
    });
    await bootstrapSportScoreActiveRoot({
      fromDataRoot: smokeRoot,
      toDataRoot: activeRoot,
      confirmation: SPORTSCORE_ACTIVE_ROOT_CONFIRMATION
    });
    const activeClient = { getFixtures: vi.fn(async () => response('2026-08-28')) };
    const activeResult = await runSportScoreLocalSyncOnce({
      mode: 'active',
      dataRoot: activeRoot,
      activeDataRoot: activeRoot,
      activeConfirmation: SPORTSCORE_ACTIVE_LOCAL_SYNC_CONFIRMATION,
      date: '2026-08-28',
      competitionId: 'eng-premier-league',
      season: '2026-27',
      confirmation: SPORTSCORE_ANONYMOUS_ONE_SHOT_CONFIRMATION,
      client: activeClient,
      now: () => new Date('2026-08-28T12:00:00.000Z')
    });

    expect(activeClient.getFixtures).toHaveBeenCalledTimes(1);
    expect(activeResult).toMatchObject({
      mode: 'active',
      requestsSucceeded: 1,
      matchCount: 2
    });
  });
});
