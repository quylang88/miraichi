import { describe, expect, it } from 'vitest';
import {
  validateCanonicalMatch,
  validateFieldProvenance,
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
