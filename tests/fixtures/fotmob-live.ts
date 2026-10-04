import type { LocalMatch } from '../../packages/shared/src/index.js';
// Minimal September 12 provider shape; the canonical match ID is a local test identity.
export const liveCanonical: LocalMatch = {
  id: 'match-chelsea-hull', competition: { id: 'eng-premier-league', name: 'Premier League', type: 'club', season: '2026-27' },
  homeTeam: { id: 'team-chelsea', name: 'Chelsea' }, awayTeam: { id: 'team-hull-city', name: 'Hull City' },
  kickoffUtc: '2026-09-12T14:00:00.000Z', status: 'scheduled', score: { home: null, away: null },
  updatedAt: '2026-09-12T00:00:00Z', sourceRefs: [{ sourceId: 'fotmob-unofficial', sourceMatchId: '5795447', importedAt: '2026-09-12T00:00:00Z' }]
};
export const dailyLiveFixture = { date: '20260912', leagues: [{ id: 47, primaryId: 47, matches: [{
  id: 5795447, home: { name: 'Chelsea', score: 1 }, away: { name: 'Hull City', score: 0 },
  status: { utcTime: '2026-09-12T14:00:00Z', started: true, ongoing: true, finished: false, scoreStr: '1 - 0',
    liveTime: { short: '19‎’‎', basePeriod: 45 } }
}] }] };
