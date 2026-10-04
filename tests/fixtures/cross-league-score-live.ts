import type { LocalMatch } from '../../packages/shared/src/contracts/local-match-contracts.js';

// Minimal factual captures from Frankfurt and approved provider endpoints, 2026-09-11.
// Tests that replace status/minute explicitly simulate lifecycle transitions.
export const crossLeagueTargets = [
  { id: 'match-b965c7003769a0b0a2899949', competitionId: 'conmebol-copa-libertadores',
    competition: 'Copa Libertadores', providerLeagueId: 45, groupId: 1000001641, providerMatchId: 1000020029,
    home: 'Independiente del Valle', away: 'Flamengo', widgetAway: 'Flamengo - RJ',
    kickoff: '2026-09-11T00:30:00Z', score: { home: 0, away: 2 },
    widgetCompetition: 'CONMEBOL Copa Libertadores', slug: 'independiente-del-valle-vs-cr-flamengo' },
  { id: 'match-08e8f525f59b32ce120ff117', competitionId: 'conmebol-copa-sudamericana',
    competition: 'Copa Sudamericana', providerLeagueId: 299, groupId: 1000001659, providerMatchId: 1000020423,
    home: 'Cienciano', away: 'Montevideo City Torque', widgetAway: 'Montevideo City Torque',
    kickoff: '2026-09-11T00:30:00Z', score: { home: 2, away: 0 },
    widgetCompetition: 'CONMEBOL Copa Sudamericana', slug: 'cienciano-vs-montevideo-city-torque' }
] as const;

export function capturedCanonicalMatch(target: typeof crossLeagueTargets[number]): LocalMatch {
  const teamId = (name: string) => `team-${name.toLowerCase().replaceAll(' ', '-')}`;
  return { id: target.id, competition: { id: target.competitionId, name: target.competition, type: 'club', season: '2026' },
    homeTeam: { id: teamId(target.home), name: target.home }, awayTeam: { id: teamId(target.away), name: target.away },
    kickoffUtc: target.kickoff, status: 'scheduled', score: { home: null, away: null },
    sourceRefs: [{ sourceId: 'fotmob-unofficial', sourceMatchId: String(target.providerMatchId), importedAt: '2026-09-10T23:35:00.697Z' }],
    updatedAt: '2026-09-10T23:35:00.697Z' };
}

export function capturedWidgetMatch(target: typeof crossLeagueTargets[number]) {
  return { home: target.home, away: target.widgetAway, home_score: String(target.score.home), away_score: String(target.score.away),
    status: 'finished', status_text: 'Finished', time: '2026-09-11T09:30:00+09:00',
    competition: target.widgetCompetition, url: `/football/match/${target.slug}/` };
}

export function capturedDailyLeague(target: typeof crossLeagueTargets[number]) {
  return { id: target.groupId, primaryId: target.providerLeagueId, parentLeagueId: target.providerLeagueId,
    name: `${target.competition} Quarter-finals`, matches: [{ id: target.providerMatchId,
      home: { name: target.home, score: target.score.home }, away: { name: target.away, score: target.score.away },
      status: { utcTime: target.kickoff, started: true, finished: true, scoreStr: `${target.score.home} - ${target.score.away}` } }] };
}

export const capturedMlsMatch: LocalMatch = {
  id: 'match-3b7d01ca7e9e8af2e8ead20b', competition: { id: 'usa-mls', name: 'Major League Soccer', type: 'club', season: '2026' },
  homeTeam: { id: 'team-new-york-city-fc', name: 'New York City FC' },
  awayTeam: { id: 'team-new-england-revolution', name: 'New England Revolution' },
  kickoffUtc: '2026-09-10T00:00:00.000Z', status: 'scheduled', score: { home: null, away: null },
  sourceRefs: [{ sourceId: 'fotmob-unofficial', sourceMatchId: '5071339', importedAt: '2026-09-09T00:00:01.412Z' }],
  updatedAt: '2026-09-09T00:00:01.412Z'
};
export const capturedMlsDailyLeague = {
  id: 913550, primaryId: 130, name: 'Major League Soccer', matches: [{ id: 5071339,
    home: { id: 546238, name: 'New York City FC', score: 1 },
    away: { id: 6580, name: 'New England Revolution', score: 2 },
    status: { utcTime: capturedMlsMatch.kickoffUtc, started: true, finished: true, scoreStr: '1 - 2' } }]
};
