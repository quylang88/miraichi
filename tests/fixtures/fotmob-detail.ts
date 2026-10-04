import type { LocalMatch } from '../../packages/shared/src/index.js';

/** Minimal synthetic fixture shaped from bounded 2026-09-09 provider observations. */
export const detailCanonicalFixture: LocalMatch = {
  id: 'match-detail-fixture', competition: { id: 'eng-premier-league', name: 'Premier League', type: 'club', season: '2026/2027' },
  kickoffUtc: '2026-08-30T15:30:00.000Z', status: 'completed', homeTeam: { id: 'team-home', name: 'Home FC' },
  awayTeam: { id: 'team-away', name: 'Away FC' }, score: { home: 2, away: 1 },
  sourceRefs: [{ sourceId: 'fotmob-unofficial', sourceMatchId: '100', importedAt: '2026-08-30T18:00:00.000Z' }],
  updatedAt: '2026-08-30T18:00:00.000Z'
};
export const fotmobDetailFixture = {
  general: { matchId: '100', leagueId: 47, homeTeam: { id: 1, name: 'Home FC' }, awayTeam: { id: 2, name: 'Away FC' },
    matchTimeUTCDate: '2026-08-30T15:30:00.000Z', started: true, finished: true },
  header: { teams: [{ id: 1, score: 2 }, { id: 2, score: 1 }], status: { finished: true, started: true, reason: { short: 'FT' } } },
  content: {
    matchFacts: {
      infoBox: { Stadium: { name: 'Test Ground', city: 'City', country: 'Country', capacity: 30000, surface: 'grass' },
        Referee: { text: 'Test Referee', id: 999 }, Attendance: 29000 },
      events: { events: [
        { type: 'Goal', time: 90, overloadTime: 2, isHome: true, player: { name: 'Scorer', id: 11 }, assistInput: 'Assistant', newScore: [2,1], shotmapEvent: { expectedGoals: 0.8 } },
        { type: 'Card', time: 75, isHome: false, card: 'Red', player: { name: 'Defender' } },
        { type: 'Substitution', time: 65, isHome: true, swap: [{ name: 'Incoming' }, { name: 'Outgoing' }] },
        { type: 'Half', time: 45, halfStrShort: 'HT', homeScore: 1, awayScore: 0 }
      ] }
    },
    stats: { Periods: { All: { stats: [{ key: 'top_stats', stats: [
      { key: 'BallPossesion', type: 'text', stats: [60,40] },
      { key: 'total_shots', type: 'text', stats: [12,8] },
      { key: 'accurate_passes', type: 'text', stats: ['502 (89%)','305 (83%)'] },
      { key: 'expected_goals', type: 'text', stats: ['2.4','1.3'] }
    ] }] }, FirstHalf: { stats: [{ stats: [{ key: 'total_shots', type: 'text', stats: [5,3] }] }] } } },
    lineup: { lineupType: 'standard', homeTeam: { id: 1, name: 'Home FC', formation: '4-3-3', coach: { name: 'Coach H' },
      starters: [{ id: 11, name: 'Scorer', shirtNumber: '9', usualPlayingPositionId: 3 }], subs: [{ id: 12, name: 'Reserve', shirtNumber: '18' }], unavailable: [] },
      awayTeam: { id: 2, name: 'Away FC', formation: '4-4-2', coach: { name: 'Coach A' }, starters: [{ id: 21, name: 'Keeper', shirtNumber: '1', usualPlayingPositionId: 0 }], subs: [], unavailable: [] } },
    playerStats: { '11': { id: 11, name: 'Scorer', teamId: 1, shirtNumber: '9', stats: [{ stats: {
      'Goals': { key: 'goals', stat: { value: 2, type: 'integer' } },
      'Passes': { key: 'accurate_passes', stat: { value: 20, total: 25, type: 'fractionWithPercentage' } },
      'Rating': { key: 'rating_title', stat: { value: 8.5 } },
      'xG': { key: 'expected_goals', stat: { value: 1.9 } }
    } }] } },
    shotmap: { shots: [{ id: 333, teamId: 1, playerName: 'Scorer', x: 94, y: 34, min: 90, minAdded: 2,
      eventType: 'Goal', isOnTarget: true, isBlocked: false, isOwnGoal: false, shotType: 'RightFoot',
      situation: 'RegularPlay', period: 'SecondHalf', expectedGoals: 0.7 }] }
  }
};
