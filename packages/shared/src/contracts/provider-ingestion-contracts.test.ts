import { describe, expect, it } from 'vitest';
import {
  validateCanonicalMatch,
  validateFieldProvenance,
  validateProviderCaptureManifestEntry,
  validateProviderLink,
  validateRawProviderPayloadEnvelope
} from './provider-ingestion-contracts.js';
import { validateLocalMatch } from './local-match-contracts.js';

const OPENFOOTBALL_BINDING_POLICY = {
  resolveSourceBinding(provider: string, allowlistEntryId: string) {
    if (provider !== 'openfootball') {
      return undefined;
    }

    if (allowlistEntryId === 'openfootball-england-premier-league-2026-27') {
      return {
        allowlistEntryId,
        endpointKey: 'openfootball-england-premier-league-2026-27',
        urlPath: '/openfootball/england/master/2026-27/1-premierleague.txt',
        source: {
          repository: 'england',
          ref: 'master',
          filePath: '2026-27/1-premierleague.txt'
        }
      };
    }

    if (allowlistEntryId === 'policy-owned-openfootball-source') {
      return {
        allowlistEntryId,
        endpointKey: 'policy-owned-openfootball-source',
        urlPath: '/openfootball/policy-owner/master/season/source.txt',
        source: {
          repository: 'policy-owner',
          ref: 'master',
          filePath: 'season/source.txt'
        }
      };
    }

    return undefined;
  }
};

