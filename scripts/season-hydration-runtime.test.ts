import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SPORTSCORE_COMPETITION_REGISTRY } from '../packages/config/src/index.js';
import { readServingMatchStoreSnapshot } from '../apps/api/src/repositories/serving-match-store.js';
import { runSportScorePublicationJob } from '../apps/worker/src/jobs/sportscore-publication-job.js';
import {
  SPORTSCORE_ACTIVE_ROOT_CONFIRMATION,
  bootstrapSportScoreActiveRoot,
  prepareSportScoreSmokeRoot
} from './sportscore-operations.js';
import {
  SEASON_HYDRATION_NETWORK_CONFIRMATION,
  parseSeasonHydrationRuntimeArgs,
  runLocalSeasonHydrationBatch
} from './season-hydration-runtime.js';

const roots: string[] = [];

async function makeRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), prefix));
  roots.push(root);
  return root;
}

async function makeBootstrappedActiveRoot(): Promise<string> {
  const smokeRoot = await makeRoot('miraichi-season-runtime-smoke-');
  const activeRoot = await makeRoot('miraichi-season-runtime-active-');
  await prepareSportScoreSmokeRoot({ dataRoot: smokeRoot, activeDataRoot: activeRoot });
  await runSportScorePublicationJob({
    dataRoot: smokeRoot,
    runId: 'season-runtime-bootstrap',
    competitionEntry: SPORTSCORE_COMPETITION_REGISTRY[0]!,
    season: 'current',
    response: {
      sport: 'football',
      count: 1,
      matches: [{
        home: 'Bootstrap Home',
        away: 'Bootstrap Away',
        status: 'upcoming',
        time: '2026-08-27T08:00:00Z',
        slug: 'bootstrap-home-vs-bootstrap-away'
      }]
    },
    observedAt: '2026-08-27T00:00:00.000Z'
  });
  await bootstrapSportScoreActiveRoot({
    fromDataRoot: smokeRoot,
    toDataRoot: activeRoot,
    confirmation: SPORTSCORE_ACTIVE_ROOT_CONFIRMATION
  });
  return activeRoot;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('owner-local season hydration runtime', () => {
  it('requires explicit network consent and has bounded honest defaults', () => {
    expect(() => parseSeasonHydrationRuntimeArgs([
      '--date', '2026-08-28'
    ])).toThrow(/confirm-network/iu);
    expect(parseSeasonHydrationRuntimeArgs([
      '--date', '2026-08-28',
      '--confirm-network', SEASON_HYDRATION_NETWORK_CONFIRMATION
    ])).toMatchObject({
      date: '2026-08-28',
      maxRequestsPerRun: 9,
      requestIntervalMs: 2_000,
      pastSeasons: 2
    });
  });

  it('hydrates the active root without replacing its existing snapshot', async () => {
    const activeRoot = await makeBootstrappedActiveRoot();
    const getSeasonMatches = vi.fn(async (request: {
      externalCompetitionId: number;
      providerSeason: string;
    }) => ({
      status: 'modified' as const,
      etag: '"runtime-etag"',
      rawText: '{"runtime":true}',
      payload: {
        details: {
          id: request.externalCompetitionId,
          selectedSeason: request.providerSeason
        },
        fixtures: { allMatches: [{
          id: 9001,
          home: { id: 901, name: 'Hydrated Home' },
          away: { id: 902, name: 'Hydrated Away' },
          status: {
            utcTime: '2026-08-29T15:00:00.000Z',
            finished: false,
            started: false,
            cancelled: false
          }
        }] }
      }
    }));

    const result = await runLocalSeasonHydrationBatch({
      dataRoot: activeRoot,
      activeDataRoot: activeRoot,
      date: '2026-08-28',
      confirmation: SEASON_HYDRATION_NETWORK_CONFIRMATION,
      maxRequestsPerRun: 1,
      requestIntervalMs: 0,
      fotMobClient: { getSeasonMatches },
      now: () => new Date('2026-08-28T12:00:00.000Z')
    });

    expect(result).toMatchObject({
      requestsAttempted: 1,
      requestsSucceeded: 1,
      hydrationTargetsCompleted: 1,
      executableCurrentCompetitionCount: 49
    });
    const snapshot = await readServingMatchStoreSnapshot(path.join(activeRoot, 'serving'));
    expect(snapshot.matches.some((match) => match.homeTeam.name === 'Bootstrap Home')).toBe(true);
    expect(snapshot.matches.some((match) => match.homeTeam.name === 'Hydrated Home')).toBe(true);
  });

  it('contains no SportScore API client or /api/v1 execution path', async () => {
    const source = await readFile(path.join(process.cwd(), 'scripts', 'season-hydration-runtime.ts'), 'utf8');
    expect(source).not.toMatch(/SportScoreClient/u);
    expect(source).not.toMatch(/\/api\/v1/u);
    expect(source).not.toMatch(/runSportScoreDailySyncJob/u);
  });
});
