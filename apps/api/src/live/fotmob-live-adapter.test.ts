import { describe, expect, it } from 'vitest';
import { COMPETITION_SOURCE_REGISTRY } from '@miraichi/config';
import { adaptFotMobDailyLive } from './fotmob-live-adapter.js';

import { liveCanonical, dailyLiveFixture } from '../../../../tests/fixtures/fotmob-live.js';
const observedAt = '2026-09-12T14:19:00Z';
const run = (payload = dailyLiveFixture, canonicalMatches = [liveCanonical]) => adaptFotMobDailyLive({ payload, canonicalMatches, observedAt });

describe('FotMob daily LIVE identity and lifecycle', () => {
  it('maps the captured current EPL shape without a widget slug or a detail read', () => {
    expect(run().matches).toEqual([expect.objectContaining({ matchId: liveCanonical.id, status: 'live',
      period: 'first_half', elapsedMinute: 19, score: { home: 1, away: 0 },
      sourceRefs: [expect.objectContaining({ sourceId: 'fotmob-unofficial', sourceMatchId: '5795447' })] })]);
  });
  it.each(COMPETITION_SOURCE_REGISTRY.filter(e => e.sourceBindings.result?.executionStatus === 'enabled'))('uses stable root identity for $competitionId', entry => {
    const payload = structuredClone(dailyLiveFixture);
    payload.leagues[0]!.id = 9999999; payload.leagues[0]!.primaryId = entry.sourceBindings.result!.externalNumericId!;
    expect(run(payload, [{ ...liveCanonical, competition: { ...liveCanonical.competition, id: entry.competitionId } }]).matches).toHaveLength(1);
  });
  it.each([
    ['HT', 45, false, 'halftime', null, null], ['45+2‎’‎', 45, false, 'live', 'first_half', 47],
    ['67‎’‎', 90, false, 'live', 'second_half', 67], ['FT', 90, true, 'completed', null, null]
  ] as const)('handles %s without inventing the minute', (short, basePeriod, finished, status, period, elapsedMinute) => {
    const payload = structuredClone(dailyLiveFixture);
    Object.assign(payload.leagues[0]!.matches[0]!.status, { finished, liveTime: { short, basePeriod } });
    expect(run(payload).matches[0]).toMatchObject({ status, period, elapsedMinute });
  });
  it('rejects mismatched league, reversed teams, changed kickoff and ambiguous provider identity', () => {
    expect(run(dailyLiveFixture, [{ ...liveCanonical, competition: { ...liveCanonical.competition, id: 'usa-mls' } }]).matches).toEqual([]);
    expect(run(dailyLiveFixture, [{ ...liveCanonical, homeTeam: liveCanonical.awayTeam, awayTeam: liveCanonical.homeTeam }]).matches).toEqual([]);
    expect(run(dailyLiveFixture, [{ ...liveCanonical, kickoffUtc: '2026-09-13T14:00:00Z' }]).matches).toEqual([]);
    expect(run(dailyLiveFixture, [liveCanonical, { ...liveCanonical, id: 'duplicate' }]).matches).toEqual([]);
  });
  it('does not turn upcoming, cancelled, conflicting or invalid score data into LIVE', () => {
    for (const change of [{ started: false, ongoing: false }, { cancelled: true }, { scoreStr: '7 - 0' }]) {
      const payload = structuredClone(dailyLiveFixture); Object.assign(payload.leagues[0]!.matches[0]!.status, change);
      expect(run(payload).matches).toEqual([]);
    }
    const payload = structuredClone(dailyLiveFixture); payload.leagues[0]!.matches[0]!.home.score = -1;
    expect(run(payload).matches).toEqual([]);
  });
});
