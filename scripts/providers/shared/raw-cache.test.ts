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

const OPENFOOTBALL_ENDPOINT = 'openfootball-england-premier-league-2026-27';
const OPENFOOTBALL_URL_PATH = '/openfootball/england/master/2026-27/1-premierleague.txt';

function createOpenFootballEnvelope(
  fetchedAt: string,
  payload: string,
  payloadHash = createTextPayloadHash(payload)
): RawProviderPayloadEnvelope {
  return {
    schemaVersion: 'miraichi.provider.raw.v1',
    provider: 'openfootball',
    endpointKey: OPENFOOTBALL_ENDPOINT,
    urlPath: OPENFOOTBALL_URL_PATH,
    query: {},
    fetchedAt,
    payloadHash,
    rateLimit: {},
    source: {
      allowlistEntryId: OPENFOOTBALL_ENDPOINT,
      repository: 'england',
      ref: 'master',
      filePath: '2026-27/1-premierleague.txt'
    },
    response: {
      contentType: 'text/plain; charset=utf-8',
      byteCount: Buffer.byteLength(payload, 'utf8')
    },
    payload
  };
}

describe('provider-neutral raw cache and warehouse', () => {
  it('hashes semantically identical payloads the same way', () => {
    expect(createPayloadHash({ b: 2, a: 1 })).toBe(createPayloadHash({ a: 1, b: 2 }));
  });

  it('hashes OpenFootball source text byte-exactly', () => {
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

  it('archives exact OpenFootball text and selects the envelope with the newest fetchedAt', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-provider-'));
    await writeRawProviderPayload(root, createOpenFootballEnvelope(
      '2026-07-02T12:00:00.000Z',
      '= Older source text\n',
      'f'.repeat(64)
    ));
    const latestPath = await writeRawProviderPayload(root, createOpenFootballEnvelope(
      '2026-07-02T13:00:00.000Z',
      '= English Premier League 2026/27\r\n',
      'a'.repeat(64)
    ));

    const latest = await readLatestRawProviderPayload(root, 'openfootball', OPENFOOTBALL_ENDPOINT);

    expect(latest).toMatchObject({
      provider: 'openfootball',
      payload: '= English Premier League 2026/27\r\n',
      fetchedAt: '2026-07-02T13:00:00.000Z'
    });
    expect(await readFile(latestPath, 'utf8')).toMatch(/\n$/);
  });

  it('rejects an invalid raw envelope before it creates an evidence file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-provider-'));
    const invalid = createOpenFootballEnvelope('2026-07-02T12:00:00.000Z', '= text\n');
    invalid.source = { ...invalid.source!, repository: 'worldcup' };

    await expect(writeRawProviderPayload(root, invalid)).rejects.toThrow('source.repository');
    await expect(access(join(root, 'providers'))).rejects.toThrow();
  });

  it('rejects a 64-character traversal payload hash before any filesystem I/O', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-provider-'));
    const traversalHash = '../outside'.padEnd(64, 'a');

    await expect(writeRawProviderPayload(root, createOpenFootballEnvelope(
      '2026-07-02T12:00:00.000Z',
      '= text\n',
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
