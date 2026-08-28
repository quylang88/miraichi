import { describe, expect, it } from 'vitest';
import { COMPETITION_SOURCE_REGISTRY } from '@miraichi/config';
import { adaptOpenFootballSeason } from './openfootball-adapter.js';

describe('OpenFootball adapter', () => {
  const premierLeague = COMPETITION_SOURCE_REGISTRY[0]!;

  it('normalizes scheduled and finished matches into valid canonical batch', () => {
    const rawPayload = {
      name: 'English Premier League 2026/27',
      matches: [
        {
          round: 'Matchday 1',
          date: '2026-08-15',
          time: '15:00',
          team1: 'Arsenal FC',
          team2: 'Chelsea FC',
          score: {
            ht: [1, 0] as [number, number],
            ft: [2, 1] as [number, number]
          }
        },
        {
          round: 'Matchday 1',
          date: '2026-08-16',
          time: '16:30',
          team1: 'Liverpool FC',
          team2: 'Manchester City FC'
        }
      ]
    };

    const batch = adaptOpenFootballSeason({
      competitionEntry: premierLeague,
      season: '2026-27',
      openFootballFile: 'en.1.json',
      rawPayload,
      observedAt: '2026-08-27T12:00:00.000Z'
    });

    expect(batch.matches).toHaveLength(2);
    expect(batch.teams).toHaveLength(4);
    expect(batch.competitions).toHaveLength(1);
    expect(batch.issues).toHaveLength(0);

    // Match 1: Finished
    const m1 = batch.matches[0]!;
    expect(m1.competitionId).toBe('eng-premier-league');
    expect(m1.season).toBe('2026-27');
    expect(m1.status).toBe('completed');
    expect(m1.scoreHome).toBe(2);
    expect(m1.scoreAway).toBe(1);
    expect(m1.kickoffUtc).toBe('2026-08-15T14:00:00.000Z');
    expect(m1.round).toBe('Matchday 1');

    // Match 2: Scheduled
    const m2 = batch.matches[1]!;
    expect(m2.status).toBe('scheduled');
    expect(m2.scoreHome).toBeNull();
    expect(m2.scoreAway).toBeNull();
    expect(m2.kickoffUtc).toBe('2026-08-16T15:30:00.000Z');

    // Provider Links
    expect(batch.links.every((link) => link.provider === 'openfootball')).toBe(true);
    expect(batch.provenance.every((p) => p.provider === 'openfootball')).toBe(true);
    expect(batch.provenance.map((item) => item.fieldPath)).toEqual([
      'status',
      'kickoffUtc',
      'scoreHome',
      'scoreAway',
      'status',
      'kickoffUtc'
    ]);
  });

  it('skips invalid matches where home and away teams are identical', () => {
    const rawPayload = {
      name: 'English Premier League 2026/27',
      matches: [
        {
          round: 'Matchday 1',
          date: '2026-08-15',
          team1: 'Arsenal FC',
          team2: 'Arsenal FC'
        }
      ]
    };

    const batch = adaptOpenFootballSeason({
      competitionEntry: premierLeague,
      season: '2026-27',
      openFootballFile: 'en.1.json',
      rawPayload,
      observedAt: '2026-08-27T12:00:00.000Z'
    });

    expect(batch.matches).toHaveLength(0);
    expect(batch.issues).toHaveLength(1);
    expect(batch.issues[0]!.code).toBe('invalid_team_identity');
  });

  it('does not invent midnight UTC when a source row has no exact kickoff time', () => {
    const batch = adaptOpenFootballSeason({
      competitionEntry: premierLeague,
      season: '2026-27',
      openFootballFile: 'en.1.json',
      rawPayload: {
        name: 'English Premier League 2026/27',
        matches: [{
          round: 'Matchday 2',
          date: '2026-08-22',
          team1: 'Arsenal FC',
          team2: 'Chelsea FC'
        }]
      },
      observedAt: '2026-08-28T12:00:00.000Z'
    });
    expect(batch.matches).toEqual([]);
    expect(batch.issues).toEqual([expect.objectContaining({
      code: 'missing_kickoff_time',
      severity: 'ignored'
    })]);
  });

  it('rejects impossible dates and invalid final scores instead of downgrading them to scheduled', () => {
    const batch = adaptOpenFootballSeason({
      competitionEntry: premierLeague,
      season: '2026-27',
      openFootballFile: 'en.1.json',
      rawPayload: {
        name: 'English Premier League 2026/27',
        matches: [
          {
            date: '2026-02-30',
            time: '15:00',
            team1: 'A',
            team2: 'B'
          },
          {
            date: '2026-08-22',
            time: '15:00',
            team1: 'C',
            team2: 'D',
            score: { ft: [-1, 2] }
          }
        ]
      },
      observedAt: '2026-08-28T12:00:00.000Z'
    });
    expect(batch.matches).toEqual([]);
    expect(batch.issues.map((issue) => issue.code)).toEqual(['invalid_date', 'invalid_score']);
  });

  it('derives stable provider match identities independent of source row order', () => {
    const matches = [
      { round: '1', date: '2026-08-15', time: '15:00', team1: 'A', team2: 'B' },
      { round: '1', date: '2026-08-16', time: '15:00', team1: 'C', team2: 'D' }
    ];
    const adapt = (ordered: typeof matches) => adaptOpenFootballSeason({
      competitionEntry: premierLeague,
      season: '2026-27',
      openFootballFile: 'en.1.json',
      rawPayload: { name: 'English Premier League 2026/27', matches: ordered },
      observedAt: '2026-08-28T12:00:00.000Z'
    }).links.filter((link) => link.entityType === 'match')
      .map((link) => link.providerEntityId)
      .sort();
    expect(adapt(matches)).toEqual(adapt([...matches].reverse()));
  });

  it('rejects a non-timestamp observation instead of accepting its date prefix', () => {
    expect(() => adaptOpenFootballSeason({
      competitionEntry: premierLeague,
      season: '2026-27',
      openFootballFile: 'en.1.json',
      rawPayload: { name: 'empty', matches: [] },
      observedAt: '2026-08-28-not-a-timestamp'
    })).toThrow(/observedAt/iu);
  });
});
