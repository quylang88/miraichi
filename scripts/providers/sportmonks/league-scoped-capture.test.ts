import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createPayloadHash, writeRawProviderPayload } from '../shared/raw-cache.js';
import type { SportmonksCaptureClient } from './capture.js';
import { runSportmonksLeagueScopedCapture } from './league-scoped-capture.js';

// Write a minimal raw fixture inventory so the executor can build its inventory
async function writeInventory(root: string): Promise<void> {
  const fixturePayload = {
    data: [
      { id: 100, league_id: 8, season_id: 2025 },
      { id: 101, league_id: 8, season_id: 2025 }
    ]
  };
  const seasonPayload = {
    data: [{ id: 2025, league_id: 8, name: '2025/2026', ending_at: '2026-05-31' }]
  };
  const teamPayload = { data: [{ id: 1 }] };

  await writeRawProviderPayload(root, {
    schemaVersion: 'miraichi.provider.raw.v1',
    provider: 'sportmonks',
    endpointKey: 'fixtures.all',
    urlPath: '/fixtures',
    query: {},
    fetchedAt: '2026-07-07T00:00:00.000Z',
    payloadHash: createPayloadHash(fixturePayload),
    rateLimit: {},
    payload: fixturePayload
  });
  await writeRawProviderPayload(root, {
    schemaVersion: 'miraichi.provider.raw.v1',
    provider: 'sportmonks',
    endpointKey: 'seasons.all',
    urlPath: '/seasons',
    query: {},
    fetchedAt: '2026-07-07T00:00:00.000Z',
    payloadHash: createPayloadHash(seasonPayload),
    rateLimit: {},
    payload: seasonPayload
  });
  await writeRawProviderPayload(root, {
    schemaVersion: 'miraichi.provider.raw.v1',
    provider: 'sportmonks',
    endpointKey: 'teams.bySeasonId',
    urlPath: '/teams/seasons/2025',
    query: {},
    fetchedAt: '2026-07-07T00:00:00.000Z',
    payloadHash: createPayloadHash(teamPayload),
    rateLimit: {},
    payload: teamPayload
  });
}

function makeClient(
  responses: Map<string, { ok: true; body: unknown } | { ok: false; status: 'unavailable' | 'rate_limited' | 'failed'; message: string }>
): SportmonksCaptureClient {
  return {
    async get(urlPath: string): Promise<{ ok: true; statusCode: number; body: unknown; rateLimit: {} } | { ok: false; status: 'rate_limited' | 'unavailable' | 'failed'; statusCode: number; message: string; rateLimit: {} }> {
      const resp = responses.get(urlPath);
      if (!resp) {
        return { ok: true, statusCode: 200, body: { data: [], pagination: { has_more: false } }, rateLimit: {} };
      }
      if (resp.ok) {
        return { ok: true, statusCode: 200, body: resp.body, rateLimit: {} };
      }
      return { ok: false, status: resp.status, statusCode: resp.status === 'unavailable' ? 403 : resp.status === 'rate_limited' ? 429 : 500, message: resp.message, rateLimit: {} };
    }
  };
}

