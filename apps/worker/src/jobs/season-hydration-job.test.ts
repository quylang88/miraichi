import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  COMPETITION_SOURCE_REGISTRY,
  type CompetitionSourceEntry
} from '@miraichi/config';
import { readServingMatchStoreSnapshot } from '../../../api/src/repositories/serving-match-store.js';
import { FotMobAccessBlockedError } from '../sources/fotmob/fotmob-season-client.js';
import { SeasonHydrationLedger } from '../sources/hydration/season-hydration-ledger.js';
import { runSeasonHydrationJob } from './season-hydration-job.js';

const roots: string[] = [];

function openFootballRegistry(count: number): CompetitionSourceEntry[] {
  return COMPETITION_SOURCE_REGISTRY.slice(0, count).map((entry) => {
    const fixture = entry.sourceBindings.fixtureFallbacks?.find((binding) => (
      binding.sourceId === 'openfootball'
    ));
    if (!fixture) throw new Error(`Missing OpenFootball fallback for ${entry.competitionId}.`);
    const promoted = {
      ...fixture,
      providerSeasonByCanonicalSeason: Object.freeze(Object.fromEntries(
        fixture.availableCanonicalSeasons.map((season) => [season, season])
      ))
    };
    return {
      ...entry,
      fixtureSource: 'openfootball',
      externalCompetitionId: promoted.externalCompetitionId,
      endpointKind: promoted.endpointKind,
      sourceBindings: { ...entry.sourceBindings, fixture: promoted }
    };
  });
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('provider-neutral season hydration job', () => {
  it('fetches multiple season files but publishes one merged snapshot and checkpoints ETags', async () => {
    const dataRoot = await mkdtemp(path.join(os.tmpdir(), 'miraichi-season-job-'));
    roots.push(dataRoot);
    const registry = openFootballRegistry(2);
    const getSeasonMatches = vi.fn(async (request: { season: string; file: string }) => ({
      status: 'modified' as const,
      season: request.season,
      file: request.file,
      etag: `"${request.file}"`,
      rawText: JSON.stringify({ file: request.file }),
      payload: {
        name: request.file,
        matches: [{
          round: 'Matchday 1',
          date: '2026-08-29',
          time: '15:00',
          team1: `${request.file} Home`,
          team2: `${request.file} Away`,
          score: { ft: [2, 1] as [number, number] }
        }]
      }
    }));
    const sleep = vi.fn(async () => undefined);

    const result = await runSeasonHydrationJob({
      dataRoot,
      registry,
      openFootballClient: { getSeasonMatches },
      referenceDate: '2026-08-28',
      pastSeasons: 0,
      maxRequestsPerRun: 2,
      requestIntervalMs: 2_000,
      sleep,
      now: () => new Date('2026-08-28T12:00:00.000Z')
    });

    expect(result).toMatchObject({
      status: 'completed',
      requestsAttempted: 2,
      requestsSucceeded: 2,
      targetsCompleted: 2,
      publications: 1
    });
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(2_000);
    const snapshot = await readServingMatchStoreSnapshot(path.join(dataRoot, 'serving'));
    expect(snapshot.matches).toHaveLength(2);
    expect(new Set(snapshot.matches.map((match) => match.competition.id))).toEqual(new Set([
      'eng-premier-league',
      'esp-la-liga'
    ]));

    const state = await new SeasonHydrationLedger({ dataRoot }).getState();
    expect(state.revision).toBe(1);
    expect(Object.values(state.checkpoints).map((checkpoint) => checkpoint.etag).sort())
      .toEqual(['"en.1.json"', '"es.1.json"']);
    await expect(readFile(path.join(
      dataRoot,
      'providers',
      'openfootball',
      'raw',
      '2026-27',
      'en.1.json',
      'latest.json'
    ), 'utf8')).resolves.toContain('en.1.json');
  });

  it('retains raw date-only rows without publishing a fabricated kickoff', async () => {
    const dataRoot = await mkdtemp(path.join(os.tmpdir(), 'miraichi-season-date-only-'));
    roots.push(dataRoot);
    const getSeasonMatches = vi.fn(async (request: { season: string; file: string }) => ({
      status: 'modified' as const,
      season: request.season,
      file: request.file,
      etag: '"date-only"',
      rawText: '{"dateOnly":true}',
      payload: {
        name: request.file,
        matches: [{
          date: '2026-08-29',
          team1: 'Unknown Time Home',
          team2: 'Unknown Time Away'
        }]
      }
    }));

    const result = await runSeasonHydrationJob({
      dataRoot,
      registry: openFootballRegistry(1),
      openFootballClient: { getSeasonMatches },
      referenceDate: '2026-08-28',
      pastSeasons: 0,
      maxRequestsPerRun: 1,
      now: () => new Date('2026-08-28T12:00:00.000Z')
    });

    expect(result).toMatchObject({
      status: 'completed',
      requestsSucceeded: 1,
      targetsCompleted: 1,
      publications: 0,
      recordsIgnoredWithoutKickoff: 1
    });
    await expect(readFile(path.join(
      dataRoot,
      'providers',
      'openfootball',
      'raw',
      '2026-27',
      'en.1.json',
      'latest.json'
    ), 'utf8')).resolves.toContain('dateOnly');
  });

  it('records a durable failure and does not miscount a provider configuration failure as a request', async () => {
    const dataRoot = await mkdtemp(path.join(os.tmpdir(), 'miraichi-season-failure-'));
    roots.push(dataRoot);
    const invalidProviderEntry = {
      ...COMPETITION_SOURCE_REGISTRY[0]!,
      sourceBindings: {
        ...COMPETITION_SOURCE_REGISTRY[0]!.sourceBindings,
        fixture: {
          ...COMPETITION_SOURCE_REGISTRY[0]!.sourceBindings.fixture!,
          sourceId: 'football-data-org' as const,
          executionStatus: 'enabled' as const
        }
      },
      fixtureSource: 'football-data-org' as const
    };
    const getSeasonMatches = vi.fn();

    const result = await runSeasonHydrationJob({
      dataRoot,
      registry: [invalidProviderEntry],
      openFootballClient: { getSeasonMatches },
      referenceDate: '2026-08-28',
      pastSeasons: 0,
      maxRequestsPerRun: 1,
      now: () => new Date('2026-08-28T12:00:00.000Z')
    });

    expect(result).toMatchObject({
      status: 'partial',
      requestsAttempted: 0,
      requestsFailed: 0,
      targetsFailed: 1
    });
    expect(getSeasonMatches).not.toHaveBeenCalled();
  });

  it('hydrates FotMob seasons in registry order, stores raw evidence, and checkpoints ETags', async () => {
    const dataRoot = await mkdtemp(path.join(os.tmpdir(), 'miraichi-fotmob-season-job-'));
    roots.push(dataRoot);
    const getSeasonMatches = vi.fn(async (request: {
      externalCompetitionId: number;
      externalCountryCode: string;
      providerSeason: string;
    }) => ({
      status: 'modified' as const,
      etag: `"${request.externalCompetitionId}"`,
      rawText: JSON.stringify({ id: request.externalCompetitionId }),
      payload: {
        details: {
          id: request.externalCompetitionId,
          name: 'Competition',
          selectedSeason: request.providerSeason
        },
        fixtures: {
          allMatches: [{
            id: request.externalCompetitionId * 100,
            round: '1',
            home: { id: request.externalCompetitionId * 10 + 1, name: `Home ${request.externalCompetitionId}` },
            away: { id: request.externalCompetitionId * 10 + 2, name: `Away ${request.externalCompetitionId}` },
            status: {
              utcTime: '2026-09-05T14:00:00.000Z',
              finished: false,
              started: false,
              cancelled: false
            }
          }]
        }
      }
    }));

    const result = await runSeasonHydrationJob({
      dataRoot,
      registry: COMPETITION_SOURCE_REGISTRY.slice(0, 2),
      fotMobClient: { getSeasonMatches },
      referenceDate: '2026-08-31',
      pastSeasons: 0,
      maxRequestsPerRun: 2,
      now: () => new Date('2026-08-31T02:00:00.000Z')
    });

    expect(result).toMatchObject({
      status: 'completed',
      requestsAttempted: 2,
      requestsSucceeded: 2,
      targetsCompleted: 2,
      publications: 1
    });
    expect(getSeasonMatches.mock.calls.map(([request]) => request.externalCompetitionId))
      .toEqual([47, 87]);
    const state = await new SeasonHydrationLedger({ dataRoot }).getState();
    expect(Object.values(state.checkpoints).map((checkpoint) => checkpoint.etag).sort())
      .toEqual(['"47"', '"87"']);
    await expect(readFile(path.join(
      dataRoot,
      'providers',
      'fotmob-unofficial',
      'raw',
      '2026-27',
      'eng-premier-league',
      'latest.json'
    ), 'utf8')).resolves.toContain('47');
  });

  it('does not checkpoint a stale provider-selected season', async () => {
    const dataRoot = await mkdtemp(path.join(os.tmpdir(), 'miraichi-fotmob-season-mismatch-'));
    roots.push(dataRoot);
    const getSeasonMatches = vi.fn(async () => ({
      status: 'modified' as const,
      etag: '"stale"',
      rawText: '{"stale":true}',
      payload: {
        details: { id: 47, selectedSeason: '2025/2026' },
        fixtures: { allMatches: [] }
      }
    }));

    const result = await runSeasonHydrationJob({
      dataRoot,
      registry: COMPETITION_SOURCE_REGISTRY.slice(0, 1),
      fotMobClient: { getSeasonMatches },
      referenceDate: '2026-08-31',
      pastSeasons: 0,
      maxRequestsPerRun: 1,
      now: () => new Date('2026-08-31T02:00:00.000Z')
    });

    expect(result).toMatchObject({ status: 'partial', targetsSucceeded: 0, targetsFailed: 1 });
    expect(result.errors[0]).toContain('selected season mismatch');
    expect(Object.keys((await new SeasonHydrationLedger({ dataRoot }).getState()).checkpoints))
      .toEqual([]);
  });

  it('stops further FotMob requests after a 403 or 429 block signal', async () => {
    const dataRoot = await mkdtemp(path.join(os.tmpdir(), 'miraichi-fotmob-season-blocked-'));
    roots.push(dataRoot);
    const getSeasonMatches = vi.fn(async () => {
      throw new FotMobAccessBlockedError(403);
    });

    const result = await runSeasonHydrationJob({
      dataRoot,
      registry: COMPETITION_SOURCE_REGISTRY.slice(0, 3),
      fotMobClient: { getSeasonMatches },
      referenceDate: '2026-08-31',
      pastSeasons: 0,
      maxRequestsPerRun: 3,
      now: () => new Date('2026-08-31T02:00:00.000Z')
    });

    expect(getSeasonMatches).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      status: 'partial',
      targetsFailed: 3,
      requestsAttempted: 1,
      requestsFailed: 1
    });
  });
});
