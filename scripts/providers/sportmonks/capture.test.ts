import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { SportmonksEndpointEntry } from './endpoint-catalog.js';
import { runSportmonksRawCapture, type SportmonksCaptureClient } from './capture.js';
import { createPayloadHash, writeRawProviderPayload } from '../shared/raw-cache.js';

describe('sportmonks raw capture', () => {
  it('captures paginated endpoints and skips per-id endpoints', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-sportmonks-capture-'));
    const catalog: SportmonksEndpointEntry[] = [
      { endpointKey: 'fixtures.all', group: 'fixtures', urlPath: '/fixtures', capturePolicy: 'allowed' },
      {
        endpointKey: 'fixtures.enrichedById',
        group: 'fixtures',
        urlPath: '/fixtures/{id}',
        capturePolicy: 'allowed',
        requiresId: true
      }
    ];
    const client: SportmonksCaptureClient = {
      get: vi.fn(async (_urlPath: string, query: Record<string, string> = {}) => ({
        ok: true as const,
        statusCode: 200,
        body: query.page === '1'
          ? { data: [{ id: 1 }], pagination: { has_more: true } }
          : { data: [{ id: 2 }], pagination: { has_more: false } },
        rateLimit: { remaining: 99 }
      }))
    };

    const result = await runSportmonksRawCapture({
      captureRoot: root,
      catalog,
      client,
      now: () => '2026-07-02T00:00:00.000Z'
    });

    expect(result).toEqual({
      captured: 2,
      skipped: 1,
      unavailable: 0,
      failed: 0
    });
    expect(client.get).toHaveBeenNthCalledWith(1, '/fixtures', { page: '1' });
    expect(client.get).toHaveBeenNthCalledWith(2, '/fixtures', { page: '2' });

    const manifestPath = join(root, 'providers', 'sportmonks', 'manifests', 'capture-manifest.jsonl');
    const manifestLines = (await readFile(manifestPath, 'utf8')).trim().split(/\r?\n/).map((line) => JSON.parse(line));

    expect(manifestLines).toHaveLength(3);
    expect(manifestLines[0]).toMatchObject({
      provider: 'sportmonks',
      endpointKey: 'fixtures.all',
      status: 'captured',
      page: 1,
      hasMore: true,
      recordCount: 1
    });
    expect(manifestLines[1]).toMatchObject({
      endpointKey: 'fixtures.all',
      status: 'captured',
      page: 2,
      hasMore: false
    });
    expect(manifestLines[2]).toMatchObject({
      endpointKey: 'fixtures.enrichedById',
      status: 'skipped'
    });

    const firstPayloadHash = manifestLines[0].payloadHash as string;
    const rawPath = join(root, 'providers', 'sportmonks', 'raw', 'fixtures.all', '2026-07-02', `${firstPayloadHash}.json`);
    const rawEnvelope = JSON.parse(await readFile(rawPath, 'utf8'));
    expect(rawEnvelope).toMatchObject({
      schemaVersion: 'miraichi.provider.raw.v1',
      provider: 'sportmonks',
      endpointKey: 'fixtures.all',
      query: { page: '1' },
      payload: { data: [{ id: 1 }] }
    });
  });

  it('records unavailable endpoints in the manifest without writing raw payloads', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-sportmonks-capture-'));
    const catalog: SportmonksEndpointEntry[] = [
      { endpointKey: 'fixtures.all', group: 'fixtures', urlPath: '/fixtures', capturePolicy: 'allowed' }
    ];
    const client: SportmonksCaptureClient = {
      get: vi.fn(async () => ({
        ok: false as const,
        status: 'unavailable' as const,
        statusCode: 403,
        message: 'Sportmonks endpoint unavailable with status 403',
        rateLimit: {}
      }))
    };

    const result = await runSportmonksRawCapture({
      captureRoot: root,
      catalog,
      client,
      now: () => '2026-07-02T00:00:00.000Z'
    });

    expect(result).toEqual({
      captured: 0,
      skipped: 0,
      unavailable: 1,
      failed: 0
    });

    const manifestPath = join(root, 'providers', 'sportmonks', 'manifests', 'capture-manifest.jsonl');
    const [line] = (await readFile(manifestPath, 'utf8')).trim().split(/\r?\n/).map((entry) => JSON.parse(entry));
    expect(line).toMatchObject({
      provider: 'sportmonks',
      endpointKey: 'fixtures.all',
      status: 'unavailable',
      errorCode: '403'
    });
    expect(line.payloadHash).toBeUndefined();
  });

  it('stops pagination at maxPagesPerEndpoint without logging a failed entry', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-sportmonks-capture-'));
    const catalog: SportmonksEndpointEntry[] = [
      { endpointKey: 'fixtures.all', group: 'fixtures', urlPath: '/fixtures', capturePolicy: 'allowed' }
    ];
    const client: SportmonksCaptureClient = {
      get: vi.fn(async () => ({
        ok: true as const,
        statusCode: 200,
        body: { data: [{ id: 1 }], pagination: { has_more: true } },
        rateLimit: {}
      }))
    };

    const result = await runSportmonksRawCapture({
      captureRoot: root,
      catalog,
      client,
      maxPagesPerEndpoint: 1,
      now: () => '2026-07-02T00:00:00.000Z'
    });

    expect(result).toEqual({
      captured: 1,
      skipped: 0,
      unavailable: 0,
      failed: 0
    });

    const manifestPath = join(root, 'providers', 'sportmonks', 'manifests', 'capture-manifest.jsonl');
    const manifestLines = (await readFile(manifestPath, 'utf8')).trim().split(/\r?\n/).map((line) => JSON.parse(line));
    expect(manifestLines).toHaveLength(1);
    expect(manifestLines[0]).toMatchObject({
      endpointKey: 'fixtures.all',
      status: 'captured',
      page: 1,
      hasMore: true
    });
  });

  it('continues deep pagination with next_cursor instead of page offsets', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-sportmonks-capture-'));
    const catalog: SportmonksEndpointEntry[] = [
      { endpointKey: 'fixtures.all', group: 'fixtures', urlPath: '/fixtures', capturePolicy: 'allowed' }
    ];
    const client: SportmonksCaptureClient = {
      get: vi.fn(async (_urlPath: string, query: Record<string, string> = {}) => ({
        ok: true as const,
        statusCode: 200,
        body: query.cursor === 'cursor-after-page-1'
          ? { data: [{ id: 2 }], pagination: { has_more: false } }
          : {
              data: [{ id: 1 }],
              pagination: {
                has_more: true,
                next_cursor: 'https://api.sportmonks.com/v3/football/fixtures?cursor=cursor-after-page-1'
              }
            },
        rateLimit: {}
      }))
    };

    const result = await runSportmonksRawCapture({
      captureRoot: root,
      catalog,
      client,
      maxPagesPerEndpoint: 2,
      now: () => '2026-07-02T00:00:00.000Z'
    });

    expect(result).toEqual({
      captured: 2,
      skipped: 0,
      unavailable: 0,
      failed: 0
    });
    expect(client.get).toHaveBeenNthCalledWith(1, '/fixtures', { page: '1' });
    expect(client.get).toHaveBeenNthCalledWith(2, '/fixtures', { cursor: 'cursor-after-page-1' });

    const manifestPath = join(root, 'providers', 'sportmonks', 'manifests', 'capture-manifest.jsonl');
    const manifestLines = (await readFile(manifestPath, 'utf8')).trim().split(/\r?\n/).map((line) => JSON.parse(line));
    expect(manifestLines[1]).toMatchObject({
      endpointKey: 'fixtures.all',
      status: 'captured',
      query: { cursor: 'cursor-after-page-1' },
      page: 2,
      hasMore: false
    });
  });

  it('can resume an endpoint from a stored cursor and logical page number', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-sportmonks-capture-'));
    const catalog: SportmonksEndpointEntry[] = [
      { endpointKey: 'fixtures.all', group: 'fixtures', urlPath: '/fixtures', capturePolicy: 'allowed' }
    ];
    const client: SportmonksCaptureClient = {
      get: vi.fn(async () => ({
        ok: true as const,
        statusCode: 200,
        body: { data: [{ id: 802 }], pagination: { has_more: false } },
        rateLimit: {}
      }))
    };

    const result = await runSportmonksRawCapture({
      captureRoot: root,
      catalog,
      client,
      initialRequestsByEndpointKey: {
        'fixtures.all': {
          query: { cursor: 'cursor-after-page-801' },
          page: 802
        }
      },
      now: () => '2026-07-02T00:00:00.000Z'
    });

    expect(result).toEqual({
      captured: 1,
      skipped: 0,
      unavailable: 0,
      failed: 0
    });
    expect(client.get).toHaveBeenCalledWith('/fixtures', { cursor: 'cursor-after-page-801' });

    const manifestPath = join(root, 'providers', 'sportmonks', 'manifests', 'capture-manifest.jsonl');
    const [line] = (await readFile(manifestPath, 'utf8')).trim().split(/\r?\n/).map((entry) => JSON.parse(entry));
    expect(line).toMatchObject({
      endpointKey: 'fixtures.all',
      status: 'captured',
      query: { cursor: 'cursor-after-page-801' },
      page: 802,
      hasMore: false,
      recordCount: 1
    });
  });

  it('skips an endpoint that already has a completed captured page in the manifest', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-sportmonks-capture-'));
    const catalog: SportmonksEndpointEntry[] = [
      { endpointKey: 'leagues.all', group: 'leagues', urlPath: '/leagues', capturePolicy: 'allowed' }
    ];
    await writeFixtureCaptureManifest(root, {
      endpointKey: 'leagues.all',
      urlPath: '/leagues',
      page: 1,
      hasMore: false,
      payloadHash: 'a'.repeat(64)
    });
    const client: SportmonksCaptureClient = {
      get: vi.fn(async () => ({
        ok: true as const,
        statusCode: 200,
        body: { data: [{ id: 1 }], pagination: { has_more: false } },
        rateLimit: {}
      }))
    };

    const result = await runSportmonksRawCapture({
      captureRoot: root,
      catalog,
      client,
      now: () => '2026-07-03T00:00:00.000Z'
    });

    expect(result).toEqual({
      captured: 0,
      skipped: 1,
      unavailable: 0,
      failed: 0
    });
    expect(client.get).not.toHaveBeenCalled();
  });

  it('auto-resumes an incomplete endpoint from the next cursor in the latest raw payload', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-sportmonks-capture-'));
    const catalog: SportmonksEndpointEntry[] = [
      { endpointKey: 'fixtures.all', group: 'fixtures', urlPath: '/fixtures', capturePolicy: 'allowed' }
    ];
    const firstPayload = {
      data: [{ id: 1 }],
      pagination: {
        has_more: true,
        next_cursor: 'https://api.sportmonks.com/v3/football/fixtures?cursor=cursor-after-page-1'
      }
    };
    const firstPayloadHash = createPayloadHash(firstPayload);
    await writeRawProviderPayload(root, {
      schemaVersion: 'miraichi.provider.raw.v1',
      provider: 'sportmonks',
      endpointKey: 'fixtures.all',
      urlPath: '/fixtures',
      query: { page: '1' },
      fetchedAt: '2026-07-03T00:00:00.000Z',
      payloadHash: firstPayloadHash,
      rateLimit: {},
      payload: firstPayload
    });
    await writeFixtureCaptureManifest(root, {
      endpointKey: 'fixtures.all',
      urlPath: '/fixtures',
      page: 1,
      hasMore: true,
      payloadHash: firstPayloadHash
    });
    const client: SportmonksCaptureClient = {
      get: vi.fn(async () => ({
        ok: true as const,
        statusCode: 200,
        body: { data: [{ id: 2 }], pagination: { has_more: false } },
        rateLimit: {}
      }))
    };

    const result = await runSportmonksRawCapture({
      captureRoot: root,
      catalog,
      client,
      now: () => '2026-07-03T00:00:01.000Z'
    });

    expect(result).toEqual({
      captured: 1,
      skipped: 0,
      unavailable: 0,
      failed: 0
    });
    expect(client.get).toHaveBeenCalledWith('/fixtures', { cursor: 'cursor-after-page-1' });
  });

  it('keeps endpoint default query values when resuming from a stored cursor', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-sportmonks-capture-'));
    const catalog: SportmonksEndpointEntry[] = [
      {
        endpointKey: 'expected.fixtures',
        group: 'xg',
        urlPath: '/expected/fixtures',
        capturePolicy: 'gated',
        defaultQuery: { include: 'type;fixture;participant' }
      }
    ];
    const firstPayload = {
      data: [{ id: 1 }],
      pagination: {
        has_more: true,
        next_cursor: 'https://api.sportmonks.com/v3/football/expected/fixtures?cursor=cursor-after-page-1'
      }
    };
    const firstPayloadHash = createPayloadHash(firstPayload);
    await writeRawProviderPayload(root, {
      schemaVersion: 'miraichi.provider.raw.v1',
      provider: 'sportmonks',
      endpointKey: 'expected.fixtures',
      urlPath: '/expected/fixtures',
      query: { include: 'type;fixture;participant', page: '1' },
      fetchedAt: '2026-07-03T00:00:00.000Z',
      payloadHash: firstPayloadHash,
      rateLimit: {},
      payload: firstPayload
    });
    await writeFixtureCaptureManifest(root, {
      endpointKey: 'expected.fixtures',
      urlPath: '/expected/fixtures',
      page: 1,
      hasMore: true,
      payloadHash: firstPayloadHash,
      query: { include: 'type;fixture;participant', page: '1' }
    });
    const client: SportmonksCaptureClient = {
      get: vi.fn(async () => ({
        ok: true as const,
        statusCode: 200,
        body: { data: [{ id: 2 }], pagination: { has_more: false } },
        rateLimit: {}
      }))
    };

    const result = await runSportmonksRawCapture({
      captureRoot: root,
      catalog,
      client,
      now: () => '2026-07-03T00:00:01.000Z'
    });

    expect(result).toEqual({
      captured: 1,
      skipped: 0,
      unavailable: 0,
      failed: 0
    });
    expect(client.get).toHaveBeenCalledWith('/expected/fixtures', {
      include: 'type;fixture;participant',
      cursor: 'cursor-after-page-1'
    });
  });

  it('captures all non-live endpoints by default while still skipping live endpoints', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-sportmonks-capture-'));
    const catalog: SportmonksEndpointEntry[] = [
      { endpointKey: 'odds.prematch.all', group: 'odds', urlPath: '/odds/pre-match', capturePolicy: 'gated' },
      { endpointKey: 'livescores.all', group: 'livescores', urlPath: '/livescores', capturePolicy: 'gated', isLive: true }
    ];
    const client: SportmonksCaptureClient = {
      get: vi.fn(async () => ({
        ok: true as const,
        statusCode: 200,
        body: { data: [{ id: 1 }], pagination: { has_more: false } },
        rateLimit: {}
      }))
    };

    const result = await runSportmonksRawCapture({
      captureRoot: root,
      allowLiveEndpoints: false,
      catalog,
      client,
      now: () => '2026-07-03T00:00:00.000Z'
    });

    expect(result).toEqual({
      captured: 1,
      skipped: 1,
      unavailable: 0,
      failed: 0
    });
    expect(client.get).toHaveBeenCalledTimes(1);
    expect(client.get).toHaveBeenCalledWith('/odds/pre-match', { page: '1' });

    const manifestPath = join(root, 'providers', 'sportmonks', 'manifests', 'capture-manifest.jsonl');
    const manifestLines = (await readFile(manifestPath, 'utf8')).trim().split(/\r?\n/).map((line) => JSON.parse(line));
    expect(manifestLines.map((line) => [line.endpointKey, line.status, line.errorCode])).toEqual([
      ['odds.prematch.all', 'captured', undefined],
      ['livescores.all', 'skipped', 'live_endpoint']
    ]);
  });

  it('captures live endpoints only when explicitly allowed', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-sportmonks-capture-'));
    const catalog: SportmonksEndpointEntry[] = [
      { endpointKey: 'livescores.all', group: 'livescores', urlPath: '/livescores', capturePolicy: 'gated', isLive: true }
    ];
    const client: SportmonksCaptureClient = {
      get: vi.fn(async () => ({
        ok: true as const,
        statusCode: 200,
        body: { data: [{ id: 1 }], pagination: { has_more: false } },
        rateLimit: {}
      }))
    };

    const result = await runSportmonksRawCapture({
      captureRoot: root,
      allowLiveEndpoints: true,
      catalog,
      client,
      now: () => '2026-07-03T00:00:00.000Z'
    });

    expect(result).toEqual({
      captured: 1,
      skipped: 0,
      unavailable: 0,
      failed: 0
    });
    expect(client.get).toHaveBeenCalledWith('/livescores', { page: '1' });
  });

  it('applies endpoint default query values to the first captured page', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-sportmonks-capture-'));
    const catalog: SportmonksEndpointEntry[] = [
      {
        endpointKey: 'expected.fixtures',
        group: 'xg',
        urlPath: '/expected/fixtures',
        capturePolicy: 'gated',
        defaultQuery: { include: 'type;fixture;participant' }
      }
    ];
    const client: SportmonksCaptureClient = {
      get: vi.fn(async () => ({
        ok: true as const,
        statusCode: 200,
        body: { data: [{ id: 1 }], pagination: { has_more: false } },
        rateLimit: {}
      }))
    };

    const result = await runSportmonksRawCapture({
      captureRoot: root,
      catalog,
      client,
      now: () => '2026-07-04T00:00:00.000Z'
    });

    expect(result).toEqual({
      captured: 1,
      skipped: 0,
      unavailable: 0,
      failed: 0
    });
    expect(client.get).toHaveBeenCalledWith('/expected/fixtures', {
      include: 'type;fixture;participant',
      page: '1'
    });
  });

  it('does not treat a completed capture with a different default query as complete', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-sportmonks-capture-'));
    await writeFixtureCaptureManifest(root, {
      endpointKey: 'expected.fixtures',
      urlPath: '/expected/fixtures',
      page: 1,
      hasMore: false,
      payloadHash: 'a'.repeat(64)
    });
    const catalog: SportmonksEndpointEntry[] = [
      {
        endpointKey: 'expected.fixtures',
        group: 'xg',
        urlPath: '/expected/fixtures',
        capturePolicy: 'gated',
        defaultQuery: { include: 'type;fixture;participant' }
      }
    ];
    const client: SportmonksCaptureClient = {
      get: vi.fn(async () => ({
        ok: true as const,
        statusCode: 200,
        body: { data: [{ id: 2 }], pagination: { has_more: false } },
        rateLimit: {}
      }))
    };

    const result = await runSportmonksRawCapture({
      captureRoot: root,
      catalog,
      client,
      now: () => '2026-07-04T00:00:00.000Z'
    });

    expect(result).toEqual({
      captured: 1,
      skipped: 0,
      unavailable: 0,
      failed: 0
    });
    expect(client.get).toHaveBeenCalledWith('/expected/fixtures', {
      include: 'type;fixture;participant',
      page: '1'
    });
  });
});

async function writeFixtureCaptureManifest(
  root: string,
  input: {
    endpointKey: string;
    urlPath: string;
    page: number;
    hasMore: boolean;
    payloadHash: string;
    query?: Record<string, string>;
  }
): Promise<void> {
  const { appendProviderManifestEntry } = await import('../shared/manifest.js');
  await appendProviderManifestEntry(root, 'sportmonks', {
    provider: 'sportmonks',
    endpointKey: input.endpointKey,
    urlPath: input.urlPath,
    query: input.query ?? { page: String(input.page) },
    status: 'captured',
    page: input.page,
    hasMore: input.hasMore,
    payloadHash: input.payloadHash,
    fetchedAt: '2026-07-03T00:00:00.000Z',
    recordCount: 1
  });
}
