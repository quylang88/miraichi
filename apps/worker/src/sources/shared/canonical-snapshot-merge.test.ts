import { describe, expect, it } from 'vitest';
import type { CanonicalWarehouseSnapshot } from '../../../../../scripts/providers/shared/canonical-warehouse.js';
import { mergeCanonicalWarehouseSnapshots } from './canonical-snapshot-merge.js';

function snapshot(options: {
  matchId: string;
  provider: 'sportscore' | 'fotmob-unofficial';
  providerEntityId: string;
  updatedAt: string;
}): CanonicalWarehouseSnapshot {
  return {
    matches: [{
      matchId: options.matchId,
      competitionId: 'competition-alpha',
      season: '2026-27',
      kickoffUtc: '2026-09-05T14:00:00.000Z',
      status: 'scheduled',
      homeTeamId: 'team-alpha',
      awayTeamId: 'team-beta',
      scoreHome: null,
      scoreAway: null,
      updatedAt: options.updatedAt
    }],
    teams: [
      { teamId: 'team-alpha', name: 'Alpha', updatedAt: options.updatedAt },
      { teamId: 'team-beta', name: 'Beta', updatedAt: options.updatedAt }
    ],
    competitions: [{
      competitionId: 'competition-alpha',
      name: 'Competition Alpha',
      type: 'club',
      updatedAt: options.updatedAt
    }],
    links: [{
      entityType: 'match',
      entityId: options.matchId,
      provider: options.provider,
      providerEntityType: 'match',
      providerEntityId: options.providerEntityId,
      confidence: 1,
      linkedBy: 'test-adapter',
      linkedAt: options.updatedAt
    }],
    provenance: [{
      entityType: 'match',
      entityId: options.matchId,
      fieldPath: 'status',
      provider: options.provider,
      providerEntityId: options.providerEntityId,
      observedAt: options.updatedAt,
      confidence: 1,
      valueHash: 'a'.repeat(64)
    }]
  };
}

describe('provider-neutral canonical snapshot merge', () => {
  it('reuses a unique canonical fixture identity across different providers', () => {
    const base = snapshot({
      matchId: 'match-existing',
      provider: 'sportscore',
      providerEntityId: 'legacy-match',
      updatedAt: '2026-08-30T00:00:00.000Z'
    });
    const delta = snapshot({
      matchId: 'match-provider-specific-hash',
      provider: 'fotmob-unofficial',
      providerEntityId: '501',
      updatedAt: '2026-08-31T00:00:00.000Z'
    });

    const merged = mergeCanonicalWarehouseSnapshots(base, delta);

    expect(merged.matches).toHaveLength(1);
    expect(merged.matches[0]?.matchId).toBe('match-existing');
    expect(merged.links.map((link) => [link.provider, link.entityId])).toEqual([
      ['fotmob-unofficial', 'match-existing'],
      ['sportscore', 'match-existing']
    ]);
    expect(merged.provenance.every((item) => item.entityId === 'match-existing')).toBe(true);
  });
});
