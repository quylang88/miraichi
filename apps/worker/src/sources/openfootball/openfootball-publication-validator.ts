import type { OpenFootballCompetitionSource } from '@miraichi/config';
import { validateCanonicalMatch, type LocalMatch } from '@miraichi/shared';
import type { CanonicalWarehouseSnapshot } from '../../../../../scripts/providers/shared/canonical-warehouse.js';

export interface OpenFootballPublicationValidationInput {
  sources: readonly OpenFootballCompetitionSource[];
  candidate: CanonicalWarehouseSnapshot;
  priorMatches: LocalMatch[];
}

export function validateOpenFootballPublicationCandidate(
  input: OpenFootballPublicationValidationInput
): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const enabledSources = input.sources.filter((source) => source.enabled);
  const candidateIds = new Set<string>();
  const teamById = new Map(input.candidate.teams.map((team) => [team.teamId, team]));

  for (const match of input.candidate.matches) {
    const validation = validateCanonicalMatch(match);
    if (!validation.ok) {
      errors.push(`invalid canonical match ${match.matchId || '<unknown>'}: ${validation.errors.join(', ')}`);
    }
    if (match.status === ('in_play' as never)) {
      errors.push(`canonical match ${match.matchId} must not have in_play status`);
    }
    if (candidateIds.has(match.matchId)) {
      errors.push(`duplicate matchId in candidate: ${match.matchId}`);
    }
    candidateIds.add(match.matchId);
    const homeTeam = teamById.get(match.homeTeamId);
    if (!homeTeam || homeTeam.name.trim() === '') {
      errors.push(`missing canonical home team ${match.homeTeamId} for match ${match.matchId}`);
    }
    const awayTeam = teamById.get(match.awayTeamId);
    if (!awayTeam || awayTeam.name.trim() === '') {
      errors.push(`missing canonical away team ${match.awayTeamId} for match ${match.matchId}`);
    }
  }

  for (const source of enabledSources) {
    const key = partitionKey(source.competitionId, source.season);
    const candidateMatches = input.candidate.matches.filter((match) => partitionKey(match.competitionId, match.season) === key);
    const sourcePrefix = `${source.entryId}:`;
    const sourceMatchIds = new Set(input.candidate.links
      .filter((link) => link.entityType === 'match' && link.provider === 'openfootball' && link.providerEntityId.startsWith(sourcePrefix))
      .map((link) => link.entityId));
    const sourceCandidateMatches = candidateMatches.filter((match) => sourceMatchIds.has(match.matchId));
    if (sourceCandidateMatches.length < source.minimumExpectedMatches) {
      errors.push(`source ${source.entryId} has ${sourceCandidateMatches.length} matches, below minimum ${source.minimumExpectedMatches}`);
    }
    if (sourceCandidateMatches.length === 0) {
      errors.push(`candidate is missing enabled source ${source.entryId}`);
    }

    const priorCount = input.priorMatches.filter((match) => partitionKey(match.competition.id, match.competition.season) === key).length;
    if (priorCount > 0 && candidateMatches.length < priorCount) {
      const missingRatio = (priorCount - candidateMatches.length) / priorCount;
      if (missingRatio > source.maximumMissingRatio) {
        errors.push(`source ${source.entryId} lost ${(missingRatio * 100).toFixed(2)}% of prior matches, above ${(source.maximumMissingRatio * 100).toFixed(2)}%`);
      }
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

function partitionKey(competitionId: string, season: string): string {
  return `${competitionId}\u0000${season}`;
}
