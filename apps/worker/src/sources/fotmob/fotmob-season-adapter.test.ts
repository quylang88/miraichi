import { describe, expect, it } from 'vitest';
import { COMPETITION_SOURCE_REGISTRY } from '@miraichi/config';
import type { FotMobSeasonPayload } from './fotmob-season-client.js';
import { adaptFotMobSeason } from './fotmob-season-adapter.js';

const competition = COMPETITION_SOURCE_REGISTRY[0]!;
const observedAt = '2026-08-31T02:00:00.000Z';

function payload(matches: FotMobSeasonPayload['fixtures']['allMatches']): FotMobSeasonPayload {
  return {
    details: { id: 47, name: 'Premier League', selectedSeason: '2026/2027' },
    fixtures: { allMatches: matches }
  };
}

function match(overrides: Record<string, unknown> = {}) {
  return {
    id: 501,
    round: '1',
    home: { id: 1, name: 'Alpha FC' },
    away: { id: 2, name: 'Beta FC' },
    status: {
      utcTime: '2026-08-15T14:00:00.000Z',
      finished: false,
      started: false,
      cancelled: false
    },
    ...overrides
  };
}

describe('FotMob unofficial season adapter', () => {
  it('normalizes scheduled, completed, and cancelled rows while dropping live rows', () => {
    const batch = adaptFotMobSeason({
      competitionEntry: competition,
      canonicalSeason: '2026-27',
      expectedProviderSeason: '2026/2027',
      externalCompetitionId: 47,
      rawPayload: payload([
        match(),
        match({
          id: 502,
          home: { id: 3, name: 'Gamma FC' },
          away: { id: 4, name: 'Delta FC' },
          venue: 'North Ground',
          status: {
            utcTime: '2026-08-16T14:00:00.000Z',
            finished: true,
            started: true,
            cancelled: false,
            scoreStr: '2 - 1'
          }
        }),
        match({
          id: 503,
          home: { id: 5, name: 'Live FC' },
          away: { id: 6, name: 'Playing FC' },
          status: {
            utcTime: '2026-08-17T14:00:00.000Z',
            finished: false,
            started: true,
            cancelled: false,
            scoreStr: '1 - 0'
          }
        }),
        match({
          id: 504,
          home: { id: 7, name: 'Cancelled FC' },
          away: { id: 8, name: 'Waiting FC' },
          status: {
            utcTime: '2026-08-18T14:00:00.000Z',
            finished: false,
            started: false,
            cancelled: true
          }
        })
      ]),
      observedAt
    });

    expect(batch.matches).toHaveLength(3);
    expect(batch.matches.map(({ status, scoreHome, scoreAway, venue }) => ({
      status,
      scoreHome,
      scoreAway,
      venue
    }))).toEqual([
      { status: 'scheduled', scoreHome: null, scoreAway: null, venue: undefined },
      { status: 'completed', scoreHome: 2, scoreAway: 1, venue: 'North Ground' },
      { status: 'cancelled', scoreHome: null, scoreAway: null, venue: undefined }
    ]);
    expect(batch.issues).toContainEqual(expect.objectContaining({
      code: 'live_record_ignored',
      severity: 'ignored',
      recordIndex: 2
    }));
    expect(batch.links.every((link) => link.provider === 'fotmob-unofficial')).toBe(true);
    expect(batch.provenance.every((item) => item.provider === 'fotmob-unofficial')).toBe(true);
    expect(batch.matches.every((item) => !item.matchId.includes('fotmob'))).toBe(true);
  });

  it('rejects a provider fallback to a different season before normalization', () => {
    const rawPayload = payload([match()]);
    rawPayload.details.selectedSeason = '2025/2026';
    expect(() => adaptFotMobSeason({
      competitionEntry: competition,
      canonicalSeason: '2026-27',
      expectedProviderSeason: '2026/2027',
      externalCompetitionId: 47,
      rawPayload,
      observedAt
    })).toThrow('selected season mismatch');
  });

  it('does not publish a finished row without a valid non-negative final score', () => {
    const batch = adaptFotMobSeason({
      competitionEntry: competition,
      canonicalSeason: '2026-27',
      expectedProviderSeason: '2026/2027',
      externalCompetitionId: 47,
      rawPayload: payload([match({
        status: {
          utcTime: '2026-08-15T14:00:00.000Z',
          finished: true,
          started: true,
          scoreStr: 'TBD'
        }
      })]),
      observedAt
    });

    expect(batch.matches).toEqual([]);
    expect(batch.issues).toContainEqual(expect.objectContaining({
      code: 'invalid_score',
      severity: 'invalid'
    }));
  });

  it('rejects malformed identity, kickoff, and duplicate canonical identity', () => {
    const batch = adaptFotMobSeason({
      competitionEntry: competition,
      canonicalSeason: '2026-27',
      expectedProviderSeason: '2026/2027',
      externalCompetitionId: 47,
      rawPayload: payload([
        match({ id: 0 }),
        match({ id: 502, status: { utcTime: 'not-a-time', finished: false, started: false } }),
        match(),
        match()
      ]),
      observedAt
    });

    expect(batch.matches).toHaveLength(1);
    expect(batch.issues.map((issue) => issue.code)).toEqual([
      'invalid_match_identity',
      'invalid_kickoff',
      'canonical_match_collision'
    ]);
  });
});
