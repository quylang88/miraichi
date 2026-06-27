import { describe, expect, it } from 'vitest';
import { validateMarket, validateMatch } from './ingestion-validator.js';

describe('ingestion validators', () => {
  it('accepts scheduled matches with required generic identifiers', () => {
    expect(validateMatch({
      id: 'match-alpha-001',
      competitionId: 'competition-alpha',
      seasonId: 'season-alpha-2026',
      homeTeamId: 'team-alpha',
      awayTeamId: 'team-beta',
      status: 'scheduled',
      kickoffTime: '2026-06-23T12:00:00Z'
    })).toEqual({ valid: true, errors: [] });
  });

  it('requires scores for completed matches', () => {
    const result = validateMatch({
      id: 'match-alpha-001',
      competitionId: 'competition-alpha',
      seasonId: 'season-alpha-2026',
      homeTeamId: 'team-alpha',
      awayTeamId: 'team-beta',
      status: 'completed',
      kickoffTime: '2026-06-23T12:00:00Z'
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing scores object for completed match');
  });

  it('rejects markets with invalid outcome odds', () => {
    const result = validateMarket({
      id: 'market-alpha-001',
      matchId: 'match-alpha-001',
      marketName: 'Generic Result',
      outcomes: [
        { outcomeId: 'home', name: 'Home', odds: 1 },
        { outcomeId: 'away', name: 'Away', odds: 2 }
      ]
    });

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/invalid odds/);
  });
});
