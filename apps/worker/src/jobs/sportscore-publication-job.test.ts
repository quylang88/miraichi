import { access, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SPORTSCORE_COMPETITION_REGISTRY } from '@miraichi/config';
import { readCanonicalWarehouseRun } from '../../../../scripts/providers/shared/canonical-warehouse.js';
import {
  readServingMatchStoreManifest,
  readServingMatchStoreSnapshot
} from '../../../api/src/repositories/serving-match-store.js';
import { runSportScorePublicationJob } from './sportscore-publication-job.js';

const roots: string[] = [];
const entry = SPORTSCORE_COMPETITION_REGISTRY[0]!;

function fixture(
  status: string,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    home: 'Northbridge Athletic',
    away: 'Rivergate City',
    home_score: 2,
    away_score: 1,
    status,
    status_text: status === 'finished' ? 'FT' : status,
    time: '2026-08-26T18:00:00Z',
    slug: 'northbridge-athletic-vs-rivergate-city',
    ...overrides
  };
}

function response(matches: Record<string, unknown>[], count = matches.length) {
  return {
    sport: 'football',
    count,
    matches,
    updated: '2026-08-26T20:00:00Z'
  };
}

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'miraichi-sportscore-publication-'));
  roots.push(root);
  return root;
}

async function publish(
  dataRoot: string,
  runId: string,
  payload: ReturnType<typeof response>,
  observedAt: string
) {
  return runSportScorePublicationJob({
    dataRoot,
    runId,
    competitionEntry: entry,
    season: '2026-27',
    response: payload,
    observedAt
  });
}

async function readPublishedWarehouse(dataRoot: string) {
  const manifest = await readServingMatchStoreManifest(path.join(dataRoot, 'serving'));
  if (!manifest.warehouseRunId) {
    throw new Error('Expected serving manifest to reference a warehouse run.');
  }
  return {
    manifest,
    warehouse: await readCanonicalWarehouseRun(dataRoot, manifest.warehouseRunId),
    serving: await readServingMatchStoreSnapshot(path.join(dataRoot, 'serving'))
  };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, {
    recursive: true,
    force: true
  })));
});

describe('SportScore last-good terminal-only publication', () => {
  it('publishes scheduled data while a simultaneous live record cannot enter canonical, serving, or detail stores', async () => {
    const dataRoot = await makeRoot();
    await publish(
      dataRoot,
      'sportscore-run-001',
      response([fixture('scheduled')]),
      '2026-08-26T16:00:00.000Z'
    );

    const result = await publish(
      dataRoot,
      'sportscore-run-002',
      response([
        fixture('live', {
          home_score: 4,
          away_score: 3,
          events: [{ type: 'goal', minute: 82, player: 'Invented Live Player' }]
        }),
        fixture('scheduled', {
          home: 'Harbour Town',
          away: 'Mountain United',
          home_score: 0,
          away_score: 0,
          time: '2026-08-26T21:00:00Z',
          slug: 'harbour-town-vs-mountain-united'
        })
      ]),
      '2026-08-26T20:05:00.000Z'
    );
    const published = await readPublishedWarehouse(dataRoot);
    const northbridgeCanonical = published.warehouse.matches.find((match) =>
      match.homeTeamId.includes('northbridge-athletic'));
    const northbridgeServing = published.serving.matches.find((match) =>
      match.homeTeam.name === 'Northbridge Athletic');

    expect(result).toMatchObject({ status: 'published', ignoredInPlayCount: 1 });
    expect(published.warehouse.matches).toHaveLength(2);
    expect(northbridgeCanonical).toMatchObject({
      status: 'scheduled',
      scoreHome: null,
      scoreAway: null
    });
    expect(northbridgeServing).toMatchObject({
      status: 'scheduled',
      score: { home: null, away: null }
    });
    expect(published.warehouse.provenance.some((item) => item.entityType === 'event')).toBe(false);
    await expect(access(path.join(
      dataRoot,
      'warehouse',
      'versions',
      'sportscore-run-002',
      'match-events.jsonl'
    ))).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(access(path.join(dataRoot, 'match-details'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('keeps completed status and scores monotonic across a rescheduled-looking source regression', async () => {
    const dataRoot = await makeRoot();
    await publish(
      dataRoot,
      'sportscore-run-terminal-001',
      response([fixture('finished')]),
      '2026-08-26T20:00:00.000Z'
    );

    const result = await publish(
      dataRoot,
      'sportscore-run-terminal-002',
      response([fixture('scheduled', {
        time: '2026-08-27T18:00:00Z',
        home_score: 0,
        away_score: 0
      })]),
      '2026-08-27T10:00:00.000Z'
    );
    const published = await readPublishedWarehouse(dataRoot);

    expect(result.status).toBe('published');
    expect(published.warehouse.matches).toHaveLength(1);
    expect(published.warehouse.matches[0]).toMatchObject({
      kickoffUtc: '2026-08-26T18:00:00.000Z',
      status: 'completed',
      scoreHome: 2,
      scoreAway: 1,
      updatedAt: '2026-08-26T20:00:00.000Z'
    });
    expect(published.serving.matches[0]).toMatchObject({
      status: 'completed',
      score: { home: 2, away: 1 }
    });
  });

  it('preserves the exact last-good manifest for empty, partial, and malformed responses', async () => {
    const dataRoot = await makeRoot();
    await publish(
      dataRoot,
      'sportscore-run-good-001',
      response([fixture('finished')]),
      '2026-08-26T20:00:00.000Z'
    );
    const initialManifest = await readServingMatchStoreManifest(path.join(dataRoot, 'serving'));

    const empty = await publish(
      dataRoot,
      'sportscore-run-empty-002',
      response([]),
      '2026-08-27T20:00:00.000Z'
    );
    const partial = await publish(
      dataRoot,
      'sportscore-run-partial-003',
      response([fixture('finished')], 2),
      '2026-08-27T20:01:00.000Z'
    );
    const malformed = await publish(
      dataRoot,
      'sportscore-run-malformed-004',
      response([fixture('finished', { away_score: null })]),
      '2026-08-27T20:02:00.000Z'
    );
    const finalManifest = await readServingMatchStoreManifest(path.join(dataRoot, 'serving'));
    const versions = await readdir(path.join(dataRoot, 'warehouse', 'versions'));

    expect(empty).toMatchObject({ status: 'not_modified', reason: 'empty_response' });
    expect(partial).toMatchObject({ status: 'rejected', reason: 'partial_response' });
    expect(malformed).toMatchObject({ status: 'rejected', reason: 'invalid_response' });
    expect(finalManifest).toEqual(initialManifest);
    expect(versions).toEqual(['sportscore-run-good-001']);
  });

  it('does not create a first snapshot from an all-live response', async () => {
    const dataRoot = await makeRoot();
    const result = await publish(
      dataRoot,
      'sportscore-run-live-only',
      response([fixture('live', { events: [{ type: 'goal', minute: 2 }] })]),
      '2026-08-26T18:02:00.000Z'
    );

    expect(result).toMatchObject({
      status: 'not_modified',
      reason: 'no_publishable_matches',
      ignoredInPlayCount: 1
    });
    await expect(access(path.join(dataRoot, 'warehouse'))).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(access(path.join(dataRoot, 'serving'))).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(access(path.join(dataRoot, 'match-details'))).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
