import { describe, expect, it } from 'vitest';
import type { OpenFootballCompetitionSource } from '@miraichi/config';
import type { CanonicalMatch, CanonicalTeam, LocalMatch, ProviderLink } from '@miraichi/shared';
import {
  validateOpenFootballPublicationCandidate,
  type OpenFootballPublicationValidationInput
} from './openfootball-publication-validator.js';

const observedAt = '2026-08-01T00:00:00.000Z';

function source(entryId: string, competitionId: string, season: string): OpenFootballCompetitionSource {
  return {
    entryId, sourceId: 'openfootball', origin: 'https://raw.githubusercontent.com',
    competitionId, competitionName: competitionId, expectedCompetitionHeader: competitionId,
    competitionType: 'club', repository: 'england', ref: 'master', filePath: `${entryId}.txt`,
    season, sourceTimezone: 'Europe/London', refreshIntervalMinutes: 360,
    maxPayloadBytes: 1_048_576, minimumExpectedMatches: 1, maximumMissingRatio: 0.05, enabled: true
  };
}

const first = source('first-source', 'competition-one', '2026');
const second = source('second-source', 'competition-two', '2026');

function canonicalMatch(id: string, sourceEntry: OpenFootballCompetitionSource): CanonicalMatch {
  return {
    matchId: id, competitionId: sourceEntry.competitionId, season: sourceEntry.season,
    kickoffUtc: '2026-08-10T12:00:00.000Z', status: 'scheduled',
    homeTeamId: `${id}-home`, awayTeamId: `${id}-away`, scoreHome: null, scoreAway: null, updatedAt: observedAt
  };
}

function team(teamId: string): CanonicalTeam {
  return { teamId, name: teamId, updatedAt: observedAt };
}

function link(match: CanonicalMatch, sourceEntry: OpenFootballCompetitionSource): ProviderLink {
  return {
    entityType: 'match', entityId: match.matchId, provider: 'openfootball', providerEntityType: 'match',
    providerEntityId: `${sourceEntry.entryId}:fixture-${match.matchId}`, confidence: 1, linkedBy: 'test', linkedAt: observedAt
  };
}

function input(overrides: Partial<OpenFootballPublicationValidationInput> = {}): OpenFootballPublicationValidationInput {
  const firstMatch = canonicalMatch('match-one', first);
  const secondMatch = canonicalMatch('match-two', second);
  return {
    sources: [first, second],
    candidate: {
      matches: [firstMatch, secondMatch],
      teams: [team(firstMatch.homeTeamId), team(firstMatch.awayTeamId), team(secondMatch.homeTeamId), team(secondMatch.awayTeamId)],
      competitions: [], links: [link(firstMatch, first), link(secondMatch, second)], provenance: []
    },
    priorMatches: [],
    ...overrides
  };
}

function priorMatch(id: string, sourceEntry: OpenFootballCompetitionSource): LocalMatch {
  return {
    id, competition: { id: sourceEntry.competitionId, name: sourceEntry.competitionName, type: sourceEntry.competitionType, season: sourceEntry.season },
    kickoffUtc: '2026-08-10T12:00:00.000Z', status: 'scheduled',
    homeTeam: { id: `${id}-home`, name: 'Home' }, awayTeam: { id: `${id}-away`, name: 'Away' },
    score: { home: null, away: null }, sourceRefs: [{ sourceId: 'openfootball', importedAt: observedAt }], updatedAt: observedAt
  };
}

