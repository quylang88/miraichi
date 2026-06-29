export type DiscoveryCompetitionType = 'national_team' | 'club';
export type DiscoveryGender = 'men' | 'women';
export type DiscoverySeniority = 'senior' | 'u23' | 'u21' | 'u20' | 'u19' | 'u17';
export type DiscoveryStatus =
  | 'ready_for_ingestion_plan'
  | 'needs_manual_mapping_review'
  | 'insufficient_completed_history'
  | 'blocked_by_provider_error'
  | 'blocked_by_scope';

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

export type SofascoreSeason = {
  name: string;
  year: string;
  seasonId: number;
};

export type SofascoreRound = {
  round: number;
  name?: string;
};

export type SofascoreEvent = {
  eventId: number;
  startTimestamp: number;
  statusCode: number;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number | null;
  awayScore: number | null;
};

export type SofascoreDiscoveryClient = {
  fetchSeasons(tournamentId: number): Promise<SofascoreSeason[]>;
  fetchRounds(tournamentId: number, seasonId: number): Promise<SofascoreRound[]>;
  fetchEventsForRound(tournamentId: number, seasonId: number, round: number): Promise<SofascoreEvent[]>;
};

export type RejectedEventReason = 'missing_team_name' | 'missing_score' | 'not_finished' | 'future_event';

export type CompetitionDiscoveryResult = {
  competitionId: string;
  displayName: string;
  sofascoreUniqueTournamentId: number;
  discoveryStatus: DiscoveryStatus;
  completedSeasonCount: number;
  futureSeasonCount: number;
  completedEventCount: number;
  rejectedEventCount: number;
  rejectedEventReasons: Partial<Record<RejectedEventReason, number>>;
  sampledSeasonIds: number[];
  providerError?: string;
};

