import { describe, expect, it } from 'vitest';
import {
  validateDiscoveryRegistry,
  type SofascoreDiscoveryRegistry
} from './sofascore-national-team-discovery.js';

describe('Phase 8.6B Sofascore discovery registry', () => {
  it('accepts only enabled senior national-team competitions with unique ids', () => {
    const registry: SofascoreDiscoveryRegistry = {
      providerId: 'sofascore-direct',
      phase: '8.6B',
      competitions: [
        {
          competitionId: 'comp-int-world-cup',
          displayName: 'FIFA World Cup',
          competitionType: 'national_team',
          gender: 'men',
          seniority: 'senior',
          sofascoreUniqueTournamentId: 16,
          enabledForDiscovery: true,
          minimumCompletedSeasonsForFutureIngestion: 2
        },
        {
          competitionId: 'comp-int-afcon',
          displayName: 'Africa Cup of Nations',
          competitionType: 'national_team',
          gender: 'men',
          seniority: 'senior',
          sofascoreUniqueTournamentId: 270,
          enabledForDiscovery: true,
          minimumCompletedSeasonsForFutureIngestion: 2
        }
      ]
    };

    expect(validateDiscoveryRegistry(registry)).toEqual([]);
  });

  it('rejects duplicate ids, club scope, non-senior scope, and disabled entries', () => {
    const registry: SofascoreDiscoveryRegistry = {
      providerId: 'sofascore-direct',
      phase: '8.6B',
      competitions: [
        {
          competitionId: 'comp-int-afcon',
          displayName: 'Africa Cup of Nations',
          competitionType: 'national_team',
          gender: 'men',
          seniority: 'senior',
          sofascoreUniqueTournamentId: 270,
          enabledForDiscovery: true,
          minimumCompletedSeasonsForFutureIngestion: 2
        },
        {
          competitionId: 'comp-int-afcon',
          displayName: 'Africa Cup of Nations duplicate',
          competitionType: 'national_team',
          gender: 'men',
          seniority: 'senior',
          sofascoreUniqueTournamentId: 270,
          enabledForDiscovery: true,
          minimumCompletedSeasonsForFutureIngestion: 2
        },
        {
          competitionId: 'comp-eng-premier-league',
          displayName: 'Premier League',
          competitionType: 'club',
          gender: 'men',
          seniority: 'senior',
          sofascoreUniqueTournamentId: 17,
          enabledForDiscovery: true,
          minimumCompletedSeasonsForFutureIngestion: 2
        },
        {
          competitionId: 'comp-int-u23-asian-cup',
          displayName: 'U23 AFC Asian Cup',
          competitionType: 'national_team',
          gender: 'men',
          seniority: 'u23',
          sofascoreUniqueTournamentId: 2349,
          enabledForDiscovery: true,
          minimumCompletedSeasonsForFutureIngestion: 2
        },
        {
          competitionId: 'comp-int-disabled',
          displayName: 'Disabled Candidate',
          competitionType: 'national_team',
          gender: 'men',
          seniority: 'senior',
          sofascoreUniqueTournamentId: 99999,
          enabledForDiscovery: false,
          minimumCompletedSeasonsForFutureIngestion: 2
        }
      ]
    };

    expect(validateDiscoveryRegistry(registry)).toEqual([
      'Duplicate competitionId: comp-int-afcon.',
      'Duplicate sofascoreUniqueTournamentId: 270.',
      'comp-eng-premier-league is club scope and must not be included in Phase 8.6B discovery.',
      'comp-int-u23-asian-cup is u23 scope; Phase 8.6B only allows senior national-team competitions.',
      'comp-int-disabled is disabled and should be removed from the Phase 8.6B discovery registry.'
    ]);
  });
});

import {
  buildSofascoreDiscoveryReport,
  type SofascoreDiscoveryClient
} from './sofascore-national-team-discovery.js';

const fixedNow = new Date('2026-06-29T00:00:00Z');

