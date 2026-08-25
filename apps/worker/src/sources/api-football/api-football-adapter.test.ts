import { describe, expect, it } from 'vitest';
import {
  adaptApiFootballMatches,
  adaptApiFootballMatchDetail,
  mapApiFootballEventType,
  mapApiFootballStatusToCanonical
} from './api-football-adapter.js';
import type { ApiFootballFixtureItem } from './api-football-client.js';
import {
  API_FOOTBALL_COMPETITION_REGISTRY,
  type ApiFootballCompetitionEntry
} from '@miraichi/config';
import { validateLocalMatchDetail, type LocalMatch } from '@miraichi/shared';

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

  describe('mapApiFootballEventType', () => {
    it('maps various provider event types correctly', () => {
      expect(mapApiFootballEventType('Goal')).toBe('goal');
      expect(mapApiFootballEventType('goal')).toBe('goal');
      expect(mapApiFootballEventType('GOAL')).toBe('goal');

      expect(mapApiFootballEventType('Card')).toBe('card');
      expect(mapApiFootballEventType('card')).toBe('card');

      expect(mapApiFootballEventType('subst')).toBe('substitution');
      expect(mapApiFootballEventType('sub')).toBe('substitution');
      expect(mapApiFootballEventType('substitution')).toBe('substitution');
      expect(mapApiFootballEventType('Substitution')).toBe('substitution');

      expect(mapApiFootballEventType('Penalty')).toBe('penalty');
      expect(mapApiFootballEventType('penalty')).toBe('penalty');

      expect(mapApiFootballEventType('Var')).toBe('other');
      expect(mapApiFootballEventType('missed penalty')).toBe('other');
      expect(mapApiFootballEventType('')).toBe('other');
      expect(mapApiFootballEventType(undefined)).toBe('other');
      expect(mapApiFootballEventType(null)).toBe('other');
    });
  });

  describe('adaptApiFootballMatchDetail', () => {
    const mockCanonicalMatch: LocalMatch = {
      id: 'match-epl-2026-mun-liv',
      competition: {
        id: 'eng-premier-league',
        name: 'Premier League',
        type: 'club',
        season: '2026'
      },
      kickoffUtc: '2026-08-25T19:00:00.000Z',
      status: 'completed',
      homeTeam: {
        id: 'team-manchester-united',
        name: 'Manchester United',
        countryCode: 'ENG'
      },
      awayTeam: {
        id: 'team-liverpool',
        name: 'Liverpool',
        countryCode: 'ENG'
      },
      score: {
        home: 2,
        away: 1
      },
      venue: 'Old Trafford',
      round: 'Regular Season - 1',
      sourceRefs: [
        {
          sourceId: 'api-football',
          sourceMatchId: '1001',
          importedAt: '2026-08-25T20:00:00.000Z'
        }
      ],
      updatedAt: '2026-08-25T20:00:00.000Z'
    };

    const richFixture: ApiFootballFixtureItem = {
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
      },
      events: [
        {
          time: { elapsed: 25, extra: null },
          team: { id: 33, name: 'Manchester United' },
          player: { id: 101, name: 'Marcus Rashford' },
          assist: { id: 102, name: 'Bruno Fernandes' },
          type: 'Goal',
          detail: 'Normal Goal'
        },
        {
          time: { elapsed: 45, extra: 2 },
          team: { id: 40, name: 'Liverpool' },
          player: { id: 201, name: 'Virgil van Dijk' },
          assist: { id: null, name: null },
          type: 'Card',
          detail: 'Yellow Card'
        },
        {
          time: { elapsed: 60, extra: null },
          team: { id: 40, name: 'Liverpool' },
          player: { id: 202, name: 'Darwin Nunez' },
          assist: { id: 203, name: 'Mohamed Salah' },
          type: 'Goal',
          detail: 'Penalty'
        },
        {
          time: { elapsed: 75, extra: null },
          team: { id: 33, name: 'Manchester United' },
          player: { id: 103, name: 'Mason Mount' },
          assist: { id: 104, name: 'Christian Eriksen' },
          type: 'subst',
          detail: 'Substitution 1'
        },
        {
          time: { elapsed: 85, extra: null },
          team: { id: 33, name: 'Manchester United' },
          player: { id: 105, name: 'Rasmus Hojlund' },
          assist: { id: null, name: null },
          type: 'Goal',
          detail: 'Normal Goal'
        }
      ],
      statistics: [
        {
          team: { id: 33, name: 'Manchester United' },
          statistics: [
            { type: 'Shots on Goal', value: 6 },
            { type: 'Total Shots', value: 14 },
            { type: 'Corner Kicks', value: 5 },
            { type: 'Ball Possession', value: '52%' },
            { type: 'Yellow Cards', value: 1 },
            { type: 'Red Cards', value: 0 }
          ]
        },
        {
          team: { id: 40, name: 'Liverpool' },
          statistics: [
            { type: 'Shots on Goal', value: 4 },
            { type: 'Total Shots', value: 11 },
            { type: 'Corner Kicks', value: 6 },
            { type: 'Ball Possession', value: '48%' },
            { type: 'Yellow Cards', value: 2 },
            { type: 'Red Cards', value: 0 }
          ]
        }
      ]
    };

    it('normalizes rich fixture payload into valid LocalMatchDetail', () => {
      const observedAt = '2026-08-25T21:00:00.000Z';
      const detail = adaptApiFootballMatchDetail({
        fixtureItem: richFixture,
        canonicalMatch: mockCanonicalMatch,
        observedAt
      });

      // Contract validation
      const validation = validateLocalMatchDetail(detail);
      expect(validation.ok).toBe(true);

      // Match identity & top-level properties
      expect(detail.match).not.toBe(mockCanonicalMatch);
      expect(detail.match.sourceRefs).toEqual([
        {
          sourceId: 'api-football',
          importedAt: '2026-08-25T20:00:00.000Z'
        }
      ]);
      expect(detail.status).toBe('completed');
      expect(detail.referee).toBe('Anthony Taylor');
      expect(detail.elapsedMinute).toBe(90);
      expect(detail.updatedAt).toBe(observedAt);

      // Score breakdown
      expect(detail.scoreBreakdown).toEqual({
        halftime: { home: 1, away: 0 },
        fulltime: { home: 2, away: 1 },
        extratime: { home: null, away: null },
        penalty: { home: null, away: null }
      });

      // Events normalization
      expect(detail.events).toHaveLength(5);

      // Event 0: Goal with assist
      expect(detail.events[0]).toEqual({
        minute: 25,
        teamId: 'team-manchester-united',
        type: 'goal',
        detail: 'Normal Goal',
        player: 'Marcus Rashford',
        assist: 'Bruno Fernandes',
        label: "25' Normal Goal - Marcus Rashford (Assist: Bruno Fernandes)"
      });

      // Event 1: Card with extra minute stoppage
      expect(detail.events[1]).toEqual({
        minute: 45,
        extraMinute: 2,
        teamId: 'team-liverpool',
        type: 'card',
        detail: 'Yellow Card',
        player: 'Virgil van Dijk',
        assist: null,
        label: "45+2' Yellow Card - Virgil van Dijk"
      });

      // Event 2: Penalty
      expect(detail.events[2]).toEqual({
        minute: 60,
        teamId: 'team-liverpool',
        type: 'penalty',
        detail: 'Penalty',
        player: 'Darwin Nunez',
        assist: 'Mohamed Salah',
        label: "60' Penalty - Darwin Nunez (Assist: Mohamed Salah)"
      });

      // Event 3: Substitution
      expect(detail.events[3]).toEqual({
        minute: 75,
        teamId: 'team-manchester-united',
        type: 'substitution',
        detail: 'Substitution 1',
        player: 'Mason Mount',
        assist: 'Christian Eriksen',
        label: "75' Substitution 1 - Mason Mount (In: Christian Eriksen)"
      });

      // Event 4: Goal without assist
      expect(detail.events[4]).toEqual({
        minute: 85,
        teamId: 'team-manchester-united',
        type: 'goal',
        detail: 'Normal Goal',
        player: 'Rasmus Hojlund',
        assist: null,
        label: "85' Normal Goal - Rasmus Hojlund"
      });

      // Team statistics normalization
      expect(detail.teamStats).toHaveLength(2);

      const homeStats = detail.teamStats?.[0];
      expect(homeStats).toEqual({
        teamId: 'team-manchester-united',
        teamName: 'Manchester United',
        shotsOnGoal: 6,
        totalShots: 14,
        cornerKicks: 5,
        possessionPercentage: 52,
        yellowCards: 1,
        redCards: 0
      });

      const awayStats = detail.teamStats?.[1];
      expect(awayStats).toEqual({
        teamId: 'team-liverpool',
        teamName: 'Liverpool',
        shotsOnGoal: 4,
        totalShots: 11,
        cornerKicks: 6,
        possessionPercentage: 48,
        yellowCards: 2,
        redCards: 0
      });

      // Warnings & Notes
      expect(detail.warnings).toEqual([]);
      expect(detail.notes).toEqual([]);
    });

    it('handles missing coverage with appropriate warnings and preserves nulls instead of zero', () => {
      const incompleteFixture: ApiFootballFixtureItem = {
        fixture: {
          id: 2001,
          referee: null,
          timezone: 'UTC',
          date: '2026-08-25T19:00:00+00:00',
          timestamp: 1787684400,
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
        goals: { home: 1, away: 0 },
        score: {
          halftime: { home: 1, away: 0 },
          fulltime: { home: 1, away: 0 },
          extratime: { home: null, away: null },
          penalty: { home: null, away: null }
        }
        // events and statistics omitted
      };

      const detail = adaptApiFootballMatchDetail({
        fixtureItem: incompleteFixture,
        canonicalMatch: mockCanonicalMatch,
        observedAt: '2026-08-25T21:00:00.000Z'
      });

      expect(validateLocalMatchDetail(detail).ok).toBe(true);
      expect(detail.referee).toBeNull();
      expect(detail.events).toEqual([]);
      expect(detail.teamStats).toEqual([
        {
          teamId: 'team-manchester-united',
          teamName: 'Manchester United',
          cornerKicks: null,
          yellowCards: null,
          redCards: null,
          totalShots: null,
          shotsOnGoal: null,
          possessionPercentage: null
        },
        {
          teamId: 'team-liverpool',
          teamName: 'Liverpool',
          cornerKicks: null,
          yellowCards: null,
          redCards: null,
          totalShots: null,
          shotsOnGoal: null,
          possessionPercentage: null
        }
      ]);
      expect(detail.warnings).toContain('statistics_unavailable');
      expect(detail.warnings).toContain('events_unavailable');
    });

    it('preserves null statistic values without defaulting to 0', () => {
      const fixtureWithPartialStats: ApiFootballFixtureItem = {
        ...richFixture,
        statistics: [
          {
            team: { id: 33, name: 'Manchester United' },
            statistics: [
              { type: 'Shots on Goal', value: null },
              { type: 'Total Shots', value: '10' },
              { type: 'Corner Kicks', value: null },
              { type: 'Ball Possession', value: null },
              { type: 'Yellow Cards', value: null },
              { type: 'Red Cards', value: 0 } // explicitly 0
            ]
          },
          {
            team: { id: 40, name: 'Liverpool' },
            statistics: [
              { type: 'Total Shots', value: 5 }
              // others missing
            ]
          }
        ]
      };

      const detail = adaptApiFootballMatchDetail({
        fixtureItem: fixtureWithPartialStats,
        canonicalMatch: mockCanonicalMatch,
        observedAt: '2026-08-25T21:00:00.000Z'
      });

      expect(validateLocalMatchDetail(detail).ok).toBe(true);

      const homeStats = detail.teamStats?.[0];
      expect(homeStats?.shotsOnGoal).toBeNull();
      expect(homeStats?.totalShots).toBe(10);
      expect(homeStats?.cornerKicks).toBeNull();
      expect(homeStats?.possessionPercentage).toBeNull();
      expect(homeStats?.yellowCards).toBeNull();
      expect(homeStats?.redCards).toBe(0); // explicitly 0 preserved

      const awayStats = detail.teamStats?.[1];
      expect(awayStats?.shotsOnGoal).toBeNull();
      expect(awayStats?.totalShots).toBe(5);
      expect(awayStats?.cornerKicks).toBeNull();
      expect(awayStats?.possessionPercentage).toBeNull();
      expect(awayStats?.yellowCards).toBeNull();
      expect(awayStats?.redCards).toBeNull();
    });

    it('does not add unavailable warnings when match is scheduled or in-progress', () => {
      const { events: _e, statistics: _s, ...baseFixture } = richFixture;
      const scheduledFixture: ApiFootballFixtureItem = {
        ...baseFixture,
        fixture: {
          ...richFixture.fixture,
          status: { long: 'Not Started', short: 'NS', elapsed: null }
        }
      };

      const scheduledCanonical: LocalMatch = {
        ...mockCanonicalMatch,
        status: 'scheduled',
        score: { home: null, away: null }
      };

      const detail = adaptApiFootballMatchDetail({
        fixtureItem: scheduledFixture,
        canonicalMatch: scheduledCanonical,
        observedAt: '2026-08-25T21:00:00.000Z'
      });

      expect(validateLocalMatchDetail(detail).ok).toBe(true);
      expect(detail.status).toBe('scheduled');
      expect(detail.elapsedMinute).toBeNull();
      expect(detail.warnings).toEqual([]);
    });

    it('strictly does not inject forbidden fields into detail', () => {
      const detail = adaptApiFootballMatchDetail({
        fixtureItem: richFixture,
        canonicalMatch: mockCanonicalMatch,
        observedAt: '2026-08-25T21:00:00.000Z'
      });

      const raw = detail as unknown as Record<string, unknown>;
      expect(raw.providerFixtureId).toBeUndefined();
      expect(raw.sourceProviderId).toBeUndefined();
      expect(raw.providerUrl).toBeUndefined();
      expect(raw.fixtureId).toBeUndefined();
      expect(raw.xG).toBeUndefined();
      expect(raw.expectedGoals).toBeUndefined();
      expect(raw.expected_goals).toBeUndefined();
      expect(raw.predictions).toBeUndefined();
      expect(raw.odds).toBeUndefined();

      expect(validateLocalMatchDetail(detail).ok).toBe(true);
    });

    it('does not expose unknown provider team IDs and rejects malformed numeric statistics', () => {
      const malformedFixture: ApiFootballFixtureItem = {
        ...richFixture,
        events: [
          {
            time: { elapsed: -1, extra: null },
            team: { id: 999_999, name: 'Unknown Provider Team' },
            player: { id: 555, name: 'Known Player' },
            assist: { id: null, name: null },
            type: 'Card',
            detail: 'Yellow Card'
          }
        ],
        statistics: [
          {
            team: { id: 33, name: 'Manchester United' },
            statistics: [
              { type: 'Total Shots', value: '12foo' },
              { type: 'Ball Possession', value: '52%junk' }
            ]
          },
          {
            team: { id: 999_999, name: 'Unknown Provider Team' },
            statistics: [{ type: 'Corner Kicks', value: 9 }]
          }
        ]
      };

      const detail = adaptApiFootballMatchDetail({
        fixtureItem: malformedFixture,
        canonicalMatch: mockCanonicalMatch,
        observedAt: '2026-08-25T21:00:00.000Z'
      });

      expect(detail.teamStats).toHaveLength(2);
      expect(detail.teamStats?.map((row) => row.teamId)).toEqual([
        'team-manchester-united',
        'team-liverpool'
      ]);
      expect(detail.teamStats?.[0]?.totalShots).toBeNull();
      expect(detail.teamStats?.[0]?.possessionPercentage).toBeNull();
      expect(detail.warnings).toContain('statistics_partial');
      expect(detail.warnings).toContain('events_partial');
      expect(detail.events[0]?.minute).toBeNull();
      expect(detail.events[0]?.teamId).toBeUndefined();
      expect(JSON.stringify(detail)).not.toContain('999999');
      expect(JSON.stringify(detail)).not.toContain('Unknown Provider Team');
    });
  });
});
