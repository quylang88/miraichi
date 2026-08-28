import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { COMPETITION_SOURCE_REGISTRY } from '@miraichi/config';
import { readServingMatchStoreSnapshot } from '../../../api/src/repositories/serving-match-store.js';
import { SeasonHydrationLedger } from '../sources/hydration/season-hydration-ledger.js';
import { runSeasonHydrationJob } from './season-hydration-job.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('provider-neutral season hydration job', () => {
  it('fetches multiple season files but publishes one merged snapshot and checkpoints ETags', async () => {
    const dataRoot = await mkdtemp(path.join(os.tmpdir(), 'miraichi-season-job-'));
    roots.push(dataRoot);
    const registry = COMPETITION_SOURCE_REGISTRY.slice(0, 2);
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
      registry: COMPETITION_SOURCE_REGISTRY.slice(0, 1),
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
});
