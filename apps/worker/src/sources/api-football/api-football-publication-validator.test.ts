import { describe, expect, it } from 'vitest';
import { validateApiFootballPublicationCandidate } from './api-football-publication-validator.js';
import type { CanonicalMatch } from '@miraichi/shared';

const VALID_MATCH: CanonicalMatch = {
  matchId: 'match-eng-premier-league-2026-1001',
  competitionId: 'eng-premier-league',
  season: '2026',
  kickoffUtc: '2026-08-25T19:00:00.000Z',
  status: 'completed',
  homeTeamId: 'team-arsenal',
  awayTeamId: 'team-chelsea',
  scoreHome: 2,
  scoreAway: 1,
  updatedAt: '2026-08-25T21:00:00.000Z'
};

describe('api-football-publication-validator', () => {
  it('passes valid candidate matches', () => {
    const result = validateApiFootballPublicationCandidate({
      candidateMatches: [VALID_MATCH]
    });
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects completed match with missing or invalid scores', () => {
    const invalidMatch: CanonicalMatch = {
      ...VALID_MATCH,
      scoreHome: null,
      scoreAway: -1
    };

    const result = validateApiFootballPublicationCandidate({
      candidateMatches: [invalidMatch]
    });
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
  });

  it('rejects status regression from completed back to scheduled', () => {
    const priorMatch: CanonicalMatch = { ...VALID_MATCH, status: 'completed', scoreHome: 2, scoreAway: 1 };
    const regressedMatch: CanonicalMatch = { ...VALID_MATCH, status: 'scheduled', scoreHome: null, scoreAway: null };

    const result = validateApiFootballPublicationCandidate({
      candidateMatches: [regressedMatch],
      priorMatches: [priorMatch]
    });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('attempted to regress status from completed to scheduled');
  });
});
