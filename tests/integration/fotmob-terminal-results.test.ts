import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { COMPETITION_SOURCE_REGISTRY } from '../../packages/config/src/index.js';
import type { LocalMatchFeedResponse } from '../../packages/shared/src/index.js';
import type { CanonicalWarehouseSnapshot } from '../../scripts/providers/shared/canonical-warehouse.js';
import { writeCanonicalWarehouseRun } from '../../scripts/providers/shared/canonical-warehouse.js';
import {
  buildServingMatchesFromWarehouse,
  buildServingMatchStore,
  readServingMatchStoreSnapshot
} from '../../apps/api/src/repositories/serving-match-store.js';
import { ServingMatchStoreRepository } from '../../apps/api/src/repositories/serving-match-store-repository.js';
import { handleMatches } from '../../apps/api/src/routes/matches.js';
import { runFotMobTerminalResultJob } from '../../apps/worker/src/jobs/fotmob-terminal-result-job.js';
import { runSeasonHydrationJob } from '../../apps/worker/src/jobs/season-hydration-job.js';
import type { FotMobDailyResponse } from '../../apps/worker/src/sources/fotmob/fotmob-daily-client.js';
import { FotMobAccessBlockedError } from '../../apps/worker/src/sources/fotmob/fotmob-season-client.js';
import { resolveCompetitionSeason } from '../../apps/worker/src/sources/hydration/season-hydration-plan.js';

