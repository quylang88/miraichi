import { describe, expect, it } from 'vitest';
import {
  adaptApiFootballMatches,
  mapApiFootballStatusToCanonical
} from './api-football-adapter.js';
import type { ApiFootballFixtureItem } from './api-football-client.js';

const MOCK_FIXTURES: ApiFootballFixtureItem[] = [
  {
    fixture: {
      id: 1001,
      referee: 'Anthony Taylor',
      timezone: 'UTC',
      date: '2026-08-25T19:00:00+00:00',
      timestamp: 1787684400,
      venue: { id: 500, name: 'Old Trafford', city: 'Manchester' },
      status: { long: 'Match Finished', short: 'FT', elapsed: 90 }
    },
    league: {
      id: 39,
      name: 'Premier League',
      country: 'England',
      season: 2026,
      round: 'Regular Season - 1'
    },
    teams: {
      home: { id: 33, name: 'Manchester United', winner: true },
      away: { id: 40, name: 'Liverpool', winner: false }
    },
    goals: { home: 2, away: 1 },
    score: {
      halftime: { home: 1, away: 0 },
      fulltime: { home: 2, away: 1 },
      extratime: { home: null, away: null },
      penalty: { home: null, away: null }
    }
  },
  {
    fixture: {
      id: 1002,
      referee: 'Michael Oliver',
      timezone: 'UTC',
      date: '2026-08-26T15:00:00+00:00',
      timestamp: 1787756400,
      status: { long: 'Not Started', short: 'NS', elapsed: null }
    },
    league: {
      id: 39,
      name: 'Premier League',
      country: 'England',
      season: 2026,
      round: 'Regular Season - 1'
    },
    teams: {
      home: { id: 50, name: 'Manchester City', winner: null },
      away: { id: 42, name: 'Arsenal', winner: null }
    },
    goals: { home: null, away: null },
    score: {
      halftime: { home: null, away: null },
      fulltime: { home: null, away: null },
      extratime: { home: null, away: null },
      penalty: { home: null, away: null }
    }
  }
];

describe('api-football-adapter', () => {
  it('maps short statuses correctly to canonical match statuses', () => {
    expect(mapApiFootballStatusToCanonical('FT')).toBe('completed');
    expect(mapApiFootballStatusToCanonical('AET')).toBe('completed');
    expect(mapApiFootballStatusToCanonical('PEN')).toBe('completed');
    expect(mapApiFootballStatusToCanonical('NS')).toBe('scheduled');
    expect(mapApiFootballStatusToCanonical('TBD')).toBe('scheduled');
    expect(mapApiFootballStatusToCanonical('PST')).toBe('postponed');
    expect(mapApiFootballStatusToCanonical('CANC')).toBe('cancelled');
    expect(mapApiFootballStatusToCanonical('UNKNOWN_XYZ')).toBe('unknown');
  });

  it('adapts API-Football fixture items into canonical warehouse snapshot', () => {
    const result = adaptApiFootballMatches({
      fixtures: MOCK_FIXTURES,
      observedAt: '2026-08-25T20:00:00.000Z'
    });

    expect(result.issues).toHaveLength(0);
    expect(result.matches).toHaveLength(2);

    const match1 = result.matches[0]!;
    expect(match1.matchId).toBe('match-league-39-2026-1001');
    expect(match1.status).toBe('completed');
    expect(match1.scoreHome).toBe(2);
    expect(match1.scoreAway).toBe(1);
    expect(match1.homeTeamId).toBe('team-manchester-united');
    expect(match1.awayTeamId).toBe('team-liverpool');
    expect(match1.venue).toBe('Old Trafford');

    const match2 = result.matches[1]!;
    expect(match2.status).toBe('scheduled');
    expect(match2.scoreHome).toBeNull();
    expect(match2.scoreAway).toBeNull();

    expect(result.teams.length).toBe(4);
    expect(result.competitions.length).toBe(1);
    expect(result.links.length).toBeGreaterThan(0);
    expect(result.provenance.length).toBeGreaterThan(0);
  });
});
