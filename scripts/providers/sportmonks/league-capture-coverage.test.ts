import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { appendProviderManifestEntry } from '../shared/manifest.js';
import { createPayloadHash, writeRawProviderPayload } from '../shared/raw-cache.js';
import {
  createSportmonksCaptureCoverageIndex,
  createSportmonksRequestFamilyKey,
  readSportmonksFixtureFieldCoverage,
  readSportmonksGlobalReferenceCoverage,
  resolveSportmonksRequestProgress
} from './league-capture-coverage.js';
import type { SportmonksLeagueCaptureRequest } from './league-capture-plan.js';

// Helper — write a raw envelope and return its fetchedAt and hash for later use
async function writeRaw(
  root: string,
  endpointKey: string,
  urlPath: string,
  payload: unknown,
  fetchedAt = '2026-07-07T00:00:00.000Z'
): Promise<{ fetchedAt: string; payloadHash: string }> {
  const payloadHash = createPayloadHash(payload);
  await writeRawProviderPayload(root, {
    schemaVersion: 'miraichi.provider.raw.v1',
    provider: 'sportmonks',
    endpointKey,
    urlPath,
    query: {},
    fetchedAt,
    payloadHash,
    rateLimit: {},
    payload
  });
  return { fetchedAt, payloadHash };
}

function makeRequest(
  endpointKey: string,
  urlPath: string,
  query: Record<string, string> = {},
  paginated = true,
  opts: { fixtureId?: number; teamId?: number; seasonId?: number } = {}
): SportmonksLeagueCaptureRequest {
  return {
    endpointKey,
    group: 'fixture',
    urlPath,
    query,
    paginated,
    ...opts
  };
}

describe('createSportmonksRequestFamilyKey', () => {
  it('sorts query keys and excludes page, cursor, and api_token', () => {
    const req = makeRequest('fixtures.enrichedById', '/fixtures/100', {
      include: 'scores;participants',
      page: '2',
      api_token: 'secret',
      cursor: 'abc'
    });
    const key = createSportmonksRequestFamilyKey(req);
    expect(key).toContain('include=');
    expect(key).not.toContain('page=');
    expect(key).not.toContain('api_token=');
    expect(key).not.toContain('cursor=');
    // Keys must be sorted
    const keyParts = key.split('&');
    expect(keyParts).toEqual([...keyParts].sort());
  });

  it('produces the same key for the same request regardless of query insertion order', () => {
    const r1 = makeRequest('fixtures.enrichedById', '/fixtures/100', { b: '2', a: '1' });
    const r2 = makeRequest('fixtures.enrichedById', '/fixtures/100', { a: '1', b: '2' });
    expect(createSportmonksRequestFamilyKey(r1)).toBe(createSportmonksRequestFamilyKey(r2));
  });
});

