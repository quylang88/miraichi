import { describe, expect, it } from 'vitest';
import { OPENFOOTBALL_SOURCE_REGISTRY } from '@miraichi/config';
import type { ParsedOpenFootballMatch } from './football-txt-parser.js';
import { adaptOpenFootballMatches } from './openfootball-adapter.js';

const source = OPENFOOTBALL_SOURCE_REGISTRY[0]!;
const observedAt = '2026-08-01T12:00:00.000Z';

function parsedMatch(overrides: Partial<ParsedOpenFootballMatch> = {}): ParsedOpenFootballMatch {
  return {
    lineNumber: 8,
    competitionHeader: source.expectedCompetitionHeader,
    round: 'Matchday 1',
    localDate: '2026-08-21',
    localTime: '20:00',
    timeWasInherited: false,
    explicitUtcOffsetMinutes: null,
    sourceHomeName: 'Arsenal FC',
    sourceAwayName: 'Coventry City FC',
    fullTimeScore: null,
    halfTimeScore: null,
    venue: 'Emirates Stadium',
    ...overrides
  };
}

describe('OpenFootball adapter', () => {
  it('adapts a scheduled match with canonical entities, provenance, and no live status', () => {
    const batch = adaptOpenFootballMatches({ source, parsedMatches: [parsedMatch()], observedAt });

    expect(batch.issues).toEqual([]);
    expect(batch.matches).toEqual([expect.objectContaining({
      competitionId: 'eng-premier-league',
      kickoffUtc: '2026-08-21T19:00:00Z',
      status: 'scheduled',
      homeTeamId: 'team-arsenal',
      awayTeamId: 'team-coventry-city',
      scoreHome: null,
      scoreAway: null,
      round: 'matchday-1',
      venue: 'Emirates Stadium'
    })]);
    expect(batch.matches.map((match) => match.status)).not.toContain('in_play');
    expect(batch.teams).toHaveLength(2);
    expect(batch.competitions).toEqual([expect.objectContaining({
      competitionId: 'eng-premier-league',
      type: 'club'
    })]);
    expect(batch.links).toEqual([expect.objectContaining({
      entityType: 'match',
      provider: 'openfootball',
      providerEntityId: expect.stringMatching(/^openfootball-england-premier-league-2026-27:[a-f0-9]{24}$/)
    })]);
    expect(batch.provenance.map((record) => record.fieldPath).sort()).toEqual([
      'kickoffUtc', 'round', 'status', 'venue'
    ]);
  });

  it('projects full-time scores as completed without projecting half-time scores', () => {
    const batch = adaptOpenFootballMatches({
      source,
      parsedMatches: [parsedMatch({
        fullTimeScore: { home: 3, away: 1 },
        halfTimeScore: { home: 2, away: 0 }
      })],
      observedAt
    });

    expect(batch.matches).toEqual([expect.objectContaining({
      status: 'completed', scoreHome: 3, scoreAway: 1
    })]);
    expect(batch.provenance.map((record) => record.fieldPath).sort()).toEqual([
      'kickoffUtc', 'round', 'scoreAway', 'scoreHome', 'status', 'venue'
    ]);
    expect(batch.matches[0]).not.toHaveProperty('halfTimeScore');
  });

  it('withholds a match with an unresolved team alias', () => {
    const batch = adaptOpenFootballMatches({
      source,
      parsedMatches: [parsedMatch({ sourceAwayName: 'Invented United FC' })],
      observedAt
    });

    expect(batch.matches).toEqual([]);
    expect(batch.issues).toEqual([expect.objectContaining({
      code: 'unresolved_team_alias', lineNumber: 8
    })]);
  });

  it('adapts a match without a venue without hashing an absent field', () => {
    const { venue: _venue, ...matchWithoutVenue } = parsedMatch();
    const batch = adaptOpenFootballMatches({
      source,
      parsedMatches: [matchWithoutVenue],
      observedAt
    });

    expect(batch.matches).toEqual([expect.not.objectContaining({ venue: expect.anything() })]);
    expect(batch.provenance.map((record) => record.fieldPath)).not.toContain('venue');
  });

  it('rejects a parsed competition header that differs from the tracked source header', () => {
    const batch = adaptOpenFootballMatches({
      source,
      parsedMatches: [parsedMatch({ competitionHeader: 'Different Competition 2026/27' })],
      observedAt
    });

    expect(batch.matches).toEqual([]);
    expect(batch.issues).toEqual([expect.objectContaining({
      code: 'competition_header_mismatch', lineNumber: 8
    })]);
  });

  it('assigns the same canonical id to duplicate source match tuples for the publication gate to reject', () => {
    const batch = adaptOpenFootballMatches({
      source,
      parsedMatches: [parsedMatch(), parsedMatch({ lineNumber: 9 })],
      observedAt
    });

    expect(batch.matches).toHaveLength(2);
    expect(batch.matches[0]!.matchId).toBe(batch.matches[1]!.matchId);
    expect(batch.links).toHaveLength(1);
    const provenanceKeys = batch.provenance.map((record) => [
      record.entityType,
      record.entityId,
      record.fieldPath,
      record.provider,
      record.providerEntityId,
      record.observedAt,
      record.confidence,
      record.valueHash
    ].join('|'));
    expect(new Set(provenanceKeys).size).toBe(provenanceKeys.length);
  });
});
