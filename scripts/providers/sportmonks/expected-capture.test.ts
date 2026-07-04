import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { SportmonksCaptureClient } from './capture.js';
import {
  buildSportmonksExpectedCaptureCatalog,
  runSportmonksExpectedCapture
} from './expected-capture.js';

describe('sportmonks expected/xG capture', () => {
  it('builds a focused non-live catalog for the two official expected endpoints', () => {
    const catalog = buildSportmonksExpectedCaptureCatalog();

    expect(catalog.map((entry) => entry.endpointKey)).toEqual([
      'expected.fixtures',
      'expected.lineups'
    ]);
    expect(catalog.map((entry) => entry.urlPath)).toEqual([
      '/expected/fixtures',
      '/expected/lineups'
    ]);
    expect(catalog.some((entry) => entry.isLive === true)).toBe(false);
    expect(catalog[0]).toMatchObject({
      defaultQuery: { include: 'type;fixture;participant' }
    });
    expect(catalog[1]).toMatchObject({
      defaultQuery: { include: 'type;fixture;player;team' }
    });
  });

  it('captures all pages for expected fixtures and lineups only', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-sportmonks-expected-'));
    const calls: Array<{ path: string; query: Record<string, string> }> = [];
    const client: SportmonksCaptureClient = {
      get: vi.fn(async (path: string, query: Record<string, string> = {}) => {
        calls.push({ path, query });
        return {
          ok: true as const,
          statusCode: 200,
          body: query.page === '1'
            ? { data: [{ id: 1 }], pagination: { has_more: true } }
            : { data: [{ id: 2 }], pagination: { has_more: false } },
          rateLimit: {}
        };
      })
    };

    const result = await runSportmonksExpectedCapture({
      captureRoot: root,
      client,
      now: () => '2026-07-04T00:00:00.000Z'
    });

    expect(result).toEqual({
      captured: 4,
      skipped: 0,
      unavailable: 0,
      failed: 0
    });
    expect(calls.map((call) => call.path)).toEqual([
      '/expected/fixtures',
      '/expected/fixtures',
      '/expected/lineups',
      '/expected/lineups'
    ]);
    expect(calls[0]?.query).toEqual({ include: 'type;fixture;participant', page: '1' });
    expect(calls[2]?.query).toEqual({ include: 'type;fixture;player;team', page: '1' });

    const manifest = await readFile(join(root, 'providers', 'sportmonks', 'manifests', 'capture-manifest.jsonl'), 'utf8');
    const lines = manifest.trim().split(/\r?\n/).map((line) => JSON.parse(line));
    expect(lines.map((line) => line.endpointKey)).toEqual([
      'expected.fixtures',
      'expected.fixtures',
      'expected.lineups',
      'expected.lineups'
    ]);
  });
});
