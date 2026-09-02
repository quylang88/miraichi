import type { LiveMatchSnapshot } from '../../packages/shared/src/contracts/live-match-contracts.js';

export const liveSnapshotFixture: LiveMatchSnapshot = {
  schemaVersion: 'miraichi.live-match-snapshot.v1',
  snapshotId: 'live-2026-09-02T12:00:00.000Z',
  generatedAt: '2026-09-02T12:00:00.000Z',
  coverage: { kind: 'global-recent-window', upstreamLimit: 50, upstreamCount: 50, mappedCount: 1 },
  matches: [{
    matchId: 'match-premier-league-arsenal-liverpool-2026-09-02',
    competition: { id: 'eng-premier-league', name: 'Premier League' },
    kickoffUtc: '2026-09-02T11:00:00.000Z',
    homeTeam: { id: 'arsenal', name: 'Arsenal' },
    awayTeam: { id: 'liverpool', name: 'Liverpool' },
    status: 'live',
    period: 'second_half',
    elapsedMinute: 67,
    score: { home: 2, away: 1 },
    sourceRefs: [{
      sourceId: 'sportscore',
      sourceMatchId: 'provider-live-slug',
      sourceUrl: 'https://sportscore.com/football/match/a/b/provider-live-slug/',
      observedAt: '2026-09-02T12:00:00.000Z'
    }],
    updatedAt: '2026-09-02T12:00:00.000Z'
  }],
  warnings: ['global_widget_limit_50']
};