const roots: string[] = [];
const entry = COMPETITION_SOURCE_REGISTRY[0]!;
const leagueId = entry.sourceBindings.result!.externalNumericId!;

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('FotMob terminal result large boundary', () => {
  it('coalesces a provider date, publishes terminal-only API data, resumes, and preserves last-good on block', async () => {
    const dataRoot = await createDailyRoot();
    const firstClient = vi.fn(async (): Promise<FotMobDailyResponse> => ({
      status: 'modified',
      etag: '"daily-1"',
      rawText: '{"private":"raw-live-body"}',
      payload: {
        date: '20260831',
        leagues: [{
          id: leagueId,
          matches: [
            dailyMatch(501, true, '2 - 1'),
            dailyMatch(502, false, '8 - 7')
          ]
        }]
      }
    }));
    const first = await runFotMobTerminalResultJob({
      dataRoot,
      registry: [entry],
      client: { getDailyMatches: firstClient },
      timeZone: 'Asia/Tokyo',
      ownerCountryCode: 'JPN',
      now: () => new Date('2026-08-31T14:00:00.000Z')
    });

    expect(first).toMatchObject({
      requestsAttempted: 1,
      matchesTerminal: 1,
      matchesRetried: 2,
      matchesMissing: 1,
      publications: 1
    });
    expect(firstClient).toHaveBeenCalledTimes(1);

    const repository = new ServingMatchStoreRepository({
      servingRoot: path.join(dataRoot, 'serving'),
      now: () => new Date('2026-08-31T14:00:01.000Z')
    });
    const response = responseMock();
    await handleMatches(
      { url: '/api/v1/matches?date=2026-08-31', method: 'GET' } as
        import('node:http').IncomingMessage,
      response as unknown as import('node:http').ServerResponse,
      { repository }
    );
    expect(response.statusCode).toBe(200);
    const publicFeed = JSON.parse(response.body) as LocalMatchFeedResponse;
    expect(publicFeed.matches).toHaveLength(3);
    expect(publicFeed.matches.find((match) => match.id === 'match-integration-ft')).toMatchObject({
      status: 'completed', score: { home: 2, away: 1 }
    });
    expect(publicFeed.matches.find((match) => match.id === 'match-integration-live')).toMatchObject({
      status: 'scheduled', score: { home: null, away: null }
    });
    expect(response.body).not.toContain('501');
    expect(response.body).not.toContain('raw-live-body');
    expect(response.body).not.toContain('8 - 7');

    const earlyRestartClient = { getDailyMatches: vi.fn() };
    const earlyRestart = await runFotMobTerminalResultJob({
      dataRoot,
      registry: [entry],
      client: earlyRestartClient,
      timeZone: 'Asia/Tokyo',
      ownerCountryCode: 'JPN',
      now: () => new Date('2026-08-31T14:01:00.000Z')
    });
    expect(earlyRestart).toMatchObject({ status: 'idle', requestsAttempted: 0 });
    expect(earlyRestartClient.getDailyMatches).not.toHaveBeenCalled();

    const recoveryClient = vi.fn(async (): Promise<FotMobDailyResponse> => ({
      status: 'modified',
      etag: '"daily-2"',
      rawText: '{}',
      payload: {
        date: '20260831',
        leagues: [{ id: leagueId, matches: [dailyMatch(502, true, '1 - 0')] }]
      }
    }));
    const recovery = await runFotMobTerminalResultJob({
      dataRoot,
      registry: [entry],
      client: { getDailyMatches: recoveryClient },
      timeZone: 'Asia/Tokyo',
      ownerCountryCode: 'JPN',
      now: () => new Date('2026-08-31T14:02:00.000Z')
    });
    expect(recovery).toMatchObject({ matchesTerminal: 1, publications: 1 });
    expect(recoveryClient).toHaveBeenCalledWith(expect.objectContaining({ etag: '"daily-1"' }));

    const beforeBlock = await readServingMatchStoreSnapshot(path.join(dataRoot, 'serving'));
    const blockedClient = vi.fn(async (): Promise<FotMobDailyResponse> => {
      throw new FotMobAccessBlockedError(429);
    });
    const blocked = await runFotMobTerminalResultJob({
      dataRoot,
      registry: [entry],
      client: { getDailyMatches: blockedClient },
      timeZone: 'Asia/Tokyo',
      ownerCountryCode: 'JPN',
      now: () => new Date('2026-08-31T14:05:00.000Z')
    });
    expect(blocked).toMatchObject({
      status: 'partial', circuitOpen: true, requestsFailed: 1, publications: 0
    });
    expect(await readServingMatchStoreSnapshot(path.join(dataRoot, 'serving'))).toEqual(beforeBlock);
  });

  it('revalidates at most nine current editions in registry order without historical eligibility', async () => {
    const dataRoot = await mkdtemp(path.join(os.tmpdir(), 'miraichi-revalidation-integration-'));
    roots.push(dataRoot);
    const registry = COMPETITION_SOURCE_REGISTRY.slice(0, 10);
    const initialClient = vi.fn(async (request: {
      externalCompetitionId: number;
      providerSeason: string;
    }) => seasonResponse(request, 'modified'));
    await runSeasonHydrationJob({
      dataRoot,
      registry,
      fotMobClient: { getSeasonMatches: initialClient },
      referenceDate: '2026-08-31',
      pastSeasons: 0,
      maxRequestsPerRun: 10,
      requestIntervalMs: 0,
      now: () => new Date('2026-08-30T12:00:00.000Z')
    });
    const revalidateClient = vi.fn(async (request: {
      externalCompetitionId: number;
      providerSeason: string;
      etag?: string;
    }) => seasonResponse(request, 'not_modified'));

    const result = await runSeasonHydrationJob({
      dataRoot,
      registry,
      fotMobClient: { getSeasonMatches: revalidateClient },
      referenceDate: '2026-08-31',
      pastSeasons: 0,
      maxRequestsPerRun: 9,
      requestIntervalMs: 0,
      mode: 'revalidate-current',
      now: () => new Date('2026-08-31T12:00:00.000Z')
    });

    expect(result).toMatchObject({
      status: 'completed', requestsAttempted: 9, requestsSucceeded: 9, publications: 0
    });
    expect(revalidateClient.mock.calls.map(([request]) => request.externalCompetitionId))
      .toEqual(registry.slice(0, 9).map((item) => item.sourceBindings.fixture!.externalNumericId));
    expect(revalidateClient.mock.calls.every(([request], index) => {
      const registryEntry = registry[index]!;
      const canonicalCurrent = resolveCompetitionSeason(
        registryEntry,
        '2026-08-31',
        0
      ).season;
      return request.etag?.startsWith('"current-') === true
        && request.providerSeason === registryEntry.sourceBindings.fixture!
          .providerSeasonByCanonicalSeason?.[canonicalCurrent];
    })).toBe(true);
  });
});

