import { describe, expect, it } from 'vitest';
import { MockProviderAdapter } from './mock-provider-adapter.js';

describe('MockProviderAdapter', () => {
  it('maps raw provider matches into normalized match contracts', () => {
    const adapter = new MockProviderAdapter();

    expect(adapter.parseMatches([
      {
        fixture_id: 'match-alpha-001',
        comp_name: 'competition-alpha',
        season_year: 'season-alpha-2026',
        home_team_tag: 'team-alpha',
        away_team_tag: 'team-beta',
        match_status: 'scheduled',
        start_utc: '2026-06-23T23:00:00Z',
        venue: 'venue-alpha',
        score_result: { home: 1, away: 0 }
      }
    ])).toEqual([
      {
        id: 'match-alpha-001',
        competitionId: 'competition-alpha',
        seasonId: 'season-alpha-2026',
        homeTeamId: 'team-alpha',
        awayTeamId: 'team-beta',
        status: 'scheduled',
        kickoffTime: '2026-06-23T23:00:00Z',
        venueName: 'venue-alpha',
        scores: { homeScore: 1, awayScore: 0 }
      }
    ]);
  });

  it('maps raw provider markets into normalized market contracts', () => {
    const adapter = new MockProviderAdapter();

    expect(adapter.parseMarkets([
      {
        market_id: 'market-alpha-001',
        fixture_ref: 'match-alpha-001',
        name_type: '1X2',
        timestamp_utc: '2026-06-23T23:01:00Z',
        selections: [
          { id: 'outcome-alpha-home', label: 'home', odds_value: 2.1 }
        ]
      }
    ])).toEqual([
      {
        id: 'market-alpha-001',
        matchId: 'match-alpha-001',
        marketName: '1X2',
        providerId: 'provider-mock-alpha',
        updatedAt: '2026-06-23T23:01:00Z',
        outcomes: [
          { outcomeId: 'outcome-alpha-home', name: 'home', odds: 2.1 }
        ]
      }
    ]);
  });
});
