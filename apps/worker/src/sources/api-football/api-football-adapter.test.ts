import { describe, expect, it } from 'vitest';
import {
  adaptApiFootballMatches,
  mapApiFootballStatusToCanonical
} from './api-football-adapter.js';
import type { ApiFootballFixtureItem } from './api-football-client.js';
import {
  API_FOOTBALL_COMPETITION_REGISTRY,
  type ApiFootballCompetitionEntry
} from '@miraichi/config';

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
  },
  {
    fixture: {
      id: 1003,
      referee: 'Paul Tierney',
      timezone: 'UTC',
      date: '2026-08-27T18:30:00+00:00',
      timestamp: 1787855400,
      status: { long: 'First Half', short: '1H', elapsed: 35 }
    },
    league: {
      id: 39,
      name: 'Premier League',
      country: 'England',
      season: 2026,
      round: 'Regular Season - 1'
    },
    teams: {
      home: { id: 49, name: 'Chelsea', winner: null },
      away: { id: 47, name: 'Tottenham', winner: null }
    },
    goals: { home: 1, away: 0 },
    score: {
      halftime: { home: 1, away: 0 },
      fulltime: { home: null, away: null },
      extratime: { home: null, away: null },
      penalty: { home: null, away: null }
    }
  }
];

const EPL_ENTRY: ApiFootballCompetitionEntry = API_FOOTBALL_COMPETITION_REGISTRY.find(
  (c) => c.competitionId === 'eng-premier-league'
)!;

