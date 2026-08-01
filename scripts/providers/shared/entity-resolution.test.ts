import { describe, expect, it } from 'vitest';
import { buildCanonicalMatchId, scoreProviderMatchCandidate } from './entity-resolution.js';
import { createFieldProvenance } from './provenance.js';

describe('provider-neutral entity resolution', () => {
  it('builds canonical match ids without provider ids', () => {
    expect(buildCanonicalMatchId({
      kickoffUtc: '2026-07-02T12:00:00.000Z',
      homeTeamName: 'Japan',
      awayTeamName: 'Vietnam'
    })).toBe('match-20260702-japan-vietnam');
  });

  it('scores exact team and near kickoff match candidates highly', () => {
    expect(scoreProviderMatchCandidate({
      canonicalKickoffUtc: '2026-07-02T12:00:00.000Z',
      providerKickoffUtc: '2026-07-02T12:05:00.000Z',
      canonicalHomeTeamName: 'Japan',
      providerHomeTeamName: 'Japan',
      canonicalAwayTeamName: 'Vietnam',
      providerAwayTeamName: 'Vietnam'
    })).toBeGreaterThanOrEqual(0.95);
  });
});

describe('provider-neutral provenance', () => {
  it('creates field provenance records with value hashes', () => {
    expect(createFieldProvenance({
      entityType: 'match',
      entityId: 'match-20260702-japan-vietnam',
      fieldPath: 'scoreHome',
      provider: 'manual-snapshot',
      providerEntityId: '123456',
      value: 2,
      observedAt: '2026-07-02T00:00:00.000Z',
      confidence: 0.95
    })).toMatchObject({
      entityType: 'match',
      entityId: 'match-20260702-japan-vietnam',
      fieldPath: 'scoreHome',
      provider: 'manual-snapshot',
      providerEntityId: '123456',
      valueHash: expect.stringMatching(/^[a-f0-9]{64}$/)
    });
  });
});
