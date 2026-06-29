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
