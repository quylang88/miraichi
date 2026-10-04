import { describe, expect, it } from 'vitest';
import type { LocalMatch } from '@miraichi/shared';
import { adaptSportScoreLiveRecords, adaptTrackedSportScoreRecord } from './sportscore-live-adapter.js';
import { crossLeagueTargets, capturedCanonicalMatch, capturedWidgetMatch } from '../../../../tests/fixtures/cross-league-score-live.js';
import { COMPETITION_POPULARITY_RANKING } from '@miraichi/config';

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
  it.each(crossLeagueTargets)('accepts the real URL-only widget contract for $competition', (target) => {
    const result = adaptSportScoreLiveRecords({ records: [capturedWidgetMatch(target)],
      canonicalMatches: [capturedCanonicalMatch(target)], observedAt: '2026-09-11T03:15:00Z' });
    expect(result.matches).toEqual([expect.objectContaining({ matchId: target.id, status: 'completed', score: target.score })]);
    expect(result.issues).toEqual([]);
  });

  it.each(COMPETITION_POPULARITY_RANKING)('resolves configured competition labels for $id', (competition) => {
    for (const name of [competition.name, ...(competition.aliases ?? [])]) {
      const result = adaptSportScoreLiveRecords({ records: [{ ...liveRaw, competition: name }],
        canonicalMatches: [{ ...canonical, competition: { ...canonical.competition, id: competition.id, name: competition.name } }], observedAt });
      expect(result.matches).toHaveLength(1);
    }
  });

  it('maps the observed Liga MX Pumas/Leon aliases without removing arbitrary club qualifiers', () => {
    const match = { ...canonical, id: 'match-893c15c61f042ae6a260a994',
      competition: { ...canonical.competition, id: 'mex-liga-mx', name: 'Liga MX' },
      kickoffUtc: '2026-09-11T03:05:00Z', homeTeam: { id: 'team-pumas', name: 'Pumas' }, awayTeam: { id: 'team-leon', name: 'León' } };
    const record = { home: 'Pumas U.N.A.M.', away: 'Club Leon', home_score: '0', away_score: '0',
      status: 'live', status_text: '1st half', time: '2026-09-11T12:05:00+09:00',
      competition: 'Mexico Liga MX', url: '/football/match/pumas-unam-vs-club-leon/' };
    const result = adaptSportScoreLiveRecords({ records: [record], canonicalMatches: [match], observedAt: '2026-09-11T03:15:00Z' });
    expect(result.matches).toEqual([expect.objectContaining({ matchId: match.id, status: 'live', period: 'first_half', elapsedMinute: null, score: { home: 0, away: 0 } })]);
    expect(result.issues).toEqual([]);
    expect(adaptSportScoreLiveRecords({ records: [{ ...record, away: 'Club Leon W' }], canonicalMatches: [match], observedAt }).matches).toEqual([]);
  });

  it.each([
    ['2nd half', 'second_half', null], ['45+2', 'unknown', 47], ["67'", 'unknown', 67], ['unknown', 'unknown', null]
  ] as const)('does not confuse the period label %s with an elapsed minute', (status_text, period, elapsedMinute) => {
    const result = adaptSportScoreLiveRecords({ records: [{ ...liveRaw, status: 'live', status_text }], canonicalMatches: [canonical], observedAt });
    expect(result.matches[0]).toMatchObject({ status: 'live', period, elapsedMinute });
  });

  it('accepts punctuation/diacritics without dropping team qualifiers', () => {
    const match = { ...canonical, homeTeam: { id: 'dc', name: 'DC United' }, awayTeam: { id: 'montreal', name: 'CF Montréal' } };
    expect(adaptSportScoreLiveRecords({ records: [{ ...liveRaw, home: 'D.C. United', away: 'CF Montreal' }], canonicalMatches: [match], observedAt }).matches).toHaveLength(1);
    expect(adaptSportScoreLiveRecords({ records: [{ ...liveRaw, home: 'DC United U21', away: 'CF Montreal' }], canonicalMatches: [match], observedAt }).matches).toHaveLength(0);
  });

  it.each([
    { url: 'https://evil.example/football/match/arsenal-vs-liverpool/' },
    { url: '/football/match/other-match/' },
    { url: '/football/match/arsenal-vs-liverpool/?redirect=evil' }
  ])('rejects unsafe or conflicting URL/slug identity: %j', (url) => {
    expect(adaptSportScoreLiveRecords({ records: [{ ...liveRaw, ...url }], canonicalMatches: [canonical], observedAt }).matches).toEqual([]);
  });

  it.each([{ time: '2026-09-03T11:00:00Z' }, { competition: 'Other Cup' }])('rejects tracked detail identity drift: %j', (changed) => {
    const tracked = adaptSportScoreLiveRecords({ records: [liveRaw], canonicalMatches: [canonical], observedAt }).matches[0]!;
    expect(adaptTrackedSportScoreRecord({ raw: { ...liveRaw, ...changed, status: 'finished' }, tracked, observedAt })).toBeNull();
  });
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
