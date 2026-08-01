import { describe, expect, it } from 'vitest';
import {
  validateCanonicalMatch,
  validateFieldProvenance,
  validateProviderCaptureManifestEntry,
  validateProviderLink,
  validateRawProviderPayloadEnvelope
} from './provider-ingestion-contracts.js';
import { validateLocalMatch } from './local-match-contracts.js';

describe('provider-neutral ingestion contracts', () => {
  it('accepts raw provider envelopes without making the provider canonical', () => {
    expect(validateRawProviderPayloadEnvelope({
      schemaVersion: 'miraichi.provider.raw.v1',
      provider: 'manual-snapshot',
      endpointKey: 'fixtures.all',
      urlPath: '/v3/football/fixtures',
      query: { filters: 'populate', page: '1' },
      fetchedAt: '2026-07-02T00:00:00.000Z',
      payloadHash: 'a'.repeat(64),
      rateLimit: { requestedEntity: 'Fixture', remaining: 1999, resetsInSeconds: 3600 },
      payload: { data: [{ id: 1 }] }
    })).toEqual({ ok: true });
  });

  it('accepts OpenFootball raw text envelopes with source and response evidence', () => {
    expect(validateRawProviderPayloadEnvelope({
      schemaVersion: 'miraichi.provider.raw.v1',
      provider: 'openfootball',
      endpointKey: 'openfootball-england-premier-league-2026-27',
      urlPath: '/openfootball/england/master/2026-27/1-premierleague.txt',
      query: {},
      fetchedAt: '2026-07-02T00:00:00.000Z',
      payloadHash: 'a'.repeat(64),
      rateLimit: {},
      source: {
        allowlistEntryId: 'openfootball-england-premier-league-2026-27',
        repository: 'england',
        ref: 'master',
        filePath: '2026-27/1-premierleague.txt'
      },
      response: {
        contentType: 'text/plain; charset=utf-8',
        byteCount: 33
      },
      payload: '= English Premier League 2026/27\n'
    })).toEqual({ ok: true });
  });

  it('rejects OpenFootball envelopes without exact text metadata', () => {
    const result = validateRawProviderPayloadEnvelope({
      schemaVersion: 'miraichi.provider.raw.v1',
      provider: 'openfootball',
      endpointKey: 'openfootball-england-premier-league-2026-27',
      urlPath: '/openfootball/england/master/2026-27/1-premierleague.txt',
      query: { stale: '1' },
      fetchedAt: '2026-07-02T00:00:00.000Z',
      payloadHash: 'a'.repeat(64),
      rateLimit: {},
      source: { allowlistEntryId: '', repository: 'england', ref: 'master', filePath: '2026-27/1-premierleague.txt' },
      response: { contentType: '', byteCount: -1 },
      payload: { text: 'not exact source text' }
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('query'),
      expect.stringContaining('source.allowlistEntryId'),
      expect.stringContaining('response.contentType'),
      expect.stringContaining('response.byteCount'),
      expect.stringContaining('payload')
    ]));
  });

  it('rejects an OpenFootball envelope whose source, endpoint, or URL path does not bind to its allowlist entry', () => {
    const result = validateRawProviderPayloadEnvelope({
      schemaVersion: 'miraichi.provider.raw.v1',
      provider: 'openfootball',
      endpointKey: 'openfootball-world-cup-2026-group-stage',
      urlPath: '/openfootball/worldcup/master/2026--canada-usa-mexico/cup.txt',
      query: {},
      fetchedAt: '2026-07-02T00:00:00.000Z',
      payloadHash: 'a'.repeat(64),
      rateLimit: {},
      source: {
        allowlistEntryId: 'openfootball-england-premier-league-2026-27',
        repository: 'worldcup',
        ref: 'master',
        filePath: '2026--canada-usa-mexico/cup.txt'
      },
      response: { contentType: 'text/plain; charset=utf-8', byteCount: 33 },
      payload: '= English Premier League 2026/27\n'
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('source.repository'),
      expect.stringContaining('endpointKey'),
      expect.stringContaining('urlPath')
    ]));
  });

  it('accepts OpenFootball capture manifests only with immutable run evidence', () => {
    expect(validateProviderCaptureManifestEntry({
      runId: 'run-20260702-0001',
      allowlistEntryId: 'openfootball-england-premier-league-2026-27',
      provider: 'openfootball',
      endpointKey: 'openfootball-england-premier-league-2026-27',
      urlPath: '/openfootball/england/master/2026-27/1-premierleague.txt',
      query: {},
      status: 'captured',
      fetchedAt: '2026-07-02T00:00:00.000Z',
      httpStatus: 200,
      attemptCount: 1,
      payloadHash: 'a'.repeat(64),
      recordCount: 380
    })).toEqual({ ok: true });
  });

  it('rejects incomplete OpenFootball capture manifests while retaining manual snapshots', () => {
    const invalid = validateProviderCaptureManifestEntry({
      provider: 'openfootball',
      endpointKey: 'openfootball-england-premier-league-2026-27',
      urlPath: '/openfootball/england/master/2026-27/1-premierleague.txt',
      query: {},
      status: 'captured'
    });
    expect(invalid.ok).toBe(false);
    expect(invalid.ok ? [] : invalid.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('runId'),
      expect.stringContaining('allowlistEntryId'),
      expect.stringContaining('fetchedAt')
    ]));

    expect(validateProviderCaptureManifestEntry({
      provider: 'manual-snapshot',
      endpointKey: 'manual-bet-context',
      urlPath: '/manual/bet-context',
      query: {},
      status: 'captured'
    })).toEqual({ ok: true });
  });

  it('rejects an OpenFootball manifest whose tracked entry does not match its endpoint and URL path', () => {
    const result = validateProviderCaptureManifestEntry({
      runId: 'run-20260702-0001',
      allowlistEntryId: 'openfootball-england-premier-league-2026-27',
      provider: 'openfootball',
      endpointKey: 'openfootball-world-cup-2026-group-stage',
      urlPath: '/openfootball/worldcup/master/2026--canada-usa-mexico/cup.txt',
      query: {},
      status: 'captured',
      fetchedAt: '2026-07-02T00:00:00.000Z'
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('endpointKey'),
      expect.stringContaining('urlPath')
    ]));
  });

  it('accepts canonical matches with provider-neutral ids', () => {
    expect(validateCanonicalMatch({
      matchId: 'match-20260702-japan-vietnam',
      competitionId: 'competition-world-cup',
      season: '2026',
      kickoffUtc: '2026-07-02T12:00:00.000Z',
      status: 'scheduled',
      homeTeamId: 'team-japan',
      awayTeamId: 'team-vietnam',
      scoreHome: null,
      scoreAway: null,
      venue: 'National Stadium',
      updatedAt: '2026-07-02T00:00:00.000Z'
    })).toEqual({ ok: true });
  });

  it('links canonical matches to provider ids with confidence', () => {
    expect(validateProviderLink({
      entityType: 'match',
      entityId: 'match-20260702-japan-vietnam',
      provider: 'manual-snapshot',
      providerEntityType: 'fixture',
      providerEntityId: '123456',
      confidence: 0.98,
      linkedBy: 'manual-snapshot-normalizer',
      linkedAt: '2026-07-02T00:00:00.000Z'
    })).toEqual({ ok: true });
  });

  it('tracks field provenance so future providers can override with evidence', () => {
    expect(validateFieldProvenance({
      entityType: 'match',
      entityId: 'match-20260702-japan-vietnam',
      fieldPath: 'scoreHome',
      provider: 'manual-snapshot',
      providerEntityId: '123456',
      observedAt: '2026-07-02T00:00:00.000Z',
      confidence: 0.95,
      valueHash: 'b'.repeat(64)
    })).toEqual({ ok: true });
  });

  it('allows a provider only as a source reference, not top-level provider fields', () => {
    expect(validateLocalMatch({
      id: 'match-20260702-japan-vietnam',
      competition: { id: 'competition-world-cup', name: 'World Cup', type: 'national-team', season: '2026' },
      kickoffUtc: '2026-07-02T12:00:00.000Z',
      status: 'scheduled',
      homeTeam: { id: 'team-japan', name: 'Japan' },
      awayTeam: { id: 'team-vietnam', name: 'Vietnam' },
      score: { home: null, away: null },
      sourceRefs: [{ sourceId: 'manual-snapshot', sourceMatchId: '123456', importedAt: '2026-07-02T00:00:00.000Z' }],
      updatedAt: '2026-07-02T00:00:00.000Z'
    })).toEqual({ ok: true });
  });
});