describe('resolveSportmonksRequestProgress', () => {
  it('reuses one in-memory manifest index across multiple request lookups', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-coverage-'));
    const { fetchedAt, payloadHash } = await writeRaw(root, 'fixtures.enrichedById', '/fixtures/100', { data: { id: 100, xGFixture: [] } });
    await appendProviderManifestEntry(root, 'sportmonks', {
      provider: 'sportmonks',
      endpointKey: 'fixtures.enrichedById',
      urlPath: '/fixtures/100',
      query: {},
      status: 'captured',
      page: 1,
      hasMore: false,
      fetchedAt,
      payloadHash
    });

    const index = await createSportmonksCaptureCoverageIndex(root);
    await rm(join(root, 'providers', 'sportmonks', 'manifests', 'capture-manifest.jsonl'));

    const request = makeRequest('fixtures.enrichedById', '/fixtures/100', {}, false, { fixtureId: 100 });
    await expect(index.resolveRequestProgress(request)).resolves.toMatchObject({ action: 'skip' });
    await expect(index.resolveRequestProgress(request)).resolves.toMatchObject({ action: 'skip' });
  });

  it('skips only when terminal manifest evidence and a valid raw envelope both exist', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-coverage-'));
    const { fetchedAt, payloadHash } = await writeRaw(root, 'fixtures.enrichedById', '/fixtures/100', { data: { id: 100, xGFixture: [] } });
    await appendProviderManifestEntry(root, 'sportmonks', {
      provider: 'sportmonks',
      endpointKey: 'fixtures.enrichedById',
      urlPath: '/fixtures/100',
      query: {},
      status: 'captured',
      page: 1,
      hasMore: false,
      fetchedAt,
      payloadHash
    });

    const req = makeRequest('fixtures.enrichedById', '/fixtures/100', {}, false, { fixtureId: 100 });
    const progress = await resolveSportmonksRequestProgress(root, req);
    expect(progress.action).toBe('skip');
  });

  it('recaptures when a captured manifest points to a missing raw envelope', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-coverage-'));
    // Write manifest but NOT the raw file
    await appendProviderManifestEntry(root, 'sportmonks', {
      provider: 'sportmonks',
      endpointKey: 'fixtures.enrichedById',
      urlPath: '/fixtures/100',
      query: {},
      status: 'captured',
      page: 1,
      hasMore: false,
      fetchedAt: '2026-07-07T00:00:00.000Z',
      payloadHash: 'a'.repeat(64)
    });

    const req = makeRequest('fixtures.enrichedById', '/fixtures/100', {}, false, { fixtureId: 100 });
    const progress = await resolveSportmonksRequestProgress(root, req);
    expect(progress.action).toBe('capture');
    expect(progress.page).toBe(1);
    expect(progress.resumed).toBe(false);
  });

  it('resumes a paginated request from the stored cursor', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-coverage-'));
    const payload = { data: [{ id: 1 }], pagination: { has_more: true, next_cursor: 'cursor-abc' } };
    const { fetchedAt, payloadHash } = await writeRaw(root, 'odds.prematchByFixtureId', '/odds/pre-match/fixtures/100', payload);
    await appendProviderManifestEntry(root, 'sportmonks', {
      provider: 'sportmonks',
      endpointKey: 'odds.prematchByFixtureId',
      urlPath: '/odds/pre-match/fixtures/100',
      query: {},
      status: 'captured',
      page: 1,
      hasMore: true,
      fetchedAt,
      payloadHash
    });

    const req = makeRequest('odds.prematchByFixtureId', '/odds/pre-match/fixtures/100', {}, true, { fixtureId: 100 });
    const progress = await resolveSportmonksRequestProgress(root, req);
    expect(progress.action).toBe('capture');
    expect(progress.resumed).toBe(true);
    expect(progress.query['cursor']).toBe('cursor-abc');
  });

  it('returns capture page 1 when no manifest entry exists', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-coverage-'));
    const req = makeRequest('odds.prematchByFixtureId', '/odds/pre-match/fixtures/100', {}, true, { fixtureId: 100 });
    const progress = await resolveSportmonksRequestProgress(root, req);
    expect(progress.action).toBe('capture');
    expect(progress.page).toBe(1);
    expect(progress.resumed).toBe(false);
  });

  it('rejects skip for enriched fixtures that do not contain xGFixture in raw envelope', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-coverage-'));
    
    // Write outdated payload (no xGFixture)
    const outdatedPayload = { data: { id: 100, scores: [], participants: [] } };
    const { fetchedAt: fat1, payloadHash: ph1 } = await writeRaw(root, 'fixtures.enrichedById', '/fixtures/100', outdatedPayload);
    await appendProviderManifestEntry(root, 'sportmonks', {
      provider: 'sportmonks',
      endpointKey: 'fixtures.enrichedById',
      urlPath: '/fixtures/100',
      query: {},
      status: 'captured',
      page: 1,
      hasMore: false,
      fetchedAt: fat1,
      payloadHash: ph1
    });

    const req = makeRequest('fixtures.enrichedById', '/fixtures/100', {}, false, { fixtureId: 100 });
    const progress1 = await resolveSportmonksRequestProgress(root, req);
    expect(progress1.action).toBe('capture'); // Should NOT skip

    // Write updated payload (has xGFixture, even if empty array)
    const updatedPayload = { data: { id: 100, scores: [], participants: [], xGFixture: [] } };
    const { fetchedAt: fat2, payloadHash: ph2 } = await writeRaw(root, 'fixtures.enrichedById', '/fixtures/100', updatedPayload);
    // Overwrite manifest with the new entry
    await appendProviderManifestEntry(root, 'sportmonks', {
      provider: 'sportmonks',
      endpointKey: 'fixtures.enrichedById',
      urlPath: '/fixtures/100',
      query: {},
      status: 'captured',
      page: 1,
      hasMore: false,
      fetchedAt: fat2,
      payloadHash: ph2
    });

    const progress2 = await resolveSportmonksRequestProgress(root, req);
    expect(progress2.action).toBe('skip'); // Should skip
  });
});

describe('readSportmonksFixtureFieldCoverage', () => {
  it('reads odds, predictions, xGFixture, and comments presence from enriched fixture raw data', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-coverage-'));
    await writeRaw(root, 'fixtures.enrichedById', '/fixtures/100', {
      data: {
        id: 100,
        odds: [{ id: 1 }],
        predictions: [{ id: 2 }],
        xGFixture: [{ id: 3 }],
        // no comments
      }
    });

    const coverage = await readSportmonksFixtureFieldCoverage(root, 100);
    expect(coverage.odds).toBe(true);
    expect(coverage.predictions).toBe(true);
    expect(coverage.xGFixture).toBe(true);
    expect(coverage.comments).toBe(false);
  });

  it('returns all false when no enriched fixture raw exists', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-coverage-'));
    const coverage = await readSportmonksFixtureFieldCoverage(root, 999);
    expect(coverage).toEqual({ odds: false, predictions: false, xGFixture: false, comments: false });
  });

  it('treats empty arrays as missing coverage', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-coverage-'));
    await writeRaw(root, 'fixtures.enrichedById', '/fixtures/100', {
      data: {
        id: 100,
        odds: [],
        predictions: [],
        xGFixture: [],
        comments: []
      }
    });

    const coverage = await readSportmonksFixtureFieldCoverage(root, 100);
    expect(coverage.odds).toBe(false);
    expect(coverage.predictions).toBe(false);
    expect(coverage.xGFixture).toBe(false);
    expect(coverage.comments).toBe(false);
  });
});

describe('readSportmonksGlobalReferenceCoverage', () => {
  it('reports global references as complete only when terminal raw evidence validates', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-coverage-'));

    // types.all — has valid terminal raw
    const { fetchedAt, payloadHash } = await writeRaw(root, 'types.all', '/types', { data: [{ id: 1 }] });
    await appendProviderManifestEntry(root, 'sportmonks', {
      provider: 'sportmonks',
      endpointKey: 'types.all',
      urlPath: '/types',
      query: {},
      status: 'captured',
      hasMore: false,
      fetchedAt,
      payloadHash
    });

    // markets.all — manifest entry only (no raw file)
    await appendProviderManifestEntry(root, 'sportmonks', {
      provider: 'sportmonks',
      endpointKey: 'markets.all',
      urlPath: '/markets',
      query: {},
      status: 'captured',
      hasMore: false,
      fetchedAt: '2026-07-07T00:00:00.000Z',
      payloadHash: 'b'.repeat(64)
    });

    const coverage = await readSportmonksGlobalReferenceCoverage(root);
    expect(coverage.complete).toContain('types.all');
    expect(coverage.missing).toContain('markets.all');
  });
});
