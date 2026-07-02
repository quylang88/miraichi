import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { SportmonksEndpointEntry } from './endpoint-catalog.js';
import { runSportmonksRawCapture, type SportmonksCaptureClient } from './capture.js';

describe('sportmonks raw capture', () => {
  it('captures allowed paginated endpoints and skips gated or per-id endpoints', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-sportmonks-capture-'));
    const catalog: SportmonksEndpointEntry[] = [
      { endpointKey: 'fixtures.all', group: 'fixtures', urlPath: '/fixtures', capturePolicy: 'allowed' },
      {
        endpointKey: 'fixtures.enrichedById',
        group: 'fixtures',
        urlPath: '/fixtures/{id}',
        capturePolicy: 'allowed',
        requiresId: true
      },
      { endpointKey: 'odds.prematch', group: 'odds', urlPath: '/odds/pre-match', capturePolicy: 'gated' }
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
      allowGatedEndpoints: false,
      catalog,
      client,
      now: () => '2026-07-02T00:00:00.000Z'
    });

    expect(result).toEqual({
      captured: 2,
      skipped: 2,
      unavailable: 0,
      failed: 0
    });
    expect(client.get).toHaveBeenNthCalledWith(1, '/fixtures', { page: '1' });
    expect(client.get).toHaveBeenNthCalledWith(2, '/fixtures', { page: '2' });

    const manifestPath = join(root, 'providers', 'sportmonks', 'manifests', 'capture-manifest.jsonl');
    const manifestLines = (await readFile(manifestPath, 'utf8')).trim().split(/\r?\n/).map((line) => JSON.parse(line));

    expect(manifestLines).toHaveLength(4);
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
    expect(manifestLines[3]).toMatchObject({
      endpointKey: 'odds.prematch',
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
      allowGatedEndpoints: false,
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
});