function fakeClient(): SofascoreDiscoveryClient {
  return {
    async fetchSeasons(tournamentId: number) {
      if (tournamentId === 270) {
        return [
          { name: 'Africa Cup of Nations 2025', year: '26/27', seasonId: 71636 },
          { name: 'Africa Cup of Nations 2023', year: '2023', seasonId: 56021 },
          { name: 'Africa Cup of Nations 2021', year: '2021', seasonId: 38181 }
        ];
      }

      if (tournamentId === 246) {
        return [
          { name: 'AFC Asian Cup 2027', year: '2027', seasonId: 94444 },
          { name: 'AFC Asian Cup 2023', year: '2023', seasonId: 51384 },
          { name: 'AFC Asian Cup 2019', year: '2019', seasonId: 16919 }
        ];
      }

      return [];
    },
    async fetchRounds(tournamentId: number, seasonId: number) {
      if (tournamentId === 270 && seasonId === 56021) {
        return [{ round: 1 }, { round: 2 }];
      }
      if (tournamentId === 270 && seasonId === 38181) {
        return [{ round: 1 }];
      }
      if (tournamentId === 246 && seasonId === 51384) {
        return [{ round: 1 }];
      }
      if (tournamentId === 246 && seasonId === 16919) {
        return [{ round: 1 }];
      }
      return [];
    },
    async fetchEventsForRound(tournamentId: number, seasonId: number, round: number) {
      if (tournamentId === 270 && seasonId === 56021 && round === 1) {
        return [
          {
            eventId: 11761871,
            startTimestamp: 1705176000,
            statusCode: 100,
            homeTeamName: 'Cote d Ivoire',
            awayTeamName: 'Guinea-Bissau',
            homeScore: 2,
            awayScore: 0
          },
          {
            eventId: 11761872,
            startTimestamp: 1705240800,
            statusCode: 100,
            homeTeamName: '',
            awayTeamName: 'Nigeria',
            homeScore: 1,
            awayScore: 1
          }
        ];
      }

      if (tournamentId === 270 && seasonId === 56021 && round === 2) {
        return [
          {
            eventId: 11761873,
            startTimestamp: 1705600000,
            statusCode: 60,
            homeTeamName: 'Ghana',
            awayTeamName: 'Egypt',
            homeScore: null,
            awayScore: null
          }
        ];
      }

      if (tournamentId === 270 && seasonId === 38181 && round === 1) {
        return [
          {
            eventId: 991,
            startTimestamp: 1642000000,
            statusCode: 100,
            homeTeamName: 'Cameroon',
            awayTeamName: 'Burkina Faso',
            homeScore: 2,
            awayScore: 1
          }
        ];
      }

      if (tournamentId === 246 && seasonId === 51384 && round === 1) {
        return [
          {
            eventId: 1001,
            startTimestamp: 1705000000,
            statusCode: 100,
            homeTeamName: 'Qatar',
            awayTeamName: 'Lebanon',
            homeScore: 3,
            awayScore: 0
          }
        ];
      }

      if (tournamentId === 246 && seasonId === 16919 && round === 1) {
        return [
          {
            eventId: 1002,
            startTimestamp: 1547000000,
            statusCode: 100,
            homeTeamName: 'Japan',
            awayTeamName: 'Turkmenistan',
            homeScore: 3,
            awayScore: 2
          }
        ];
      }

      return [];
    }
  };
}

