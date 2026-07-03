import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it, vi } from 'vitest';
import { appendProviderManifestEntry } from '../shared/manifest.js';
import { createPayloadHash, writeRawProviderPayload } from '../shared/raw-cache.js';
import {
  buildSportmonksSeasonScopedRequests,
  extractSeasonIdsFromFixtureRawCapture,
  runSportmonksSeasonScopedCapture
} from './season-scoped-capture.js';
import type { SportmonksCaptureClient } from './capture.js';

describe('sportmonks season-scoped capture inventory', () => {
  it('extracts unique season ids from fixtures.all and can filter by league id', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-sportmonks-season-inventory-'));
    await writeRawProviderPayload(root, {
      schemaVersion: 'miraichi.provider.raw.v1',
      provider: 'sportmonks',
      endpointKey: 'fixtures.all',
      urlPath: '/fixtures',
      query: { page: '1' },
      fetchedAt: '2026-07-03T00:00:00.000Z',
      payloadHash: createPayloadHash({ data: [] }),
      rateLimit: {},
      payload: {
        data: [
          { id: 1, league_id: 732, season_id: 26618 },
          { id: 2, league_id: 732, season_id: 26618 },
          { id: 3, league_id: 720, season_id: 21887 }
        ]
      }
    });

    await expect(extractSeasonIdsFromFixtureRawCapture(root, { leagueIds: [732] })).resolves.toEqual([26618]);
    await expect(extractSeasonIdsFromFixtureRawCapture(root, {})).resolves.toEqual([21887, 26618]);
  });

  it('builds app-light and training-ready season scoped requests without live endpoints', () => {
    expect(buildSportmonksSeasonScopedRequests([26618])).toEqual([
      { endpointKey: 'schedules.bySeasonId', urlPath: '/schedules/seasons/26618', query: {} },
      { endpointKey: 'teams.bySeasonId', urlPath: '/teams/seasons/26618', query: {} },
      {
        endpointKey: 'standings.bySeasonId',
        urlPath: '/standings/seasons/26618',
        query: { include: 'participant;league;season;stage;round;details.type;rule' }
      },
      {
        endpointKey: 'standings.correctionsBySeasonId',
        urlPath: '/standings/corrections/seasons/26618',
        query: { include: 'participant;league;season;stage;round' }
      }
    ]);
  });
});

describe('sportmonks season-scoped capture runner', () => {
  it('captures full paginated season-scoped requests and skips already captured requests', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-sportmonks-season-capture-'));
    await appendProviderManifestEntry(root, 'sportmonks', {
      provider: 'sportmonks',
      endpointKey: 'teams.bySeasonId',
      urlPath: '/teams/seasons/26618',
      query: { page: '1' },
      status: 'captured',
      page: 1,
      hasMore: false,
      fetchedAt: '2026-07-03T00:00:00.000Z',
      payloadHash: 'a'.repeat(64),
      recordCount: 1
    });

    const client: SportmonksCaptureClient = {
      get: vi.fn(async (_urlPath, query) => ({
        ok: true as const,
        statusCode: 200,
        body: {
          data: [{ id: Number(query?.page ?? '1') }],
          pagination: { has_more: query?.page === '1' }
        },
        rateLimit: {}
      }))
    };

    const result = await runSportmonksSeasonScopedCapture({
      captureRoot: root,
      client,
      seasonIds: [26618],
      endpoints: ['schedules.bySeasonId', 'teams.bySeasonId'],
      now: () => '2026-07-03T00:00:00.000Z'
    });

    expect(result).toMatchObject({
      candidateSeasonCount: 1,
      selectedSeasonCount: 1,
      requestedEndpointCount: 2,
      captured: 2,
      skipped: 1,
      failed: 0,
      unavailable: 0
    });
    expect(client.get).toHaveBeenCalledTimes(2);

    const manifest = await readFile(join(root, 'providers', 'sportmonks', 'manifests', 'capture-manifest.jsonl'), 'utf8');
    expect(manifest).toContain('"endpointKey":"schedules.bySeasonId"');
    expect(manifest).toContain('"page":2');
  });
});
