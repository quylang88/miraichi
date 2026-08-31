import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { COMPETITION_SOURCE_REGISTRY } from '@miraichi/config';
import type { CanonicalWarehouseSnapshot } from '../../../../scripts/providers/shared/canonical-warehouse.js';
import { writeCanonicalWarehouseRun } from '../../../../scripts/providers/shared/canonical-warehouse.js';
import {
  buildServingMatchesFromWarehouse,
  buildServingMatchStore,
  readServingMatchStoreSnapshot
} from '../../../api/src/repositories/serving-match-store.js';
import type {
  FotMobDailyRequest,
  FotMobDailyResponse
} from '../sources/fotmob/fotmob-daily-client.js';
import { FotMobAccessBlockedError } from '../sources/fotmob/fotmob-season-client.js';
import {
  FotMobResultLedger,
  fotMobDateKey,
  fotMobMatchKey
} from '../sources/fotmob/fotmob-result-ledger.js';
import { runFotMobTerminalResultJob } from './fotmob-terminal-result-job.js';

const roots: string[] = [];
const entry = COMPETITION_SOURCE_REGISTRY[0]!;
const leagueId = entry.sourceBindings.result!.externalNumericId!;

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('FotMob terminal result publication job', () => {
  it('groups due matches into one request and publishes only terminal observations', async () => {
    const dataRoot = await createDataRoot([
      scheduledMatch('match-terminal', '501', '2026-08-31T12:00:00.000Z'),
      scheduledMatch('match-live', '502', '2026-08-31T12:30:00.000Z')
    ]);
    const getDailyMatches = vi.fn(async (_request: FotMobDailyRequest): Promise<FotMobDailyResponse> => ({
      status: 'modified',
      etag: '"daily-1"',
      rawText: '{"must":"not be persisted"}',
      payload: {
        date: '20260831',
        leagues: [{
          id: leagueId,
          matches: [
            rawMatch(501, { finished: true, started: true, scoreStr: '2 - 1' }),
            rawMatch(502, { finished: false, started: true, scoreStr: '8 - 7' })
          ]
        }]
      }
    }));

    const result = await runFotMobTerminalResultJob({
      dataRoot,
      client: { getDailyMatches },
      registry: [entry],
      timeZone: 'Asia/Tokyo',
      ownerCountryCode: 'JPN',
      now: () => new Date('2026-08-31T14:20:00.000Z')
    });

    expect(result).toMatchObject({
      status: 'completed',
      datesPlanned: 1,
      requestsAttempted: 1,
      requestsSucceeded: 1,
      matchesTerminal: 1,
      matchesRetried: 1,
      nonTerminalObserved: 1,
      publications: 1
    });
    expect(getDailyMatches).toHaveBeenCalledTimes(1);
    expect(getDailyMatches).toHaveBeenCalledWith({
      date: '2026-08-31',
      timeZone: 'Asia/Tokyo',
      ownerCountryCode: 'JPN'
    });
    const serving = await readServingMatchStoreSnapshot(path.join(dataRoot, 'serving'));
    expect(serving.matches.find((match) => match.id === 'match-terminal')).toMatchObject({
      status: 'completed', score: { home: 2, away: 1 }
    });
    expect(serving.matches.find((match) => match.id === 'match-live')).toMatchObject({
      status: 'scheduled', score: { home: null, away: null }
    });

    const ledger = await new FotMobResultLedger({ dataRoot }).getState();
    expect(ledger.dates[fotMobDateKey('2026-08-31')]).toMatchObject({
      etag: '"daily-1"', failureCount: 0
    });
    expect(ledger.matches[fotMobMatchKey('match-terminal')]).toHaveProperty('terminalAt');
    expect(ledger.matches[fotMobMatchKey('match-live')]).toMatchObject({ attemptCount: 1 });
    expect(Date.parse(ledger.matches[fotMobMatchKey('match-live')]!.nextCheckAt!))
      .toBe(Date.parse('2026-08-31T14:22:00.000Z'));

    const evidence = await readFile(path.join(
      dataRoot,
      'providers',
      'fotmob-unofficial',
      'daily',
      '2026-08-31',
      'latest-terminal.json'
    ), 'utf8');
    expect(evidence).toContain('match-terminal');
    expect(evidence).not.toContain('match-live');
    expect(evidence).not.toContain('8 - 7');
    expect(evidence).not.toContain('must');
  });

  it('uses the date ETag and retries due matches after a 304 without publication', async () => {
    const dataRoot = await createDataRoot([
      scheduledMatch('match-not-modified', '601', '2026-08-31T12:00:00.000Z')
    ]);
    const ledger = new FotMobResultLedger({ dataRoot });
    await ledger.recordBatch({
      dates: [{ kind: 'success', date: '2026-08-31', etag: '"daily-old"' }],
      matches: []
    }, new Date('2026-08-31T14:00:00.000Z'));
    const getDailyMatches = vi.fn(async (): Promise<FotMobDailyResponse> => ({
      status: 'not_modified', etag: '"daily-old"'
    }));

    const result = await runFotMobTerminalResultJob({
      dataRoot,
      client: { getDailyMatches },
      registry: [entry],
      timeZone: 'Asia/Tokyo',
      ownerCountryCode: 'JPN',
      now: () => new Date('2026-08-31T14:20:00.000Z')
    });

    expect(result).toMatchObject({
      status: 'completed', requestsAttempted: 1, publications: 0, matchesRetried: 1
    });
    expect(getDailyMatches).toHaveBeenCalledWith(expect.objectContaining({
      date: '2026-08-31', etag: '"daily-old"'
    }));
    const state = await ledger.getState();
    expect(state.matches[fotMobMatchKey('match-not-modified')]!.nextCheckAt)
      .toBe('2026-08-31T14:22:00.000Z');
    const serving = await readServingMatchStoreSnapshot(path.join(dataRoot, 'serving'));
    expect(serving.snapshotId).toBe('base-run');
  });

  it('retries a missing due match without guessing or publishing it', async () => {
    const dataRoot = await createDataRoot([
      scheduledMatch('match-missing', '701', '2026-08-31T12:00:00.000Z')
    ]);
    const getDailyMatches = vi.fn(async (): Promise<FotMobDailyResponse> => ({
      status: 'modified',
      etag: '"daily-empty"',
      rawText: '{}',
      payload: { date: '20260831', leagues: [] }
    }));

    const result = await runFotMobTerminalResultJob({
      dataRoot,
      client: { getDailyMatches },
      registry: [entry],
      timeZone: 'Asia/Tokyo',
      ownerCountryCode: 'JPN',
      now: () => new Date('2026-08-31T14:20:00.000Z')
    });

    expect(result).toMatchObject({
      status: 'completed', matchesMissing: 1, matchesRetried: 1, publications: 0
    });
    const state = await new FotMobResultLedger({ dataRoot }).getState();
    expect(state.matches[fotMobMatchKey('match-missing')]!.nextCheckAt)
      .toBe('2026-08-31T14:25:00.000Z');
  });

  it('opens the access circuit on 403/429 and does not request a second provider date', async () => {
    const dataRoot = await createDataRoot([
      scheduledMatch('match-date-one', '801', '2026-08-30T14:30:00.000Z'),
      scheduledMatch('match-date-two', '802', '2026-08-30T15:30:00.000Z')
    ]);
    const getDailyMatches = vi.fn(async (): Promise<FotMobDailyResponse> => {
      throw new FotMobAccessBlockedError(429);
    });

    const result = await runFotMobTerminalResultJob({
      dataRoot,
      client: { getDailyMatches },
      registry: [entry],
      timeZone: 'Asia/Tokyo',
      ownerCountryCode: 'JPN',
      maxRequestsPerRun: 2,
      now: () => new Date('2026-08-30T18:00:00.000Z')
    });

    expect(result).toMatchObject({
      status: 'partial',
      datesPlanned: 2,
      requestsAttempted: 1,
      requestsFailed: 1,
      matchesRetried: 2,
      publications: 0,
      circuitOpen: true
    });
    expect(getDailyMatches).toHaveBeenCalledTimes(1);
    const state = await new FotMobResultLedger({ dataRoot }).getState();
    expect(state.dates[fotMobDateKey('2026-08-30')]).toMatchObject({ failureCount: 1 });
    expect(state.dates[fotMobDateKey('2026-08-31')]).toMatchObject({ failureCount: 1 });
    expect(state.matches[fotMobMatchKey('match-date-one')]).toMatchObject({ attemptCount: 1 });
    expect(state.matches[fotMobMatchKey('match-date-two')]).toMatchObject({ attemptCount: 1 });
  });

  it('returns idle without a provider request when no match is due', async () => {
    const dataRoot = await createDataRoot([
      scheduledMatch('match-future', '901', '2026-08-31T20:00:00.000Z')
    ]);
    const getDailyMatches = vi.fn();

    const result = await runFotMobTerminalResultJob({
      dataRoot,
      client: { getDailyMatches },
      registry: [entry],
      timeZone: 'Asia/Tokyo',
      ownerCountryCode: 'JPN',
      now: () => new Date('2026-08-31T14:20:00.000Z')
    });

    expect(result).toMatchObject({
      status: 'idle', datesPlanned: 0, requestsAttempted: 0, publications: 0
    });
    expect(getDailyMatches).not.toHaveBeenCalled();
  });
});

