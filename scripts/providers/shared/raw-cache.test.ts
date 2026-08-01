import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { createPayloadHash, writeRawProviderPayload } from './raw-cache.js';
import { appendProviderManifestEntry } from './manifest.js';
import { appendCanonicalWarehouseRecord } from './canonical-warehouse.js';

describe('provider-neutral raw cache and warehouse', () => {
  it('hashes semantically identical payloads the same way', () => {
    expect(createPayloadHash({ b: 2, a: 1 })).toBe(createPayloadHash({ a: 1, b: 2 }));
  });

  it('writes provider raw payloads under provider and endpoint paths', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-provider-'));
    const path = await writeRawProviderPayload(root, {
      schemaVersion: 'miraichi.provider.raw.v1',
      provider: 'manual-snapshot',
      endpointKey: 'fixtures.all',
      urlPath: '/v3/football/fixtures',
      query: { page: '1' },
      fetchedAt: '2026-07-02T00:00:00.000Z',
      payloadHash: createPayloadHash({ data: [{ id: 1 }] }),
      rateLimit: {},
      payload: { data: [{ id: 1 }] }
    });

    expect(path).toContain(join('providers', 'manual-snapshot', 'raw', 'fixtures.all'));
    expect(JSON.parse(await readFile(path, 'utf8')).provider).toBe('manual-snapshot');
  });

  it('appends provider manifests and canonical warehouse jsonl records', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-provider-'));
    await appendProviderManifestEntry(root, 'manual-snapshot', {
      provider: 'manual-snapshot',
      endpointKey: 'fixtures.all',
      urlPath: '/v3/football/fixtures',
      query: { page: '1' },
      status: 'captured',
      page: 1,
      hasMore: false,
      recordCount: 1
    });
    await appendCanonicalWarehouseRecord(root, 'canonical-matches', {
      matchId: 'match-1',
      competitionId: 'competition-1',
      season: '2026',
      kickoffUtc: '2026-07-02T12:00:00.000Z',
      status: 'scheduled',
      homeTeamId: 'team-home',
      awayTeamId: 'team-away',
      scoreHome: null,
      scoreAway: null,
      updatedAt: '2026-07-02T00:00:00.000Z'
    });

    expect(await readFile(join(root, 'providers', 'manual-snapshot', 'manifests', 'capture-manifest.jsonl'), 'utf8')).toContain('"status":"captured"');
    expect(await readFile(join(root, 'warehouse', 'canonical-matches.jsonl'), 'utf8')).toContain('"matchId":"match-1"');
  });
});
