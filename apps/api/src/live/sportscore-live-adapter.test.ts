import { describe, expect, it } from 'vitest';
import type { LocalMatch } from '@miraichi/shared';
import { adaptSportScoreLiveRecords, adaptTrackedSportScoreRecord } from './sportscore-live-adapter.js';

const observedAt = '2026-09-02T12:00:00.000Z';
const canonical: LocalMatch = {
  id: 'match-arsenal-liverpool',
  competition: { id: 'fixture-league', name: 'Fixture League', type: 'club', season: '2026-27' },
  kickoffUtc: '2026-09-02T11:00:00.000Z',
  status: 'scheduled',
  homeTeam: { id: 'arsenal', name: 'Arsenal' },
  awayTeam: { id: 'liverpool', name: 'Liverpool' },
  score: { home: null, away: null },
  sourceRefs: [],
  updatedAt: observedAt
};
const liveRaw = {
  home: ' Arsenal ', away: 'LIVERPOOL', home_score: 2, away_score: 1,
  status: 'second-half', status_text: "67'", time: '2026-09-02T11:00:00Z', slug: 'arsenal-vs-liverpool'
};

describe('SportScore provider-neutral live adapter', () => {
  it('publishes only one uniquely resolved canonical match with score/status/minute evidence', () => {
    const result = adaptSportScoreLiveRecords({ records: [liveRaw], canonicalMatches: [canonical], observedAt });
    expect(result.matches).toEqual([expect.objectContaining({
      matchId: canonical.id,
      competition: { id: 'fixture-league', name: 'Fixture League' },
      status: 'live', period: 'second_half', elapsedMinute: 67,
      score: { home: 2, away: 1 }
    })]);
    expect(result.matches[0]?.sourceRefs[0]).toMatchObject({ sourceId: 'sportscore', sourceMatchId: 'arsenal-vs-liverpool' });
    expect(result.issues).toEqual([]);
  });

  it('drops unmapped and ambiguous identities instead of guessing', () => {
    const duplicate = { ...canonical, id: 'match-duplicate' };
    const ambiguous = adaptSportScoreLiveRecords({ records: [liveRaw], canonicalMatches: [canonical, duplicate], observedAt });
    expect(ambiguous.matches).toEqual([]);
    expect(ambiguous.issues).toEqual([{ code: 'ambiguous_match', slug: 'arsenal-vs-liverpool' }]);

    const unmapped = adaptSportScoreLiveRecords({ records: [{ ...liveRaw, away: 'Different Team' }], canonicalMatches: [canonical], observedAt });
    expect(unmapped.matches).toEqual([]);
    expect(unmapped.issues).toEqual([{ code: 'unmapped_match', slug: 'arsenal-vs-liverpool' }]);
  });

  it('normalizes terminal detail without retaining incidents, stats, or lineups', () => {
    const detail = adaptTrackedSportScoreRecord({
      raw: { match: { ...liveRaw, status: 'finished', status_text: 'FT', home_score: 3, incidents: [{ secret: true }], stats: { x: 1 }, lineups: [{ x: 1 }] } },
      tracked: adaptSportScoreLiveRecords({ records: [liveRaw], canonicalMatches: [canonical], observedAt }).matches[0]!,
      observedAt: '2026-09-02T13:00:00.000Z'
    });
    expect(detail).toMatchObject({ status: 'completed', period: null, elapsedMinute: null, score: { home: 3, away: 1 } });
    expect(JSON.stringify(detail)).not.toContain('incidents');
    expect(JSON.stringify(detail)).not.toContain('lineups');
    expect(JSON.stringify(detail)).not.toContain('stats');
  });

  it('falls back to status_text when the primary status is unknown', () => {
    const result = adaptSportScoreLiveRecords({
      records: [{ ...liveRaw, status: 'unknown', status_text: 'HT' }],
      canonicalMatches: [canonical],
      observedAt
    });

    expect(result.matches[0]).toMatchObject({ status: 'halftime', period: null });
  });
});
