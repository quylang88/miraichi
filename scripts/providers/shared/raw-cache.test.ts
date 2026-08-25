import { access, mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import type { RawProviderPayloadEnvelope } from '../../../packages/shared/src/contracts/provider-ingestion-contracts.js';
import {
  createPayloadHash,
  createTextPayloadHash,
  readLatestRawProviderPayload,
  writeRawProviderPayload
} from './raw-cache.js';
import { appendProviderManifestEntry } from './manifest.js';
import { appendCanonicalWarehouseRecord } from './canonical-warehouse.js';

const TEST_ENDPOINT = 'api-football-eng-premier-league';
const TEST_URL_PATH = '/fixtures';

function createApiFootballEnvelope(
  fetchedAt: string,
  payload: string,
  payloadHash = createTextPayloadHash(payload)
): RawProviderPayloadEnvelope {
  return {
    schemaVersion: 'miraichi.provider.raw.v1',
    provider: 'api-football',
    endpointKey: TEST_ENDPOINT,
    urlPath: TEST_URL_PATH,
    query: { league: '39', season: '2026' },
    fetchedAt,
    payloadHash,
    rateLimit: { remaining: 80, resetsInSeconds: 3600 },
    source: {
      allowlistEntryId: TEST_ENDPOINT,
      leagueId: 39,
      season: 2026,
      queryType: 'season'
    },
    response: {
      contentType: 'application/json; charset=utf-8',
      byteCount: Buffer.byteLength(payload, 'utf8')
    },
    payload
  };
}

describe('provider-neutral raw cache and warehouse', () => {
  it('hashes semantically identical payloads the same way', () => {
    expect(createPayloadHash({ b: 2, a: 1 })).toBe(createPayloadHash({ a: 1, b: 2 }));
  });

  it('hashes source text byte-exactly', () => {
    expect(createTextPayloadHash('a\r\nb\n')).not.toBe(createTextPayloadHash('a\nb\n'));
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

  it('archives provider payload and selects the envelope with the newest fetchedAt', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-provider-'));
    await writeRawProviderPayload(root, createApiFootballEnvelope(
      '2026-08-25T12:00:00.000Z',
      '{"response":[{"id":1001}]}',
      'f'.repeat(64)
    ));
    const latestPath = await writeRawProviderPayload(root, createApiFootballEnvelope(
      '2026-08-25T13:00:00.000Z',
      '{"response":[{"id":1001,"status":"FT"}]}',
      'a'.repeat(64)
    ));

    const latest = await readLatestRawProviderPayload(root, 'api-football', TEST_ENDPOINT);

    expect(latest).toMatchObject({
      provider: 'api-football',
      payload: '{"response":[{"id":1001,"status":"FT"}]}',
      fetchedAt: '2026-08-25T13:00:00.000Z'
    });
    expect(await readFile(latestPath, 'utf8')).toMatch(/\n$/);
  });

  it('rejects an invalid raw envelope before it creates an evidence file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-provider-'));
    const invalid = createApiFootballEnvelope('2026-08-25T12:00:00.000Z', '{}');
    invalid.source = { ...invalid.source!, leagueId: -1 };

    await expect(writeRawProviderPayload(root, invalid)).rejects.toThrow('source.leagueId');
    await expect(access(join(root, 'providers'))).rejects.toThrow();
  });

  it('rejects a 64-character traversal payload hash before any filesystem I/O', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-provider-'));
    const traversalHash = '../outside'.padEnd(64, 'a');

    await expect(writeRawProviderPayload(root, createApiFootballEnvelope(
      '2026-08-25T12:00:00.000Z',
      '{}',
      traversalHash
    ))).rejects.toThrow('payloadHash');
    await expect(access(join(root, 'providers'))).rejects.toThrow();
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