describe('api-football-adapter', () => {
  it('keeps provider live statuses non-live in the canonical store', () => {
    expect(mapApiFootballStatusToCanonical('1H')).toBe('scheduled');
    expect(mapApiFootballStatusToCanonical('HT')).toBe('scheduled');
    expect(mapApiFootballStatusToCanonical('2H')).toBe('scheduled');
    expect(mapApiFootballStatusToCanonical('ET')).toBe('scheduled');
    expect(mapApiFootballStatusToCanonical('BT')).toBe('scheduled');
    expect(mapApiFootballStatusToCanonical('P')).toBe('scheduled');
    expect(mapApiFootballStatusToCanonical('LIVE')).toBe('scheduled');

    // Terminal and other statuses
    expect(mapApiFootballStatusToCanonical('FT')).toBe('completed');
    expect(mapApiFootballStatusToCanonical('AET')).toBe('completed');
    expect(mapApiFootballStatusToCanonical('PEN')).toBe('completed');
    expect(mapApiFootballStatusToCanonical('NS')).toBe('scheduled');
    expect(mapApiFootballStatusToCanonical('TBD')).toBe('scheduled');
    expect(mapApiFootballStatusToCanonical('PST')).toBe('postponed');
    expect(mapApiFootballStatusToCanonical('SUSP')).toBe('postponed');
    expect(mapApiFootballStatusToCanonical('INT')).toBe('postponed');
    expect(mapApiFootballStatusToCanonical('CANC')).toBe('cancelled');
    expect(mapApiFootballStatusToCanonical('ABD')).toBe('cancelled');
    expect(mapApiFootballStatusToCanonical('WO')).toBe('cancelled');
    expect(mapApiFootballStatusToCanonical('UNKNOWN_XYZ')).toBe('unknown');
  });

  it('adapts API-Football fixture items using passed competitionEntry and canonical competition identity', () => {
    const result = adaptApiFootballMatches({
      competitionEntry: EPL_ENTRY,
      fixtures: MOCK_FIXTURES,
      observedAt: '2026-08-25T20:00:00.000Z'
    });

    expect(result.issues).toHaveLength(0);
    expect(result.matches).toHaveLength(3);

    const match1 = result.matches[0]!;
    expect(match1.competitionId).toBe('eng-premier-league');
    expect(match1.season).toBe('2026');
    expect(match1.status).toBe('completed');
    expect(match1.scoreHome).toBe(2);
    expect(match1.scoreAway).toBe(1);
    expect(match1.homeTeamId).toBe('team-manchester-united');
    expect(match1.awayTeamId).toBe('team-liverpool');
    expect(match1.venue).toBe('Old Trafford');

    const match2 = result.matches[1]!;
    expect(match2.competitionId).toBe('eng-premier-league');
    expect(match2.status).toBe('scheduled');
    expect(match2.scoreHome).toBeNull();
    expect(match2.scoreAway).toBeNull();

    const match3 = result.matches[2]!;
    expect(match3.competitionId).toBe('eng-premier-league');
    expect(match3.status).toBe('scheduled');
    expect(match3.scoreHome).toBeNull();
    expect(match3.scoreAway).toBeNull();

    expect(result.competitions[0]?.competitionId).toBe('eng-premier-league');
    expect(result.competitions[0]?.name).toBe('Premier League');
    expect(result.competitions[0]?.type).toBe('club');
  });

  it('stores target historical season when expectedSeason is provided', () => {
    const historicalFixture: ApiFootballFixtureItem = {
      ...MOCK_FIXTURES[0]!,
      league: {
        ...MOCK_FIXTURES[0]!.league,
        season: 2024
      }
    };
    const result = adaptApiFootballMatches({
      competitionEntry: EPL_ENTRY,
      expectedSeason: 2024,
      fixtures: [historicalFixture],
      observedAt: '2026-08-25T20:00:00.000Z'
    });

    expect(result.issues).toHaveLength(0);
    expect(result.matches[0]?.season).toBe('2024');
  });

  it('rejects a provider payload whose season does not match the hydration target', () => {
    const result = adaptApiFootballMatches({
      competitionEntry: EPL_ENTRY,
      expectedSeason: 2024,
      fixtures: [MOCK_FIXTURES[0]!],
      observedAt: '2026-08-25T20:00:00.000Z'
    });

    expect(result.matches).toHaveLength(0);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'season_mismatch', fixtureId: 1001 })
    ]));
  });

  it('projects national-team competition type when entry is national-team', () => {
    const nationalEntry: ApiFootballCompetitionEntry = {
      entryId: 'api-football-world-cup',
      sourceId: 'api-football',
      competitionId: 'fifa-world-cup',
      competitionName: 'FIFA World Cup',
      country: 'World',
      category: 'continental_cup',
      competitionType: 'national-team',
      providerLeagueId: 1,
      currentSeason: 2026,
      historicalSeasons: [2022],
      sourceTimezone: 'UTC',
      enabled: true
    };

    const fixture: ApiFootballFixtureItem = {
      ...MOCK_FIXTURES[0]!,
      league: {
        id: 1,
        name: 'World Cup',
        country: 'World',
        season: 2026,
        round: 'Group Stage - 1'
      }
    };

    const result = adaptApiFootballMatches({
      competitionEntry: nationalEntry,
      fixtures: [fixture],
      observedAt: '2026-08-25T20:00:00.000Z'
    });

    expect(result.competitions[0]?.type).toBe('national-team');
  });

  it('records an issue and skips fixture if fixture league id does not match competitionEntry', () => {
    const result = adaptApiFootballMatches({
      competitionEntry: EPL_ENTRY, // providerLeagueId: 39
      fixtures: [
        {
          ...MOCK_FIXTURES[0]!,
          league: {
            ...MOCK_FIXTURES[0]!.league,
            id: 140 // La Liga ID
          }
        }
      ],
      observedAt: '2026-08-25T20:00:00.000Z'
    });

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'league_id_mismatch',
          fixtureId: 1001
        })
      ])
    );
    expect(result.matches).toHaveLength(0);
  });

  it('looks up competition from registry when competitionEntry is omitted, and rejects unregistered league', () => {
    // 1. Known league (39 -> EPL)
    const resultKnown = adaptApiFootballMatches({
      fixtures: [MOCK_FIXTURES[0]!],
      observedAt: '2026-08-25T20:00:00.000Z'
    });

    expect(resultKnown.issues).toHaveLength(0);
    expect(resultKnown.matches[0]?.competitionId).toBe('eng-premier-league');
    expect(resultKnown.competitions[0]?.competitionId).toBe('eng-premier-league');

    // 2. Unregistered league (99999)
    const resultUnknown = adaptApiFootballMatches({
      fixtures: [
        {
          ...MOCK_FIXTURES[0]!,
          league: {
            id: 99999,
            name: 'Unknown League',
            country: 'Unknown',
            season: 2026,
            round: 'Round 1'
          }
        }
      ],
      observedAt: '2026-08-25T20:00:00.000Z'
    });

    expect(resultUnknown.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'unregistered_league',
          fixtureId: 1001
        })
      ])
    );
    expect(resultUnknown.matches).toHaveLength(0);
    expect(resultUnknown.competitions).toHaveLength(0);
  });

  it('canonical match ID is stable regardless of fixture.id or kickoff change', () => {
    const fixtureA: ApiFootballFixtureItem = {
      ...MOCK_FIXTURES[0]!,
      fixture: {
        ...MOCK_FIXTURES[0]!.fixture,
        id: 1001,
        date: '2026-08-25T19:00:00+00:00'
      }
    };

    const fixtureB: ApiFootballFixtureItem = {
      ...MOCK_FIXTURES[0]!,
      fixture: {
        ...MOCK_FIXTURES[0]!.fixture,
        id: 999999, // changed provider fixture ID
        date: '2026-08-25T20:00:00+00:00' // changed kickoff time
      }
    };

    const resA = adaptApiFootballMatches({
      competitionEntry: EPL_ENTRY,
      fixtures: [fixtureA],
      observedAt: '2026-08-25T20:00:00.000Z'
    });

    const resB = adaptApiFootballMatches({
      competitionEntry: EPL_ENTRY,
      fixtures: [fixtureB],
      observedAt: '2026-08-25T20:00:00.000Z'
    });

    expect(resA.matches[0]?.matchId).toBeDefined();
    expect(resA.matches[0]?.matchId).toBe(resB.matches[0]?.matchId);
    // Canonical match ID does not contain provider fixture ID
    expect(resA.matches[0]?.matchId).not.toContain('1001');
    expect(resB.matches[0]?.matchId).not.toContain('999999');

    // Provider fixture ID is stored in provider link
    const linkA = resA.links.find((l) => l.entityType === 'match');
    const linkB = resB.links.find((l) => l.entityType === 'match');
    expect(linkA?.providerEntityId).toBe('1001');
    expect(linkB?.providerEntityId).toBe('999999');
  });
});
