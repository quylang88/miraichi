import { describe, it, expect } from 'vitest';
import {
  validateLocalMatch,
  validateLocalDataSnapshotStatus,
  validateLocalMatchFeedResponse,
  LocalMatch,
  LocalDataSnapshotStatus,
  LocalMatchFeedResponse
} from './local-match-contracts.js';

describe('Local Match Contracts Validation', () => {
  const validScheduledMatch: LocalMatch = {
    id: 'match-world-cup-2026-group-a-mexico-south-africa-2026-06-11',
    competition: {
      id: 'world-cup-2026',
      name: 'FIFA World Cup',
      type: 'national-team',
      season: '2026'
    },
    kickoffUtc: '2026-06-11T19:00:00.000Z',
    status: 'scheduled',
    homeTeam: {
      id: 'national-team-mexico',
      name: 'Mexico',
      countryCode: 'MEX'
    },
    awayTeam: {
      id: 'national-team-south-africa',
      name: 'South Africa',
      countryCode: 'RSA'
    },
    score: {
      home: null,
      away: null
    },
    venue: 'Estadio Azteca',
    round: 'Group A',
    stage: 'group',
    neutralVenue: false,
    sourceRefs: [
      {
        sourceId: 'openfootball',
        sourceMatchId: '2026/group-a/mexico-south-africa',
        sourceUrl: 'https://github.com/openfootball/worldcup',
        importedAt: '2026-07-01T00:00:00.000Z'
      }
    ],
    updatedAt: '2026-07-01T00:00:00.000Z'
  };

  const validCompletedMatch: LocalMatch = {
    id: 'match-euro-2024-final-spain-england-2024-07-14',
    competition: {
      id: 'euro-2024',
      name: 'UEFA Euro',
      type: 'national-team',
      season: '2024'
    },
    kickoffUtc: '2024-07-14T19:00:00.000Z',
    status: 'completed',
    homeTeam: {
      id: 'national-team-spain',
      name: 'Spain',
      countryCode: 'ESP'
    },
    awayTeam: {
      id: 'national-team-england',
      name: 'England',
      countryCode: 'ENG'
    },
    score: {
      home: 2,
      away: 1
    },
    venue: 'Olympiastadion Berlin',
    round: 'Final',
    stage: 'final',
    neutralVenue: true,
    sourceRefs: [
      {
        sourceId: 'openfootball',
        sourceMatchId: '2024/final/spain-england',
        sourceUrl: 'https://github.com/openfootball/euro',
        importedAt: '2026-07-01T00:00:00.000Z'
      }
    ],
    updatedAt: '2026-07-01T00:00:00.000Z'
  };

  const validSnapshotStatus: LocalDataSnapshotStatus = {
    snapshotId: 'national-team-seed-2026-07-01',
    generatedAt: '2026-07-01T00:00:00.000Z',
    importedAt: '2026-07-01T00:00:00.000Z',
    matchCount: 2,
    competitions: [
      {
        id: 'world-cup-2026',
        name: 'FIFA World Cup',
        seasons: ['2026'],
        matchCount: 1
      },
      {
        id: 'euro-2024',
        name: 'UEFA Euro',
        seasons: ['2024'],
        matchCount: 1
      }
    ],
    sources: [
      {
        sourceId: 'openfootball',
        sourceUrl: 'https://github.com/openfootball/worldcup',
        importedAt: '2026-07-01T00:00:00.000Z'
      }
    ],
    freshness: 'fresh',
    warnings: []
  };

  it('passes a valid scheduled World Cup 2026 match', () => {
    const result = validateLocalMatch(validScheduledMatch);
    expect(result.ok).toBe(true);
  });

  it('passes a valid completed Euro match with score', () => {
    const result = validateLocalMatch(validCompletedMatch);
    expect(result.ok).toBe(true);
  });

  it('rejects custom/mock fields like sourceProviderId or providerFixtureId', () => {
    const invalidMatch1 = {
      ...validScheduledMatch,
      sourceProviderId: 'legacy-provider'
    };
    const result1 = validateLocalMatch(invalidMatch1);
    expect(result1.ok).toBe(false);
    expect(result1.ok ? [] : result1.errors).toContain('Forbidden field "sourceProviderId" is present');

    const invalidMatch2 = {
      ...validScheduledMatch,
      providerFixtureId: 'legacy-provider-123'
    };
    const result2 = validateLocalMatch(invalidMatch2);
    expect(result2.ok).toBe(false);
    expect(result2.ok ? [] : result2.errors).toContain('Forbidden field "providerFixtureId" is present');
  });

  it('rejects status "in_play" because Phase 9 has no live data', () => {
    const invalidMatch = {
      ...validScheduledMatch,
      status: 'in_play'
    };
    const result = validateLocalMatch(invalidMatch);
    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors).toContain('Field "status" cannot be "in_play" in Phase 9');
  });

  it('accepts club competitions', () => {
    const clubMatch = {
      ...validScheduledMatch,
      competition: {
        ...validScheduledMatch.competition,
        type: 'club' as const
      }
    };
    expect(validateLocalMatch(clubMatch)).toEqual({ ok: true });
  });

  it('rejects stale source identifiers outside OpenFootball and manual snapshots', () => {
    const result = validateLocalMatch({
      ...validScheduledMatch,
      sourceRefs: [{
        ...validScheduledMatch.sourceRefs[0]!,
        sourceId: 'football-data-org'
      }]
    });
    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('sourceRefs[0].sourceId')
    ]));
  });

  it('rejects completed match with null score values', () => {
    const invalidMatch = {
      ...validCompletedMatch,
      score: {
        home: null,
        away: null
      }
    };
    const result = validateLocalMatch(invalidMatch);
    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors).toContain('Completed match cannot have null score values');
  });

  it('rejects invalid ISO datetime strings', () => {
    const invalidMatch = {
      ...validScheduledMatch,
      kickoffUtc: '2026-06-11 19:00:00'
    };
    const result = validateLocalMatch(invalidMatch);
    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors).toContain('Field "kickoffUtc" must be a valid ISO datetime string');
  });

  it('validates snapshot status correctly', () => {
    const result = validateLocalDataSnapshotStatus(validSnapshotStatus);
    expect(result.ok).toBe(true);

    const invalidStatus = {
      ...validSnapshotStatus,
      generatedAt: 'invalid-date'
    };
    const result2 = validateLocalDataSnapshotStatus(invalidStatus);
    expect(result2.ok).toBe(false);
    expect(result2.ok ? [] : result2.errors).toContain('Field "generatedAt" must be a valid ISO datetime string');
  });

  it('validates local match feed response correctly', () => {
    const response: LocalMatchFeedResponse = {
      matches: [validScheduledMatch, validCompletedMatch],
      snapshot: validSnapshotStatus
    };
    const result = validateLocalMatchFeedResponse(response);
    expect(result.ok).toBe(true);
  });
});
