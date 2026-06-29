export type DiscoveryCompetitionType = 'national_team' | 'club';
export type DiscoveryGender = 'men' | 'women';
export type DiscoverySeniority = 'senior' | 'u23' | 'u21' | 'u20' | 'u19' | 'u17';

export type SofascoreDiscoveryCompetition = {
  competitionId: string;
  displayName: string;
  competitionType: DiscoveryCompetitionType;
  gender: DiscoveryGender;
  seniority: DiscoverySeniority;
  sofascoreUniqueTournamentId: number;
  enabledForDiscovery: boolean;
  minimumCompletedSeasonsForFutureIngestion: number;
};

export type SofascoreDiscoveryRegistry = {
  providerId: 'sofascore-direct';
  phase: '8.6B';
  competitions: SofascoreDiscoveryCompetition[];
};

export function validateDiscoveryRegistry(registry: SofascoreDiscoveryRegistry): string[] {
  const errors: string[] = [];
  const competitionIds = new Set<string>();
  const tournamentIds = new Set<number>();

  for (const competition of registry.competitions) {
    if (competitionIds.has(competition.competitionId)) {
      errors.push(`Duplicate competitionId: ${competition.competitionId}.`);
    }
    competitionIds.add(competition.competitionId);

    if (tournamentIds.has(competition.sofascoreUniqueTournamentId)) {
      errors.push(`Duplicate sofascoreUniqueTournamentId: ${competition.sofascoreUniqueTournamentId}.`);
    }
    tournamentIds.add(competition.sofascoreUniqueTournamentId);

    if (competition.competitionType !== 'national_team') {
      errors.push(`${competition.competitionId} is club scope and must not be included in Phase 8.6B discovery.`);
    }

    if (competition.seniority !== 'senior') {
      errors.push(
        `${competition.competitionId} is ${competition.seniority} scope; Phase 8.6B only allows senior national-team competitions.`
      );
    }

    if (!competition.enabledForDiscovery) {
      errors.push(`${competition.competitionId} is disabled and should be removed from the Phase 8.6B discovery registry.`);
    }
  }

  return errors;
}
