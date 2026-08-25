import type { CanonicalMatch } from '@miraichi/shared';

export interface ValidateApiFootballPublicationInput {
  candidateMatches: readonly CanonicalMatch[];
  priorMatches?: readonly CanonicalMatch[];
}

export interface PublicationValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateApiFootballPublicationCandidate(
  input: ValidateApiFootballPublicationInput
): PublicationValidationResult {
  const errors: string[] = [];
  const { candidateMatches, priorMatches = [] } = input;

  if (!Array.isArray(candidateMatches)) {
    return { ok: false, errors: ['candidateMatches must be an array'] };
  }

  const priorById = new Map<string, CanonicalMatch>();
  for (const match of priorMatches) {
    priorById.set(match.matchId, match);
  }

  for (let i = 0; i < candidateMatches.length; i++) {
    const match = candidateMatches[i]!;

    if (!match.matchId || match.matchId.trim() === '') {
      errors.push(`candidateMatches[${i}].matchId must be a non-empty string`);
      continue;
    }

    if (!match.competitionId || match.competitionId.trim() === '') {
      errors.push(`candidateMatches[${i}].competitionId must be a non-empty string`);
    }

    if (!match.kickoffUtc || Number.isNaN(Date.parse(match.kickoffUtc))) {
      errors.push(`candidateMatches[${i}].kickoffUtc must be a valid ISO datetime`);
    }

    if (match.status === 'completed') {
      if (match.scoreHome === null || typeof match.scoreHome !== 'number' || match.scoreHome < 0) {
        errors.push(`candidateMatches[${i}] has status completed but missing valid scoreHome`);
      }
      if (match.scoreAway === null || typeof match.scoreAway !== 'number' || match.scoreAway < 0) {
        errors.push(`candidateMatches[${i}] has status completed but missing valid scoreAway`);
      }
    }

    // Monotonic status integrity: completed match cannot regress to scheduled
    const prior = priorById.get(match.matchId);
    if (prior && prior.status === 'completed' && match.status === 'scheduled') {
      errors.push(`candidateMatches[${i}] (${match.matchId}) attempted to regress status from completed to scheduled`);
    }
  }

  return {
    ok: errors.length === 0,
    errors
  };
}
