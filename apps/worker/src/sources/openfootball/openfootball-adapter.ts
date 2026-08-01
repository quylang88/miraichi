import { createHash } from 'node:crypto';
import {
  resolveOpenFootballTeamAlias,
  type OpenFootballCompetitionSource
} from '@miraichi/config';
import type {
  CanonicalCompetition,
  CanonicalMatch,
  CanonicalTeam,
  FieldProvenance,
  ProviderLink
} from '@miraichi/shared';
import { buildCanonicalMatchId } from '../../../../../scripts/providers/shared/entity-resolution.js';
import { createFieldProvenance } from '../../../../../scripts/providers/shared/provenance.js';
import type { ParsedOpenFootballMatch } from './football-txt-parser.js';
import { toOpenFootballKickoffUtc } from './openfootball-time.js';

export interface OpenFootballAdapterInput {
  source: OpenFootballCompetitionSource;
  parsedMatches: ParsedOpenFootballMatch[];
  observedAt: string;
}

export interface OpenFootballCanonicalBatch {
  matches: CanonicalMatch[];
  teams: CanonicalTeam[];
  competitions: CanonicalCompetition[];
  links: ProviderLink[];
  provenance: FieldProvenance[];
  issues: Array<{ code: string; lineNumber: number; message: string }>;
}

function normalizeRound(round: string): string {
  return round.normalize('NFC').trim().replace(/\s+/gu, '-').toLowerCase();
}

function providerEntityId(source: OpenFootballCompetitionSource, match: ParsedOpenFootballMatch): string {
  const sourceTuple = [match.round, match.sourceHomeName, match.sourceAwayName].join('|');
  const digest = createHash('sha256').update(sourceTuple, 'utf8').digest('hex').slice(0, 24);
  return `${source.entryId}:${digest}`;
}

function dedupeBy<T>(items: readonly T[], keyFor: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyFor(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function providerLinkIdentity(link: ProviderLink): string {
  return [
    link.entityType,
    link.entityId,
    link.provider,
    link.providerEntityType,
    link.providerEntityId
  ].join('|');
}

function provenanceIdentity(record: FieldProvenance): string {
  return [
    record.entityType,
    record.entityId,
    record.fieldPath,
    record.provider,
    record.providerEntityId
  ].join('|');
}

function provenanceFor(
  matchId: string,
  providerMatchId: string,
  observedAt: string,
  match: CanonicalMatch
): FieldProvenance[] {
  const values: Array<[string, unknown]> = [
    ['kickoffUtc', match.kickoffUtc],
    ['status', match.status],
    ['round', match.round]
  ];
  if (match.venue !== undefined) {
    values.push(['venue', match.venue]);
  }
  if (match.scoreHome !== null && match.scoreAway !== null) {
    values.push(['scoreHome', match.scoreHome], ['scoreAway', match.scoreAway]);
  }

  return values.map(([fieldPath, value]) => createFieldProvenance({
    entityType: 'match',
    entityId: matchId,
    fieldPath,
    provider: 'openfootball',
    providerEntityId: providerMatchId,
    value,
    observedAt,
    confidence: 1
  }));
}

export function adaptOpenFootballMatches(input: OpenFootballAdapterInput): OpenFootballCanonicalBatch {
  const matches: CanonicalMatch[] = [];
  const teamsById = new Map<string, CanonicalTeam>();
  const links: ProviderLink[] = [];
  const provenance: FieldProvenance[] = [];
  const issues: OpenFootballCanonicalBatch['issues'] = [];

  for (const parsedMatch of input.parsedMatches) {
    if (parsedMatch.competitionHeader !== input.source.expectedCompetitionHeader) {
      issues.push({
        code: 'competition_header_mismatch',
        lineNumber: parsedMatch.lineNumber,
        message: 'Parsed competition header differs from the tracked OpenFootball source header'
      });
      continue;
    }

    const home = resolveOpenFootballTeamAlias(input.source.entryId, parsedMatch.sourceHomeName);
    const away = resolveOpenFootballTeamAlias(input.source.entryId, parsedMatch.sourceAwayName);
    if (home === undefined || away === undefined) {
      issues.push({
        code: 'unresolved_team_alias',
        lineNumber: parsedMatch.lineNumber,
        message: 'Parsed OpenFootball team name is not an explicitly tracked alias'
      });
      continue;
    }

    let kickoffUtc: string;
    try {
      kickoffUtc = toOpenFootballKickoffUtc(parsedMatch, input.source.sourceTimezone);
    } catch (cause) {
      issues.push({
        code: 'invalid_kickoff_time',
        lineNumber: parsedMatch.lineNumber,
        message: cause instanceof Error ? cause.message : 'OpenFootball kickoff conversion failed'
      });
      continue;
    }

    const round = normalizeRound(parsedMatch.round);
    const matchId = buildCanonicalMatchId({
      competitionId: input.source.competitionId,
      season: input.source.season,
      normalizedRound: round,
      homeTeamId: home.teamId,
      awayTeamId: away.teamId
    });
    const score = parsedMatch.fullTimeScore;
    const canonicalMatch: CanonicalMatch = {
      matchId,
      competitionId: input.source.competitionId,
      season: input.source.season,
      kickoffUtc,
      status: score === null ? 'scheduled' : 'completed',
      homeTeamId: home.teamId,
      awayTeamId: away.teamId,
      scoreHome: score?.home ?? null,
      scoreAway: score?.away ?? null,
      round,
      updatedAt: input.observedAt,
      ...(parsedMatch.venue === undefined ? {} : { venue: parsedMatch.venue })
    };
    const matchProviderEntityId = providerEntityId(input.source, parsedMatch);

    matches.push(canonicalMatch);
    teamsById.set(home.teamId, { teamId: home.teamId, name: home.canonicalName, updatedAt: input.observedAt });
    teamsById.set(away.teamId, { teamId: away.teamId, name: away.canonicalName, updatedAt: input.observedAt });
    links.push({
      entityType: 'match',
      entityId: matchId,
      provider: 'openfootball',
      providerEntityType: 'match',
      providerEntityId: matchProviderEntityId,
      confidence: 1,
      linkedBy: 'openfootball-adapter',
      linkedAt: input.observedAt
    });
    provenance.push(...provenanceFor(matchId, matchProviderEntityId, input.observedAt, canonicalMatch));
  }

  return {
    matches,
    teams: [...teamsById.values()],
    competitions: matches.length === 0 ? [] : [{
      competitionId: input.source.competitionId,
      name: input.source.competitionName,
      type: input.source.competitionType,
      updatedAt: input.observedAt
    }],
    links: dedupeBy(links, providerLinkIdentity),
    provenance: dedupeBy(provenance, provenanceIdentity),
    issues
  };
}