async function createDailyRoot(): Promise<string> {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), 'miraichi-terminal-integration-'));
  roots.push(dataRoot);
  const observedAt = '2026-08-30T00:00:00.000Z';
  const inputs = [
    ['match-integration-ft', '501'],
    ['match-integration-live', '502'],
    ['match-integration-missing', '503']
  ] as const;
  const snapshot: CanonicalWarehouseSnapshot = {
    matches: inputs.map(([matchId], index) => ({
      matchId,
      competitionId: entry.competitionId,
      season: '2026-27',
      kickoffUtc: '2026-08-31T12:00:00.000Z',
      status: 'scheduled',
      homeTeamId: `team-home-${index}`,
      awayTeamId: `team-away-${index}`,
      scoreHome: null,
      scoreAway: null,
      updatedAt: observedAt
    })),
    teams: inputs.flatMap((_input, index) => ([
      { teamId: `team-home-${index}`, name: `Home ${index}`, updatedAt: observedAt },
      { teamId: `team-away-${index}`, name: `Away ${index}`, updatedAt: observedAt }
    ])),
    competitions: [{
      competitionId: entry.competitionId,
      name: entry.competitionName,
      type: entry.competitionType,
      updatedAt: observedAt
    }],
    links: inputs.map(([matchId, providerEntityId]) => ({
      entityType: 'match',
      entityId: matchId,
      provider: 'fotmob-unofficial',
      providerEntityType: 'match',
      providerEntityId,
      confidence: 1,
      linkedBy: 'integration-test',
      linkedAt: observedAt
    })),
    provenance: []
  };
  const warehouseRoot = await writeCanonicalWarehouseRun(dataRoot, 'base-run', snapshot);
  const serving = await buildServingMatchesFromWarehouse({ warehouseRoot, importedAt: observedAt });
  await buildServingMatchStore({
    servingRoot: path.join(dataRoot, 'serving'),
    version: 'base-run',
    snapshotId: 'base-run',
    generatedAt: observedAt,
    importedAt: observedAt,
    sources: serving.sources,
    matches: serving.matches,
    warehouseRunId: 'base-run'
  });
  return dataRoot;
}

function dailyMatch(id: number, finished: boolean, scoreStr: string) {
  const [home, away] = scoreStr.split(' - ').map(Number) as [number, number];
  return {
    id,
    home: { id: id * 10 + 1, name: 'Home', score: home },
    away: { id: id * 10 + 2, name: 'Away', score: away },
    status: {
      utcTime: '2026-08-31T12:00:00.000Z',
      finished,
      started: true,
      cancelled: false,
      scoreStr
    }
  };
}

function seasonResponse(
  request: { externalCompetitionId: number; providerSeason: string },
  status: 'modified' | 'not_modified'
) {
  const etag = `"current-${request.externalCompetitionId}"`;
  if (status === 'not_modified') return { status, etag } as const;
  return {
    status,
    etag,
    rawText: JSON.stringify({ id: request.externalCompetitionId }),
    payload: {
      details: {
        id: request.externalCompetitionId,
        selectedSeason: request.providerSeason
      },
      fixtures: { allMatches: [{
        id: request.externalCompetitionId * 100,
        home: { id: request.externalCompetitionId * 10 + 1, name: 'Current Home' },
        away: { id: request.externalCompetitionId * 10 + 2, name: 'Current Away' },
        status: {
          utcTime: '2026-09-15T12:00:00.000Z',
          finished: false,
          started: false,
          cancelled: false
        }
      }] }
    }
  } as const;
}

function responseMock() {
  return {
    statusCode: 0,
    headers: {} as Record<string, string>,
    body: '',
    setHeader(name: string, value: string) { this.headers[name] = value; },
    writeHead(statusCode: number, headers?: Record<string, string>) {
      this.statusCode = statusCode;
      if (headers) this.headers = { ...this.headers, ...headers };
    },
    end(body?: unknown) { this.body = typeof body === 'string' ? body : ''; }
  };
}