describe('provider-neutral ingestion contracts', () => {
  it('accepts SportScore only as source evidence and rejects provider identity in canonical fields', () => {
    expect(validateRawProviderPayloadEnvelope({
      schemaVersion: 'miraichi.provider.raw.v1',
      provider: 'sportscore',
      endpointKey: 'fixtures.by-competition-date',
      urlPath: '/api/v1/fixtures/',
      query: {
        sport: 'football',
        date: '2026-08-26',
        competition: 'english-premier-league',
        limit: '200'
      },
      fetchedAt: '2026-08-26T12:00:00.000Z',
      payloadHash: 'e'.repeat(64),
      rateLimit: {},
      source: {
        allowlistEntryId: 'sportscore-eng-premier-league',
        competitionSlug: 'english-premier-league',
        providerCompetitionId: 'jednm9whz0ryox8',
        queryType: 'date'
      },
      response: {
        contentType: 'application/json; charset=utf-8',
        byteCount: 128
      },
      payload: { matches: [] }
    })).toEqual({ ok: true });

    expect(validateProviderLink({
      entityType: 'match',
      entityId: 'match-eng-premier-league-2026-alpha-beta',
      provider: 'sportscore',
      providerEntityType: 'match',
      providerEntityId: 'alpha-vs-beta/provider-match-id',
      confidence: 1,
      linkedBy: 'sportscore-adapter',
      linkedAt: '2026-08-26T12:00:00.000Z'
    })).toEqual({ ok: true });

    const canonicalWithProviderIdentity = validateCanonicalMatch({
      matchId: 'match-eng-premier-league-2026-alpha-beta',
      competitionId: 'eng-premier-league',
      season: '2026',
      kickoffUtc: '2026-08-26T12:00:00.000Z',
      status: 'scheduled',
      homeTeamId: 'team-alpha',
      awayTeamId: 'team-beta',
      scoreHome: null,
      scoreAway: null,
      updatedAt: '2026-08-26T12:00:00.000Z',
      sourceProviderId: 'sportscore'
    });
    expect(canonicalWithProviderIdentity.ok).toBe(false);
    expect(canonicalWithProviderIdentity.ok ? [] : canonicalWithProviderIdentity.errors)
      .toContain('Forbidden field "sourceProviderId" is present');
  });

  it('rejects incomplete SportScore source metadata', () => {
    const result = validateRawProviderPayloadEnvelope({
      schemaVersion: 'miraichi.provider.raw.v1',
      provider: 'sportscore',
      endpointKey: 'fixtures.by-competition-date',
      urlPath: '/api/v1/fixtures/',
      query: {},
      fetchedAt: '2026-08-26T12:00:00.000Z',
      payloadHash: 'e'.repeat(64),
      rateLimit: {},
      source: {
        allowlistEntryId: '',
        competitionSlug: 'Not A Slug',
        providerCompetitionId: '',
        queryType: 'live'
      },
      payload: {}
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('allowlistEntryId'),
      expect.stringContaining('competitionSlug'),
      expect.stringContaining('providerCompetitionId'),
      expect.stringContaining('queryType')
    ]));
  });

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
    }, OPENFOOTBALL_BINDING_POLICY)).toEqual({ ok: true });
  });

  it('rejects payload and provenance hashes unless they are lowercase SHA-256 hex', () => {
    const invalidRaw = validateRawProviderPayloadEnvelope({
      schemaVersion: 'miraichi.provider.raw.v1',
      provider: 'manual-snapshot',
      endpointKey: 'fixtures.all',
      urlPath: '/v3/football/fixtures',
      query: {},
      fetchedAt: '2026-07-02T00:00:00.000Z',
      payloadHash: '../outside'.padEnd(64, 'a'),
      rateLimit: {},
      payload: {}
    });
    const invalidManifest = validateProviderCaptureManifestEntry({
      provider: 'manual-snapshot', endpointKey: 'fixtures.all', urlPath: '/fixtures', query: {},
      status: 'captured', payloadHash: 'A'.repeat(64)
    });
    const invalidProvenance = validateFieldProvenance({
      entityType: 'match', entityId: 'match-1', fieldPath: 'status', provider: 'manual-snapshot',
      providerEntityId: 'fixture-1', observedAt: '2026-07-02T00:00:00.000Z', confidence: 1,
      valueHash: 'g'.repeat(64)
    });

    expect(invalidRaw).toMatchObject({ ok: false, errors: expect.arrayContaining([expect.stringContaining('payloadHash')]) });
    expect(invalidManifest).toMatchObject({ ok: false, errors: expect.arrayContaining([expect.stringContaining('payloadHash')]) });
    expect(invalidProvenance).toMatchObject({ ok: false, errors: expect.arrayContaining([expect.stringContaining('valueHash')]) });
  });

  it('binds OpenFootball validation through an injected provider policy', () => {
    expect(validateRawProviderPayloadEnvelope({
      schemaVersion: 'miraichi.provider.raw.v1',
      provider: 'openfootball',
      endpointKey: 'policy-owned-openfootball-source',
      urlPath: '/openfootball/policy-owner/master/season/source.txt',
      query: {},
      fetchedAt: '2026-07-02T00:00:00.000Z',
      payloadHash: 'a'.repeat(64),
      rateLimit: {},
      source: {
        allowlistEntryId: 'policy-owned-openfootball-source',
        repository: 'policy-owner',
        ref: 'master',
        filePath: 'season/source.txt'
      },
      response: { contentType: 'text/plain; charset=utf-8', byteCount: 6 },
      payload: 'source'
    }, OPENFOOTBALL_BINDING_POLICY)).toEqual({ ok: true });

    expect(validateProviderCaptureManifestEntry({
      runId: 'run-20260702-policy',
      allowlistEntryId: 'policy-owned-openfootball-source',
      provider: 'openfootball',
      endpointKey: 'policy-owned-openfootball-source',
      urlPath: '/openfootball/policy-owner/master/season/source.txt',
      query: {},
      status: 'captured',
      fetchedAt: '2026-07-02T00:00:00.000Z'
    }, OPENFOOTBALL_BINDING_POLICY)).toEqual({ ok: true });
  });

  it('rejects OpenFootball validation without an injected binding policy', () => {
    const result = validateProviderCaptureManifestEntry({
      runId: 'run-20260702-0001',
      allowlistEntryId: 'openfootball-england-premier-league-2026-27',
      provider: 'openfootball',
      endpointKey: 'openfootball-england-premier-league-2026-27',
      urlPath: '/openfootball/england/master/2026-27/1-premierleague.txt',
      query: {},
      status: 'captured',
      fetchedAt: '2026-07-02T00:00:00.000Z'
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('binding policy')
    ]));
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
    }, OPENFOOTBALL_BINDING_POLICY)).toEqual({ ok: true });
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
    }, OPENFOOTBALL_BINDING_POLICY);

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
    }, OPENFOOTBALL_BINDING_POLICY);

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
    }, OPENFOOTBALL_BINDING_POLICY)).toEqual({ ok: true });
  });

  it('rejects incomplete OpenFootball capture manifests while retaining manual snapshots', () => {
    const invalid = validateProviderCaptureManifestEntry({
      provider: 'openfootball',
      endpointKey: 'openfootball-england-premier-league-2026-27',
      urlPath: '/openfootball/england/master/2026-27/1-premierleague.txt',
      query: {},
      status: 'captured'
    }, OPENFOOTBALL_BINDING_POLICY);
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
    }, OPENFOOTBALL_BINDING_POLICY);

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

  it('rejects canonical matches with in_play status', () => {
    const result = validateCanonicalMatch({
      matchId: 'match-20260702-japan-vietnam',
      competitionId: 'competition-world-cup',
      season: '2026',
      kickoffUtc: '2026-07-02T12:00:00.000Z',
      status: 'in_play',
      homeTeamId: 'team-japan',
      awayTeamId: 'team-vietnam',
      scoreHome: 1,
      scoreAway: 0,
      venue: 'National Stadium',
      updatedAt: '2026-07-02T00:00:00.000Z'
    });
    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors).toContain('Field "status" cannot be "in_play" in the terminal-only canonical feed');
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
