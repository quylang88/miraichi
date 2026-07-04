import { afterEach, describe, expect, it, vi } from 'vitest';
import { getMatchFeed } from './match-feed-service.js';
import { LocalMatch, LocalDataSnapshotStatus } from '@miraichi/shared';

describe('web match feed service', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const validMatch: LocalMatch = {
    id: 'match-1',
    competition: {
      id: 'world-cup-2026',
      name: 'FIFA World Cup',
      type: 'national-team',
      season: '2026'
    },
    kickoffUtc: '2026-06-11T19:00:00.000Z',
    status: 'scheduled',
    homeTeam: { id: 'team-mexico', name: 'Mexico' },
    awayTeam: { id: 'team-safrica', name: 'South Africa' },
    score: { home: null, away: null },
    sourceRefs: [],
    updatedAt: '2026-07-01T00:00:00.000Z'
  };

  const validSnapshot: LocalDataSnapshotStatus = {
    snapshotId: 'test-snapshot',
    generatedAt: '2026-07-01T00:00:00.000Z',
    importedAt: '2026-07-01T00:00:00.000Z',
    matchCount: 1,
    competitions: [],
    sources: [],
    freshness: 'fresh',
    warnings: []
  };

  it('returns a ready state from the serving match API payload', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      matches: [validMatch],
      snapshot: validSnapshot
    }), { status: 200 })));

    const result = await getMatchFeed('2026-06-11');
    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].id).toBe('match-1');
      expect(result.snapshot.snapshotId).toBe('test-snapshot');
    }
  });

  it('returns empty state including snapshot health', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      matches: [],
      snapshot: validSnapshot
    }), { status: 200 })));

    const result = await getMatchFeed('2026-06-11');
    expect(result.status).toBe('empty');
    if (result.status === 'empty') {
      expect(result.snapshot.snapshotId).toBe('test-snapshot');
    }
  });

  it('returns unavailable state and maps serving_match_store_missing to actionable copy', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      error: {
        code: 'serving_match_store_missing',
        message: 'Serving store not found'
      }
    }), { status: 503 })));

    const result = await getMatchFeed('2026-06-11');
    expect(result.status).toBe('unavailable');
    if (result.status === 'unavailable') {
      expect(result.reason).toContain('Serving match store is missing. Build it from canonical warehouse before using match workflows.');
      expect(result.warnings).toContain('serving_match_store_missing');
    }
  });

  it('fails normalization when response contains sourceProviderId or providerFixtureId', async () => {
    const invalidMatch = {
      ...validMatch,
      sourceProviderId: 'api-football'
    };

    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      matches: [invalidMatch],
      snapshot: validSnapshot
    }), { status: 200 })));

    const result = await getMatchFeed('2026-06-11');
    expect(result.status).toBe('unavailable');
    if (result.status === 'unavailable') {
      expect(result.reason).toContain('Normalization error');
    }
  });
});
