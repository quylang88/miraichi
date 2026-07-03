import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  SPORTMONKS_NON_LIVE_FIXTURE_INCLUDE,
  buildFixtureEnrichmentRequests,
  buildSportmonksSubscriptionProbeRequests,
  createFixtureEnrichmentCoverageReport,
  extractFixtureIdsFromRawCapture,
  runSportmonksFixtureEnrichmentBatch,
  runSportmonksFixtureEnrichmentProbe,
  runSportmonksSubscriptionProbe
} from './fixture-enrichment-probe.js';
import type { SportmonksCaptureClient } from './capture.js';
import { createPayloadHash, writeRawProviderPayload } from '../shared/raw-cache.js';
import { appendProviderManifestEntry } from '../shared/manifest.js';

describe('sportmonks fixture enrichment probe', () => {
  it('builds non-live fixture enrichment requests with score/detail/odds includes', () => {
    expect(buildFixtureEnrichmentRequests([100, 100, 200])).toEqual([
      {
        endpointKey: 'fixtures.enrichedById',
        urlPath: '/fixtures/100',
        query: { include: SPORTMONKS_NON_LIVE_FIXTURE_INCLUDE }
      },
      {
        endpointKey: 'fixtures.enrichedById',
        urlPath: '/fixtures/200',
        query: { include: SPORTMONKS_NON_LIVE_FIXTURE_INCLUDE }
      }
    ]);
    expect(SPORTMONKS_NON_LIVE_FIXTURE_INCLUDE).toContain('scores');
    expect(SPORTMONKS_NON_LIVE_FIXTURE_INCLUDE).toContain('participants');
    expect(SPORTMONKS_NON_LIVE_FIXTURE_INCLUDE).toContain('events');
    expect(SPORTMONKS_NON_LIVE_FIXTURE_INCLUDE).toContain('statistics.type');
    expect(SPORTMONKS_NON_LIVE_FIXTURE_INCLUDE).toContain('odds');
    expect(SPORTMONKS_NON_LIVE_FIXTURE_INCLUDE).not.toContain('premiumOdds');
    expect(SPORTMONKS_NON_LIVE_FIXTURE_INCLUDE).not.toContain('inplayOdds');
  });

  it('creates a coverage report from enriched fixture payloads', () => {
    const report = createFixtureEnrichmentCoverageReport([
      {
        fixtureId: 100,
        status: 'captured',
        payload: {
          data: {
            id: 100,
            participants: [{ id: 1 }, { id: 2 }],
            scores: [{ score: { goals: 2 }, participant_id: 1 }],
            events: [{ type_id: 14, minute: 11 }],
            statistics: [{ type_id: 42, data: { value: 5 } }],
            odds: [{ fixture_id: 100 }],
            premiumOdds: [],
            predictions: [{ type_id: 1 }],
            xGFixture: { home: 1.2 }
          }
        }
      },
      {
        fixtureId: 200,
        status: 'unavailable',
        errorCode: '403',
        errorMessage: 'forbidden'
      }
    ]);

    expect(report).toMatchObject({
      fixtureCount: 2,
      captured: 1,
      unavailable: 1,
      failed: 0,
      fields: {
        participants: { fixturesWithData: 1 },
        scores: { fixturesWithData: 1 },
        events: { fixturesWithData: 1 },
        statistics: { fixturesWithData: 1 },
        odds: { fixturesWithData: 1 },
        premiumOdds: { fixturesWithData: 0 },
        predictions: { fixturesWithData: 1 },
        xGFixture: { fixturesWithData: 1 }
      }
    });
    expect(report.localMatchReadiness.canBuildCompletedMatches).toBe(true);
  });

  it('extracts fixture ids from raw fixture captures', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-sportmonks-probe-'));
    const payload = { data: [{ id: 100 }, { id: 200 }, { id: 100 }] };
    await writeRawProviderPayload(root, {
      schemaVersion: 'miraichi.provider.raw.v1',
      provider: 'sportmonks',
      endpointKey: 'fixtures.all',
      urlPath: '/fixtures',
      query: { page: '1' },
      fetchedAt: '2026-07-03T00:00:00.000Z',
      payloadHash: createPayloadHash(payload),
      rateLimit: {},
      payload
    });

    await expect(extractFixtureIdsFromRawCapture(root, 10)).resolves.toEqual([100, 200]);
  });

  it('captures enriched fixtures and writes a coverage report', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-sportmonks-probe-'));
    const client: SportmonksCaptureClient = {
      get: vi.fn(async (urlPath: string) => ({
        ok: true as const,
        statusCode: 200,
        body: {
          data: {
            id: Number(urlPath.split('/').at(-1)),
            participants: [{ id: 1 }, { id: 2 }],
            scores: [{ score: { goals: 1 } }],
            events: [{ minute: 50 }],
            statistics: [{ type_id: 42 }]
          }
        },
        rateLimit: {}
      }))
    };

    const report = await runSportmonksFixtureEnrichmentProbe({
      captureRoot: root,
      client,
      fixtureIds: [100],
      now: () => '2026-07-03T00:00:00.000Z',
      reportFileName: 'fixture-enrichment-coverage-report.json'
    });

    expect(report.captured).toBe(1);
    expect(client.get).toHaveBeenCalledWith('/fixtures/100', { include: SPORTMONKS_NON_LIVE_FIXTURE_INCLUDE });

    const reportPath = join(root, 'providers', 'sportmonks', 'reports', 'fixture-enrichment-coverage-report.json');
    expect(JSON.parse(await readFile(reportPath, 'utf8'))).toMatchObject({
      fixtureCount: 1,
      fields: {
        participants: { fixturesWithData: 1 },
        scores: { fixturesWithData: 1 },
        events: { fixturesWithData: 1 },
        statistics: { fixturesWithData: 1 }
      }
    });
  });

  it('runs a fixture enrichment batch from raw fixture inventory while skipping captured fixtures', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-sportmonks-batch-'));
    const fixtureListPayload = { data: [{ id: 300 }, { id: 100 }, { id: 200 }, { id: 200 }] };
    await writeRawProviderPayload(root, {
      schemaVersion: 'miraichi.provider.raw.v1',
      provider: 'sportmonks',
      endpointKey: 'fixtures.all',
      urlPath: '/fixtures',
      query: { page: '1' },
      fetchedAt: '2026-07-03T00:00:00.000Z',
      payloadHash: createPayloadHash(fixtureListPayload),
      rateLimit: {},
      payload: fixtureListPayload
    });
    await appendProviderManifestEntry(root, 'sportmonks', {
      provider: 'sportmonks',
      endpointKey: 'fixtures.enrichedById',
      urlPath: '/fixtures/100',
      query: { include: SPORTMONKS_NON_LIVE_FIXTURE_INCLUDE },
      status: 'captured',
      payloadHash: 'already-captured',
      fetchedAt: '2026-07-03T00:00:00.000Z',
      recordCount: 1
    });

    const client: SportmonksCaptureClient = {
      get: vi.fn(async (urlPath: string) => ({
        ok: true as const,
        statusCode: 200,
        body: {
          data: {
            id: Number(urlPath.split('/').at(-1)),
            participants: [{ id: 1 }, { id: 2 }],
            scores: [{ score: { goals: 1 } }]
          }
        },
        rateLimit: { remaining: 90 }
      }))
    };

    const report = await runSportmonksFixtureEnrichmentBatch({
      captureRoot: root,
      client,
      maxFixtures: 2,
      now: () => '2026-07-03T00:00:00.000Z',
      reportFileName: 'fixture-enrichment-batch-report.json'
    });

    expect(client.get).toHaveBeenNthCalledWith(1, '/fixtures/200', { include: SPORTMONKS_NON_LIVE_FIXTURE_INCLUDE });
    expect(client.get).toHaveBeenNthCalledWith(2, '/fixtures/300', { include: SPORTMONKS_NON_LIVE_FIXTURE_INCLUDE });
    expect(report).toMatchObject({
      sourceFixtureCount: 3,
      alreadyCapturedCount: 1,
      selectedFixtureCount: 2,
      attempted: 2,
      captured: 2,
      unavailable: 0,
      failed: 0,
      selectedFixtureIds: [200, 300],
      fields: {
        participants: { fixturesWithData: 2 },
        scores: { fixturesWithData: 2 }
      }
    });

    const reportPath = join(root, 'providers', 'sportmonks', 'reports', 'fixture-enrichment-batch-report.json');
    expect(JSON.parse(await readFile(reportPath, 'utf8'))).toMatchObject({
      selectedFixtureCount: 2,
      selectedFixtureIds: [200, 300]
    });
  });

  it('runs a full fixture enrichment batch for all fixtures in selected leagues', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-sportmonks-league-batch-'));
    const fixtureListPayload = {
      data: [
        { id: 100, league_id: 85, season_id: 1 },
        { id: 200, league_id: 85, season_id: 2 },
        { id: 300, league_id: 8, season_id: 1 },
        { id: 400, league_id: 85, season_id: 3 }
      ]
    };
    await writeRawProviderPayload(root, {
      schemaVersion: 'miraichi.provider.raw.v1',
      provider: 'sportmonks',
      endpointKey: 'fixtures.all',
      urlPath: '/fixtures',
      query: { page: '1' },
      fetchedAt: '2026-07-03T00:00:00.000Z',
      payloadHash: createPayloadHash(fixtureListPayload),
      rateLimit: {},
      payload: fixtureListPayload
    });

    const client: SportmonksCaptureClient = {
      get: vi.fn(async (urlPath: string) => ({
        ok: true as const,
        statusCode: 200,
        body: {
          data: {
            id: Number(urlPath.split('/').at(-1)),
            participants: [{ id: 1 }, { id: 2 }],
            scores: [{ score: { goals: 1 } }]
          }
        },
        rateLimit: {}
      }))
    };

    const report = await runSportmonksFixtureEnrichmentBatch({
      captureRoot: root,
      client,
      leagueIds: [85],
      now: () => '2026-07-03T00:00:00.000Z',
      reportFileName: 'fixture-enrichment-league-batch-report.json'
    });

    expect(client.get).toHaveBeenCalledTimes(3);
    expect(client.get).toHaveBeenNthCalledWith(1, '/fixtures/100', { include: SPORTMONKS_NON_LIVE_FIXTURE_INCLUDE });
    expect(client.get).toHaveBeenNthCalledWith(2, '/fixtures/200', { include: SPORTMONKS_NON_LIVE_FIXTURE_INCLUDE });
    expect(client.get).toHaveBeenNthCalledWith(3, '/fixtures/400', { include: SPORTMONKS_NON_LIVE_FIXTURE_INCLUDE });
    expect(report).toMatchObject({
      sourceFixtureCount: 4,
      filteredFixtureCount: 3,
      selectedFixtureCount: 3,
      selectedFixtureIds: [100, 200, 400],
      filters: { leagueIds: [85] }
    });
  });

  it('builds and captures subscription probe requests outside the football base path', async () => {
    expect(buildSportmonksSubscriptionProbeRequests().map((request) => request.urlPath)).toEqual([
      '/my/enrichments',
      '/my/resources',
      '/my/leagues',
      '/my/usage'
    ]);

    const root = await mkdtemp(join(tmpdir(), 'miraichi-sportmonks-subscription-'));
    const client: SportmonksCaptureClient = {
      get: vi.fn(async (urlPath: string) => ({
        ok: true as const,
        statusCode: 200,
        body: { data: [{ endpoint: urlPath }] },
        rateLimit: {}
      }))
    };

    const result = await runSportmonksSubscriptionProbe({
      captureRoot: root,
      client,
      now: () => '2026-07-03T00:00:00.000Z'
    });

    expect(result).toEqual({ captured: 4, unavailable: 0, failed: 0 });
  });
});