describe('Phase 8.6B Sofascore discovery quality gates', () => {
  it('filters future seasons, counts rejected events, and marks usable competitions ready', async () => {
    const registry: SofascoreDiscoveryRegistry = {
      providerId: 'sofascore-direct',
      phase: '8.6B',
      competitions: [
        {
          competitionId: 'comp-int-afcon',
          displayName: 'Africa Cup of Nations',
          competitionType: 'national_team',
          gender: 'men',
          seniority: 'senior',
          sofascoreUniqueTournamentId: 270,
          enabledForDiscovery: true,
          minimumCompletedSeasonsForFutureIngestion: 2
        },
        {
          competitionId: 'comp-int-afc-asian-cup',
          displayName: 'AFC Asian Cup',
          competitionType: 'national_team',
          gender: 'men',
          seniority: 'senior',
          sofascoreUniqueTournamentId: 246,
          enabledForDiscovery: true,
          minimumCompletedSeasonsForFutureIngestion: 2
        }
      ]
    };

    const report = await buildSofascoreDiscoveryReport(registry, fakeClient(), { now: fixedNow });

    expect(report.status).toBe('pass');
    expect(report.competitions).toHaveLength(2);
    expect(report.competitions[0]).toMatchObject({
      competitionId: 'comp-int-afcon',
      discoveryStatus: 'ready_for_ingestion_plan',
      completedSeasonCount: 2,
      futureSeasonCount: 1,
      completedEventCount: 2,
      rejectedEventCount: 2
    });
    expect(report.competitions[0].rejectedEventReasons).toEqual({
      missing_team_name: 1,
      not_finished: 1
    });
    expect(report.competitions[1]).toMatchObject({
      competitionId: 'comp-int-afc-asian-cup',
      discoveryStatus: 'ready_for_ingestion_plan',
      completedSeasonCount: 2,
      futureSeasonCount: 1,
      completedEventCount: 2,
    });
  });
});

import {
  buildOddsBaselineDiscoveryReport,
  generateSofascoreDiscoveryMarkdown
} from './sofascore-national-team-discovery.js';

describe('Phase 8.6B odds baseline discovery', () => {
  it('keeps bookmaker baseline unavailable under current no-key and no-paid-provider constraints', () => {
    const report = buildOddsBaselineDiscoveryReport({
      generatedAt: '2026-06-29T00:00:00.000Z'
    });

    expect(report.status).toBe('blocked');
    expect(report.bookmakerBaselineStatus).toBe('bookmaker_baseline_unavailable_under_current_constraints');
    expect(report.sources).toEqual([
      expect.objectContaining({
        sourceId: 'the-odds-api',
        currentConstraintStatus: 'blocked_paid_or_keyed'
      }),
      expect.objectContaining({
        sourceId: 'api-football',
        currentConstraintStatus: 'blocked_keyed_or_unverified'
      }),
      expect.objectContaining({
        sourceId: 'football-data-match-history',
        currentConstraintStatus: 'rejected_national_team_coverage_missing'
      }),
      expect.objectContaining({
        sourceId: 'sofascore',
        currentConstraintStatus: 'rejected_no_odds_fields'
      })
    ]);
  });

  it('generates Markdown with explicit non-authorizations and no fake PASS lines', async () => {
    const discoveryReport = await buildSofascoreDiscoveryReport(
      {
        providerId: 'sofascore-direct',
        phase: '8.6B',
        competitions: [
          {
            competitionId: 'comp-int-afcon',
            displayName: 'Africa Cup of Nations',
            competitionType: 'national_team',
            gender: 'men',
            seniority: 'senior',
            sofascoreUniqueTournamentId: 270,
            enabledForDiscovery: true,
            minimumCompletedSeasonsForFutureIngestion: 2
          }
        ]
      },
      fakeClient(),
      { now: fixedNow }
    );
    const oddsReport = buildOddsBaselineDiscoveryReport({
      generatedAt: '2026-06-29T00:00:00.000Z'
    });

    const markdown = generateSofascoreDiscoveryMarkdown(discoveryReport, oddsReport);

    expect(markdown).toContain('# Phase 8.6B Sofascore National-Team Source Discovery Report');
    expect(markdown).toContain('- Bookmaker baseline available now: no');
    expect(markdown).toContain('- `pnpm run phase8:sofascore-national-team-discovery`: PASS');
    expect(markdown).toContain('- `pnpm run verify:local`: Required external verification');
    expect(markdown).not.toContain('- `pnpm run verify:local`: PASS');
    expect(markdown).toContain('- No main training dataset merge.');
    expect(markdown).toContain('- No fake bookmaker baseline.');
    expect(markdown).toContain('- No club competition expansion.');
  });
});