describe('runSportmonksLeagueScopedCapture', () => {
  it('skips existing fixture enrichment and calls only missing fixture odds', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-executor-'));
    await writeInventory(root);

    // Pre-write an enriched fixture for 100 (with participants/scores but no odds)
    const enrichedPayload = {
      data: {
        id: 100,
        participants: [{ id: 1, meta: { location: 'home' } }],
        scores: [],
        odds: []
      }
    };
    const enrichedHash = createPayloadHash(enrichedPayload);
    const enrichedFetchedAt = '2026-07-07T00:00:00.000Z';
    await writeRawProviderPayload(root, {
      schemaVersion: 'miraichi.provider.raw.v1',
      provider: 'sportmonks',
      endpointKey: 'fixtures.enrichedById',
      urlPath: '/fixtures/100',
      query: {},
      fetchedAt: enrichedFetchedAt,
      payloadHash: enrichedHash,
      rateLimit: {},
      payload: enrichedPayload
    });
    // Write terminal manifest entry so resolveSportmonksRequestProgress can skip
    const { appendProviderManifestEntry } = await import('../shared/manifest.js');
    await appendProviderManifestEntry(root, 'sportmonks', {
      provider: 'sportmonks',
      endpointKey: 'fixtures.enrichedById',
      urlPath: '/fixtures/100',
      query: {},
      status: 'captured',
      page: 1,
      hasMore: false,
      fetchedAt: enrichedFetchedAt,
      payloadHash: enrichedHash
    });

    const calledPaths: string[] = [];
    const client: SportmonksCaptureClient = {
      async get(urlPath: string): Promise<{ ok: true; statusCode: number; body: unknown; rateLimit: {} }> {
        calledPaths.push(urlPath);
        return { ok: true, statusCode: 200, body: { data: [], pagination: { has_more: false } }, rateLimit: {} };
      }
    };

    await runSportmonksLeagueScopedCapture({
      captureRoot: root,
      client,
      leagueId: 8,
      groups: ['fixture'],
      skipExisting: true,
      log: () => undefined
    });

    // /fixtures/100 had terminal evidence so must be skipped
    // but /fixtures/101 had no evidence so must be captured
    // odds for 100: empty array in enriched payload → odds NOT suppressed → odds gets called
    expect(calledPaths).not.toContain('/fixtures/100');
    expect(calledPaths).toContain('/fixtures/101');
  });

  it('suppresses fixture odds and prediction requests when enrichment already contains them', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-executor-'));
    await writeInventory(root);

    // Pre-write enriched fixture for both 100 and 101 with odds and predictions
    for (const fixtureId of [100, 101]) {
      const enrichedPayload = {
        data: {
          id: fixtureId,
          odds: [{ id: 1 }],
          predictions: [{ id: 2 }],
          xGFixture: [{ id: 3 }]
        }
      };
      const payloadHash = createPayloadHash(enrichedPayload);
      await writeRawProviderPayload(root, {
        schemaVersion: 'miraichi.provider.raw.v1',
        provider: 'sportmonks',
        endpointKey: 'fixtures.enrichedById',
        urlPath: `/fixtures/${fixtureId}`,
        query: {},
        fetchedAt: '2026-07-07T00:00:00.000Z',
        payloadHash,
        rateLimit: {},
        payload: enrichedPayload
      });
      // Also write manifest with terminal evidence
      const { appendProviderManifestEntry } = await import('../shared/manifest.js');
      await appendProviderManifestEntry(root, 'sportmonks', {
        provider: 'sportmonks',
        endpointKey: 'fixtures.enrichedById',
        urlPath: `/fixtures/${fixtureId}`,
        query: {},
        status: 'captured',
        page: 1,
        hasMore: false,
        fetchedAt: '2026-07-07T00:00:00.000Z',
        payloadHash
      });
    }

    const calledPaths: string[] = [];
    const client: SportmonksCaptureClient = {
      async get(urlPath: string): Promise<{ ok: true; statusCode: number; body: unknown; rateLimit: {} }> {
        calledPaths.push(urlPath);
        return { ok: true, statusCode: 200, body: { data: [], pagination: { has_more: false } }, rateLimit: {} };
      }
    };

    await runSportmonksLeagueScopedCapture({
      captureRoot: root,
      client,
      leagueId: 8,
      groups: ['fixture'],
      skipExisting: true,
      log: () => undefined
    });

    // No calls to fixture enrichment (both skipped by terminal manifest evidence)
    expect(calledPaths.filter((p) => p.startsWith('/fixtures/'))).toHaveLength(0);
    // odds/pre-match calls suppressed because enrichment has odds
    expect(calledPaths.some((p) => p.includes('/odds/pre-match/'))).toBe(false);
    // probabilities suppressed because enrichment has predictions
    expect(calledPaths.some((p) => p.includes('/predictions/probabilities/'))).toBe(false);
    // value-bets are NOT suppressed (spec: value-bet dedup handled by exact request coverage only)
  });

  it('stops before exceeding maxRequests and reports max_requests', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-executor-'));
    await writeInventory(root);

    let callCount = 0;
    const client: SportmonksCaptureClient = {
      async get(): Promise<{ ok: true; statusCode: number; body: unknown; rateLimit: {} }> {
        callCount++;
        return { ok: true, statusCode: 200, body: { data: [], pagination: { has_more: false } }, rateLimit: {} };
      }
    };

    const result = await runSportmonksLeagueScopedCapture({
      captureRoot: root,
      client,
      leagueId: 8,
      groups: ['fixture'],
      maxRequests: 1,
      skipExisting: true,
      log: () => undefined
    });

    expect(callCount).toBe(1);
    expect(result.stoppedEarlyReason).toBe('max_requests');
  });

  it('records unavailable requests and stops cleanly on rate limiting', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-executor-'));
    await writeInventory(root);

    let callCount = 0;
    const client: SportmonksCaptureClient = {
      async get(): Promise<{ ok: false; status: 'unavailable' | 'rate_limited'; statusCode: number; message: string; rateLimit: {} }> {
        callCount++;
        if (callCount === 1) {
          return { ok: false, status: 'unavailable', statusCode: 403, message: 'forbidden', rateLimit: {} };
        }
        return { ok: false, status: 'rate_limited', statusCode: 429, message: 'rate limited', rateLimit: {} };
      }
    };

    const result = await runSportmonksLeagueScopedCapture({
      captureRoot: root,
      client,
      leagueId: 8,
      groups: ['fixture'],
      skipExisting: true,
      log: () => undefined
    });

    expect(result.unavailable).toBeGreaterThanOrEqual(1);
    expect(result.stoppedEarlyReason).toBe('rate_limited');
    expect(result.failed).toBe(0);
  });

  it('writes a timestamped report under providers/sportmonks/reports without token', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-executor-'));
    await writeInventory(root);

    await runSportmonksLeagueScopedCapture({
      captureRoot: root,
      client: makeClient(new Map()),
      leagueId: 8,
      groups: ['fixture'],
      skipExisting: true,
      log: () => undefined
    });

    const reportsDir = join(root, 'providers', 'sportmonks', 'reports');
    const files = await readdir(reportsDir);
    expect(files.length).toBeGreaterThan(0);

    const reportContent = await readFile(join(reportsDir, files[0]!), 'utf8');
    expect(reportContent).not.toContain('api_token');
    const report = JSON.parse(reportContent) as Record<string, unknown>;
    expect(report.groupResults).toBeDefined();
    expect(report.missingGlobalReferences).toBeDefined();
    expect(report.excludedEndpointFamilies).toEqual(['global-all', 'livescores', 'inplay-odds', 'expected-lineups']);
  });

  it('increments logical pages and sends cursor requests without page=1', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-executor-'));
    await writeInventory(root);
    const calls: Array<{ path: string; query: Record<string, string> }> = [];
    const logs: string[] = [];
    const client: SportmonksCaptureClient = {
      async get(urlPath: string, query: Record<string, string> = {}) {
        calls.push({ path: urlPath, query });
        return {
          ok: true as const,
          statusCode: 200,
          body: calls.length === 1
            ? { data: [{ id: 1 }], pagination: { has_more: true, next_cursor: 'cursor-next' } }
            : { data: [{ id: 2 }], pagination: { has_more: false } },
          rateLimit: {}
        };
      }
    };

    await runSportmonksLeagueScopedCapture({
      captureRoot: root,
      client,
      leagueId: 8,
      groups: ['season'],
      maxRequests: 2,
      skipExisting: true,
      log: (message) => logs.push(message)
    });

    expect(calls[0]).toMatchObject({ query: { page: '1' } });
    expect(calls[1]).toMatchObject({ query: { cursor: 'cursor-next' } });
    expect(calls[1]?.query.page).toBeUndefined();
    expect(logs.filter((line) => line.includes('[capture]'))).toEqual([
      '[capture] schedules.bySeasonId /schedules/seasons/2025 page=1',
      '[capture] schedules.bySeasonId /schedules/seasons/2025 page=2'
    ]);
  });
});
