import { describe, expect, it } from 'vitest';
import {
  SPORTSCORE_COMPETITION_REGISTRY,
  type SportScoreCompetitionEntry
} from '@miraichi/config';
import {
  adaptSportScoreFixtures,
  mapSportScoreStatus
} from './sportscore-adapter.js';

const observedAt = '2026-08-26T20:00:00.000Z';
const clubEntry = SPORTSCORE_COMPETITION_REGISTRY[0]!;
const nationalTeamEntry: SportScoreCompetitionEntry = {
  ...clubEntry,
  entryId: 'sportscore-test-national-cup',
  competitionId: 'test-national-cup',
  competitionName: 'Test National Cup',
  country: 'World',
  competitionType: 'national-team',
  providerCountrySlug: 'world',
  providerCompetitionSlug: 'test-national-cup',
  providerCompetitionId: 'testnationalcup',
  competitionUrl: 'https://sportscore.com/football/competition/world/test-national-cup/testnationalcup/'
};

function fixture(
  status: string,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    home: 'Northbridge Athletic',
    away: 'Rivergate City',
    home_score: 2,
    away_score: 1,
    status,
    status_text: status === 'finished' ? 'FT' : status,
    time: '2026-08-26T18:00:00Z',
    slug: 'northbridge-athletic-vs-rivergate-city',
    ...overrides
  };
}

function adapt(fixtures: readonly Record<string, unknown>[], entry = clubEntry) {
  return adaptSportScoreFixtures({
    competitionEntry: entry,
    season: '2026-27',
    fixtures,
    observedAt
  });
}

describe('SportScore terminal-only adapter', () => {
  it('maps scheduled club fixtures into provider-neutral canonical records without scores', () => {
    const result = adapt([fixture('scheduled')]);

    expect(result.issues).toEqual([]);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({
      matchId: expect.stringMatching(/^match-[a-f0-9]{24}$/),
      competitionId: clubEntry.competitionId,
      season: '2026-27',
      status: 'scheduled',
      scoreHome: null,
      scoreAway: null,
      kickoffUtc: '2026-08-26T18:00:00.000Z'
    });
    expect(JSON.stringify(result.matches)).not.toContain('sportscore');
    expect(result.teams.map((team) => team.name)).toEqual([
      'Northbridge Athletic',
      'Rivergate City'
    ]);
    expect(result.competitions).toEqual([{
      competitionId: clubEntry.competitionId,
      name: clubEntry.competitionName,
      type: 'club',
      updatedAt: observedAt
    }]);
    expect(result.links).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entityType: 'match',
        provider: 'sportscore',
        providerEntityId: 'northbridge-athletic-vs-rivergate-city'
      })
    ]));
  });

  it('maps finished scores and terminal postponed/cancelled statuses correctly', () => {
    const finished = adapt([fixture('finished')]);
    const postponed = adapt([fixture('postponed')]);
    const cancelled = adapt([fixture('cancelled')]);

    expect(finished.matches[0]).toMatchObject({
      status: 'completed',
      scoreHome: 2,
      scoreAway: 1
    });
    expect(postponed.matches[0]).toMatchObject({
      status: 'postponed',
      scoreHome: null,
      scoreAway: null
    });
    expect(cancelled.matches[0]).toMatchObject({
      status: 'cancelled',
      scoreHome: null,
      scoreAway: null
    });
    expect(mapSportScoreStatus('FT')).toBe('completed');
    expect(mapSportScoreStatus('in_play')).toBe('in_play');
  });

  it('drops in-play records completely even when live scores and events are present', () => {
    const result = adapt([fixture('live', {
      home_score: 3,
      away_score: 2,
      events: [{ type: 'goal', minute: 72, player: 'Invented Live Player' }]
    })]);

    expect(result.matches).toEqual([]);
    expect(result.teams).toEqual([]);
    expect(result.competitions).toEqual([]);
    expect(result.links).toEqual([]);
    expect(result.provenance).toEqual([]);
    expect(result.ignoredInPlayCount).toBe(1);
    expect(result.issues).toEqual([
      expect.objectContaining({ code: 'in_play_ignored', severity: 'ignored' })
    ]);
  });

  it('rejects malformed identity, time, status, and incomplete finished scores per record', () => {
    const result = adapt([
      fixture('finished', { home: '' }),
      fixture('finished', { slug: 'UPPER CASE' }),
      fixture('finished', { time: 'not-a-date' }),
      fixture('mystery'),
      fixture('finished', { away_score: null })
    ]);

    expect(result.matches).toEqual([]);
    expect(result.issues.filter((issue) => issue.severity === 'invalid').map((issue) => issue.code))
      .toEqual([
        'invalid_team_identity',
        'invalid_match_slug',
        'invalid_kickoff',
        'unsupported_status',
        'invalid_completed_score'
      ]);
  });

  it('uses the same registry-driven path for national-team competitions', () => {
    const result = adapt([fixture('scheduled', {
      home: 'Example Republic',
      away: 'Sample Federation',
      slug: 'example-republic-vs-sample-federation'
    })], nationalTeamEntry);

    expect(result.matches).toHaveLength(1);
    expect(result.competitions).toEqual([{
      competitionId: 'test-national-cup',
      name: 'Test National Cup',
      type: 'national-team',
      updatedAt: observedAt
    }]);
  });
});