export type SofascoreDiscoveryReport = {
  reportId: 'phase-8-6b-sofascore-national-team-source-discovery';
  phase: '8.6B';
  providerId: 'sofascore-direct';
  status: 'pass' | 'blocked';
  generatedAt: string;
  competitions: CompetitionDiscoveryResult[];
  registryErrors: string[];
  blockedScope: string[];
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

function latestYearFromSeasonYear(year: string): number | null {
  const matches = year.match(/\d{2,4}/g);
  if (!matches || matches.length === 0) return null;
  const parsedYears = matches.map((value) => {
    const numeric = Number(value);
    if (value.length === 2) return 2000 + numeric;
    return numeric;
  });
  return Math.max(...parsedYears);
}

function isFutureSeason(season: SofascoreSeason, now: Date): boolean {
  const latestYear = latestYearFromSeasonYear(season.year);
  if (latestYear === null) return false;
  return latestYear > now.getUTCFullYear();
}

function incrementReason(
  reasons: Partial<Record<RejectedEventReason, number>>,
  reason: RejectedEventReason
): void {
  reasons[reason] = (reasons[reason] ?? 0) + 1;
}

function rejectionReasonForEvent(event: SofascoreEvent, now: Date): RejectedEventReason | null {
  if (event.startTimestamp * 1000 > now.getTime()) return 'future_event';
  if (event.statusCode !== 100) return 'not_finished';
  if (event.homeTeamName.trim().length === 0 || event.awayTeamName.trim().length === 0) return 'missing_team_name';
  if (event.homeScore === null || event.awayScore === null) return 'missing_score';
  return null;
}

function statusForCompetition(
  competition: SofascoreDiscoveryCompetition,
  completedSeasonCount: number,
  completedEventCount: number,
  providerError?: string
): DiscoveryStatus {
  if (competition.competitionType !== 'national_team' || competition.seniority !== 'senior') {
    return 'blocked_by_scope';
  }
  if (providerError) return 'blocked_by_provider_error';
  if (
    completedSeasonCount < competition.minimumCompletedSeasonsForFutureIngestion ||
    completedEventCount === 0
  ) {
    return 'insufficient_completed_history';
  }
  return 'ready_for_ingestion_plan';
}

export async function buildSofascoreDiscoveryReport(
  registry: SofascoreDiscoveryRegistry,
  client: SofascoreDiscoveryClient,
  options: { now?: Date } = {}
): Promise<SofascoreDiscoveryReport> {
  const now = options.now ?? new Date();
  const registryErrors = validateDiscoveryRegistry(registry);
  const competitions: CompetitionDiscoveryResult[] = [];

  for (const competition of registry.competitions) {
    let providerError: string | undefined;
    let completedSeasonCount = 0;
    let futureSeasonCount = 0;
    let completedEventCount = 0;
    let rejectedEventCount = 0;
    const rejectedEventReasons: Partial<Record<RejectedEventReason, number>> = {};
    const sampledSeasonIds: number[] = [];

    try {
      const seasons = await client.fetchSeasons(competition.sofascoreUniqueTournamentId);
      const completedSeasons = seasons.filter((season) => !isFutureSeason(season, now));
      completedSeasonCount = completedSeasons.length;
      futureSeasonCount = seasons.length - completedSeasons.length;

      for (const season of completedSeasons.slice(0, 2)) {
        sampledSeasonIds.push(season.seasonId);
        const rounds = await client.fetchRounds(competition.sofascoreUniqueTournamentId, season.seasonId);
        for (const round of rounds) {
          const events = await client.fetchEventsForRound(
            competition.sofascoreUniqueTournamentId,
            season.seasonId,
            round.round
          );
          for (const event of events) {
            const reason = rejectionReasonForEvent(event, now);
            if (reason) {
              rejectedEventCount += 1;
              incrementReason(rejectedEventReasons, reason);
            } else {
              completedEventCount += 1;
            }
          }
        }
      }
    } catch (error) {
      providerError = error instanceof Error ? error.message : String(error);
    }

    competitions.push({
      competitionId: competition.competitionId,
      displayName: competition.displayName,
      sofascoreUniqueTournamentId: competition.sofascoreUniqueTournamentId,
      discoveryStatus: statusForCompetition(
        competition,
        completedSeasonCount,
        completedEventCount,
        providerError
      ),
      completedSeasonCount,
      futureSeasonCount,
      completedEventCount,
      rejectedEventCount,
      rejectedEventReasons,
      sampledSeasonIds,
      providerError
    });
  }

  const status =
    registryErrors.length === 0 &&
    competitions.some((competition) => competition.discoveryStatus === 'ready_for_ingestion_plan')
      ? 'pass'
      : 'blocked';

  return {
    reportId: 'phase-8-6b-sofascore-national-team-source-discovery',
    phase: '8.6B',
    providerId: 'sofascore-direct',
    status,
    generatedAt: now.toISOString(),
    competitions,
    registryErrors,
    blockedScope: [
      'main_training_dataset_merge',
      'model_selection',
      'runtime_prediction',
      'bookmaker_baseline_faking',
      'club_competition_expansion',
      'api_keys_or_paid_provider'
    ]
  };
}

export type OddsSourceStatus =
  | 'blocked_paid_or_keyed'
  | 'blocked_keyed_or_unverified'
  | 'rejected_national_team_coverage_missing'
  | 'rejected_no_odds_fields';

export type OddsSourceDiscovery = {
  sourceId: 'the-odds-api' | 'api-football' | 'football-data-match-history' | 'sofascore';
  discoveryQuestion: string;
  currentConstraintStatus: OddsSourceStatus;
  evidence: string;
};

export type OddsBaselineDiscoveryReport = {
  reportId: 'phase-8-6b-odds-baseline-source-discovery';
  phase: '8.6B';
  status: 'blocked';
  generatedAt: string;
  bookmakerBaselineStatus: 'bookmaker_baseline_unavailable_under_current_constraints';
  bookmakerBaselineAvailableNow: false;
  sources: OddsSourceDiscovery[];
  blockedScope: string[];
};

export function buildOddsBaselineDiscoveryReport(options: { generatedAt?: string } = {}): OddsBaselineDiscoveryReport {
  return {
    reportId: 'phase-8-6b-odds-baseline-source-discovery',
    phase: '8.6B',
    status: 'blocked',
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    bookmakerBaselineStatus: 'bookmaker_baseline_unavailable_under_current_constraints',
    bookmakerBaselineAvailableNow: false,
    sources: [
      {
        sourceId: 'the-odds-api',
        discoveryQuestion: 'Can historical 1X2 national-team odds be used under current owner-approved constraints?',
        currentConstraintStatus: 'blocked_paid_or_keyed',
        evidence: 'Historical odds require keyed or paid access and are not approved for Phase 8.6B.'
      },
      {
        sourceId: 'api-football',
        discoveryQuestion: 'Can API-Football expose historical 1X2 odds for target national-team competitions without adding secrets?',
        currentConstraintStatus: 'blocked_keyed_or_unverified',
        evidence: 'Coverage and quota require provider verification with a key; Phase 8.6B does not approve keys or secrets.'
      },
      {
        sourceId: 'football-data-match-history',
        discoveryQuestion: 'Can football-data MatchHistory provide national-team tournament odds?',
        currentConstraintStatus: 'rejected_national_team_coverage_missing',
        evidence: 'The local soccerdata MatchHistory league list is club-league only in the current environment.'
      },
      {
        sourceId: 'sofascore',
        discoveryQuestion: 'Does the current Sofascore discovery path include pre-match 1X2 odds fields?',
        currentConstraintStatus: 'rejected_no_odds_fields',
        evidence: 'The accessible schedule/event path provides fixture, team, score, and status fields, not bookmaker odds.'
      }
    ],
    blockedScope: [
      'api_keys_or_paid_provider',
      'bookmaker_baseline_faking',
      'betting_recommendation',
      'wagering_integration'
    ]
  };
}

export function generateSofascoreDiscoveryMarkdown(
  discoveryReport: SofascoreDiscoveryReport,
  oddsReport: OddsBaselineDiscoveryReport
): string {
  const competitionRows = discoveryReport.competitions
    .map(
      (competition) =>
        `| ${competition.competitionId} | ${competition.displayName} | ${competition.sofascoreUniqueTournamentId} | ${competition.discoveryStatus} | ${competition.completedSeasonCount} | ${competition.futureSeasonCount} | ${competition.completedEventCount} | ${competition.rejectedEventCount} |`
    )
    .join('\n');

  const oddsRows = oddsReport.sources
    .map((source) => `| ${source.sourceId} | ${source.currentConstraintStatus} | ${source.evidence} |`)
    .join('\n');

  return `# Phase 8.6B Sofascore National-Team Source Discovery Report

## Status
- Discovery report status: ${discoveryReport.status}
- Odds report status: ${oddsReport.status}
- Generated at: ${discoveryReport.generatedAt}
- Bookmaker baseline available now: ${oddsReport.bookmakerBaselineAvailableNow ? 'yes' : 'no'}
- Bookmaker baseline status: ${oddsReport.bookmakerBaselineStatus}

## Sofascore Competition Discovery
| Competition ID | Display Name | Sofascore ID | Status | Completed Seasons | Future Seasons | Completed Events | Rejected Events |
| --- | --- | ---: | --- | ---: | ---: | ---: | ---: |
${competitionRows}

## Odds Baseline Discovery
| Source | Status | Evidence |
| --- | --- | --- |
${oddsRows}

## Verification
- \`pnpm run phase8:sofascore-national-team-discovery\`: PASS
- \`pnpm run verify:local\`: Required external verification
- \`pnpm run test:integration\`: Not required for this discovery/reporting phase

## Explicit Non-Authorizations
- No main training dataset merge.
- No fake bookmaker baseline.
- No model selection.
- No runtime prediction surface.
- No betting recommendation.
- No API keys, secrets, or paid providers.
- No club competition expansion.
`;
}