interface ScheduledInput {
  matchId: string;
  providerMatchId: string;
  kickoffUtc: string;
}

function scheduledMatch(
  matchId: string,
  providerMatchId: string,
  kickoffUtc: string
): ScheduledInput {
  return { matchId, providerMatchId, kickoffUtc };
}

async function createDataRoot(matches: ScheduledInput[]): Promise<string> {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), 'miraichi-terminal-job-'));
  roots.push(dataRoot);
  const observedAt = '2026-08-30T00:00:00.000Z';
  const snapshot: CanonicalWarehouseSnapshot = {
    matches: matches.map((match, index) => ({
      matchId: match.matchId,
      competitionId: entry.competitionId,
      season: '2026-27',
      kickoffUtc: match.kickoffUtc,
      status: 'scheduled',
      homeTeamId: `team-home-${index}`,
      awayTeamId: `team-away-${index}`,
      scoreHome: null,
      scoreAway: null,
      updatedAt: observedAt
    })),
    teams: matches.flatMap((_match, index) => ([
      { teamId: `team-home-${index}`, name: `Home ${index}`, updatedAt: observedAt },
      { teamId: `team-away-${index}`, name: `Away ${index}`, updatedAt: observedAt }
    ])),
    competitions: [{
      competitionId: entry.competitionId,
      name: entry.competitionName,
      type: entry.competitionType,
      updatedAt: observedAt
    }],
    links: matches.map((match) => ({
      entityType: 'match',
      entityId: match.matchId,
      provider: 'fotmob-unofficial',
      providerEntityType: 'match',
      providerEntityId: match.providerMatchId,
      confidence: 1,
      linkedBy: 'test',
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

function rawMatch(
  id: number,
  status: {
    finished: boolean;
    started: boolean;
    scoreStr?: string;
  }
) {
  return {
    id,
    home: { id: id * 10 + 1, name: 'Home', score: status.finished ? 2 : 8 },
    away: { id: id * 10 + 2, name: 'Away', score: status.finished ? 1 : 7 },
    status: {
      utcTime: '2026-08-31T12:00:00.000Z',
      cancelled: false,
      ...status
    }
  };
}
