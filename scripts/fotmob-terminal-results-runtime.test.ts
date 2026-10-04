import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { COMPETITION_SOURCE_REGISTRY } from '../packages/config/src/index.js';
import type { CanonicalWarehouseSnapshot } from './providers/shared/canonical-warehouse.js';
import { writeCanonicalWarehouseRun } from './providers/shared/canonical-warehouse.js';
import {
  buildServingMatchesFromWarehouse,
  buildServingMatchStore,
  readServingMatchStoreSnapshot
} from '../apps/api/src/repositories/serving-match-store.js';
import type { FotMobDailyResponse } from '../apps/worker/src/sources/fotmob/fotmob-daily-client.js';
import {
  FOTMOB_TERMINAL_RESULTS_NETWORK_CONFIRMATION,
  parseFotMobTerminalResultsRuntimeArgs,
  runLocalFotMobTerminalResultsOnce,
  watchLocalFotMobTerminalResults
} from './fotmob-terminal-results-runtime.js';

const roots: string[] = [];
const entry = COMPETITION_SOURCE_REGISTRY[0]!;
const leagueId = entry.sourceBindings.result!.externalNumericId!;

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('owner-local FotMob terminal results runtime', () => {
  it('requires explicit network consent and keeps bounded owner-local defaults', () => {
    expect(() => parseFotMobTerminalResultsRuntimeArgs(['--mode', 'once']))
      .toThrow(/confirm-network/iu);
    expect(parseFotMobTerminalResultsRuntimeArgs([
      '--mode', 'watch',
      '--confirm-network', FOTMOB_TERMINAL_RESULTS_NETWORK_CONFIRMATION
    ])).toMatchObject({
      mode: 'watch',
      timeZone: 'Asia/Tokyo',
      ownerCountryCode: 'JPN',
      maxRequestsPerRun: 2,
      watchIntervalMs: 30_000
    });
    expect(() => parseFotMobTerminalResultsRuntimeArgs([
      '--confirm-network', FOTMOB_TERMINAL_RESULTS_NETWORK_CONFIRMATION,
      '--max-requests', '3'
    ])).toThrow(/between 1 and 2/iu);
  });

  it('updates a bootstrapped active root without exposing provider raw or live data', async () => {
    const dataRoot = await createActiveRoot();
    const getDailyMatches = vi.fn(async (): Promise<FotMobDailyResponse> => ({
      status: 'modified',
      etag: '"runtime-terminal"',
      rawText: '{"secret":"raw-provider-body"}',
      payload: {
        date: '20260831',
        leagues: [{
          id: leagueId,
          matches: [{
            id: 501,
            home: { id: 1, name: 'Home', score: 3 },
            away: { id: 2, name: 'Away', score: 2 },
            status: {
              utcTime: '2026-08-31T12:00:00.000Z',
              finished: true,
              started: true,
              cancelled: false,
              scoreStr: '3 - 2'
            }
          }]
        }]
      }
    }));

    const result = await runLocalFotMobTerminalResultsOnce({
      dataRoot,
      activeDataRoot: dataRoot,
      confirmation: FOTMOB_TERMINAL_RESULTS_NETWORK_CONFIRMATION,
      timeZone: 'Asia/Tokyo',
      ownerCountryCode: 'JPN',
      client: { getDailyMatches },
      now: () => new Date('2026-08-31T14:00:00.000Z')
    });

    expect(result).toMatchObject({
      status: 'completed',
      requestsAttempted: 1,
      matchesTerminal: 1,
      publications: 1,
      matchCount: 1
    });
    expect(JSON.stringify(result)).not.toContain('raw-provider-body');
    const serving = await readServingMatchStoreSnapshot(path.join(dataRoot, 'serving'));
    expect(serving.matches[0]).toMatchObject({
      status: 'completed', score: { home: 3, away: 2 }
    });
  }, 15_000);

  it('rejects an isolated or unbootstrapped target instead of writing outside active data', async () => {
    const activeDataRoot = await createActiveRoot();
    const isolated = await mkdtemp(path.join(os.tmpdir(), 'miraichi-terminal-isolated-'));
    roots.push(isolated);

    await expect(runLocalFotMobTerminalResultsOnce({
      dataRoot: isolated,
      activeDataRoot,
      confirmation: FOTMOB_TERMINAL_RESULTS_NETWORK_CONFIRMATION,
      timeZone: 'Asia/Tokyo',
      ownerCountryCode: 'JPN',
      client: { getDailyMatches: vi.fn() }
    })).rejects.toThrow(/only the configured apps\/api\/data root/iu);
  });

  it('runs watch ticks serially with the fixed 30-second wait', async () => {
    let concurrent = 0;
    let maximumConcurrent = 0;
    const waits: number[] = [];
    const runOnce = vi.fn(async () => {
      concurrent += 1;
      maximumConcurrent = Math.max(maximumConcurrent, concurrent);
      await Promise.resolve();
      concurrent -= 1;
      return { status: 'idle' as const };
    });

    const ticks = await watchLocalFotMobTerminalResults({
      maxTicks: 3,
      runOnce,
      wait: async (milliseconds) => { waits.push(milliseconds); }
    });

    expect(ticks).toBe(3);
    expect(runOnce).toHaveBeenCalledTimes(3);
    expect(maximumConcurrent).toBe(1);
    expect(waits).toEqual([30_000, 30_000]);
  });

  it('contains no SportScore /api/v1 path or anti-block workaround', async () => {
    const source = await readFile(path.join(
      process.cwd(),
      'scripts',
      'fotmob-terminal-results-runtime.ts'
    ), 'utf8');
    expect(source).not.toMatch(/SportScoreClient/u);
    expect(source).not.toMatch(/\/api\/v1/u);
    expect(source).not.toMatch(/proxy|user-agent|playwright|puppeteer/iu);
  });
});

async function createActiveRoot(): Promise<string> {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), 'miraichi-terminal-active-'));
  roots.push(dataRoot);
  const observedAt = '2026-08-30T00:00:00.000Z';
  const snapshot: CanonicalWarehouseSnapshot = {
    matches: [{
      matchId: 'match-runtime-due',
      competitionId: entry.competitionId,
      season: '2026-27',
      kickoffUtc: '2026-08-31T12:00:00.000Z',
      status: 'scheduled',
      homeTeamId: 'team-runtime-home',
      awayTeamId: 'team-runtime-away',
      scoreHome: null,
      scoreAway: null,
      updatedAt: observedAt
    }],
    teams: [
      { teamId: 'team-runtime-home', name: 'Home', updatedAt: observedAt },
      { teamId: 'team-runtime-away', name: 'Away', updatedAt: observedAt }
    ],
    competitions: [{
      competitionId: entry.competitionId,
      name: entry.competitionName,
      type: entry.competitionType,
      updatedAt: observedAt
    }],
    links: [{
      entityType: 'match',
      entityId: 'match-runtime-due',
      provider: 'fotmob-unofficial',
      providerEntityType: 'match',
      providerEntityId: '501',
      confidence: 1,
      linkedBy: 'test',
      linkedAt: observedAt
    }],
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