describe('OpenFootball publication candidate validation', () => {
  it('accepts a complete candidate for every enabled tracked source', () => {
    expect(validateOpenFootballPublicationCandidate(input())).toEqual({ ok: true });
  });

  it('rejects incomplete, invalid, duplicate, in-play, missing-team, and missing-source candidates', () => {
    const belowMinimum = input({ candidate: { ...input().candidate, matches: [canonicalMatch('only-one', first)], links: [link(canonicalMatch('only-one', first), first)] } });
    expect(validateOpenFootballPublicationCandidate(belowMinimum)).toMatchObject({ ok: false, errors: expect.arrayContaining([expect.stringContaining('second-source')]) });

    const duplicate = input();
    duplicate.candidate.matches.push({ ...duplicate.candidate.matches[0]! });
    expect(validateOpenFootballPublicationCandidate(duplicate)).toMatchObject({ ok: false, errors: expect.arrayContaining([expect.stringContaining('duplicate matchId')]) });

    const invalid = input();
    invalid.candidate.matches[0] = { ...invalid.candidate.matches[0]!, kickoffUtc: 'unknown' };
    expect(validateOpenFootballPublicationCandidate(invalid)).toMatchObject({ ok: false, errors: expect.arrayContaining([expect.stringContaining('invalid canonical match')]) });

    const inPlay = input();
    inPlay.candidate.matches[0] = { ...inPlay.candidate.matches[0]!, status: 'in_play' as never };
    expect(validateOpenFootballPublicationCandidate(inPlay)).toMatchObject({ ok: false, errors: expect.arrayContaining([expect.stringContaining('in_play')]) });

    const missingTeam = input();
    missingTeam.candidate.teams = missingTeam.candidate.teams.filter((candidateTeam) => candidateTeam.teamId !== missingTeam.candidate.matches[0]!.homeTeamId);
    expect(validateOpenFootballPublicationCandidate(missingTeam)).toMatchObject({ ok: false, errors: expect.arrayContaining([expect.stringContaining('missing canonical home team')]) });
  });

  it('rejects only positive loss above the matching partition threshold', () => {
    const candidate = input();
    const priorMatches = Array.from({ length: 21 }, (_, index) => priorMatch(`prior-${index}`, first));
    const result = validateOpenFootballPublicationCandidate({ ...candidate, priorMatches });
    expect(result).toMatchObject({ ok: false, errors: expect.arrayContaining([expect.stringContaining('lost')]) });

    const growth = input({ priorMatches: [priorMatch('prior-one', first)] });
    expect(validateOpenFootballPublicationCandidate(growth)).toEqual({ ok: true });
  });

  it('keeps the configured 5% deletion threshold inclusive', () => {
    const candidateForCount = (count: number): OpenFootballPublicationValidationInput['candidate'] => {
      const matches = Array.from({ length: count }, (_, index) => canonicalMatch(`candidate-${index}`, first));
      return {
        matches,
        teams: matches.flatMap((match) => [team(match.homeTeamId), team(match.awayTeamId)]),
        competitions: [],
        links: matches.map((match) => link(match, first)),
        provenance: []
      };
    };
    const priorMatches = Array.from({ length: 20 }, (_, index) => priorMatch(`prior-${index}`, first));

    expect(validateOpenFootballPublicationCandidate({
      sources: [first], candidate: candidateForCount(19), priorMatches
    })).toEqual({ ok: true });
    expect(validateOpenFootballPublicationCandidate({
      sources: [first], candidate: candidateForCount(18), priorMatches
    })).toMatchObject({ ok: false, errors: expect.arrayContaining([expect.stringContaining('lost')]) });
  });

  it('applies the minimum match count to each source entry even when sources share a partition', () => {
    const samePartitionSecond = { ...second, competitionId: first.competitionId, season: first.season, minimumExpectedMatches: 2 };
    const firstMatch = canonicalMatch('shared-one', first);
    const secondMatch = canonicalMatch('shared-two', samePartitionSecond);
    const result = validateOpenFootballPublicationCandidate({
      sources: [first, samePartitionSecond],
      candidate: {
        matches: [firstMatch, secondMatch],
        teams: [
          team(firstMatch.homeTeamId), team(firstMatch.awayTeamId),
          team(secondMatch.homeTeamId), team(secondMatch.awayTeamId)
        ],
        competitions: [],
        links: [link(firstMatch, first), link(secondMatch, samePartitionSecond)],
        provenance: []
      },
      priorMatches: []
    });

    expect(result).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringContaining('second-source has 1 matches, below minimum 2')])
    });
  });
});
