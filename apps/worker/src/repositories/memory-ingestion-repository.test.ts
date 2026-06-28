import { describe, expect, it } from 'vitest';
import type { IngestionRun, NormalizedMarket, NormalizedMatch } from '../../../../packages/shared/src/contracts/index.js';
import { memoryIngestionRepository } from './memory-ingestion-repository.js';

describe('memoryIngestionRepository', () => {
  it('stores cloned typed matches, markets, and run reports', () => {
    memoryIngestionRepository.clear();

    const match: NormalizedMatch = {
      id: 'match-alpha-001',
      competitionId: 'competition-alpha',
      seasonId: 'season-alpha-2026',
      homeTeamId: 'team-alpha',
      awayTeamId: 'team-beta',
      status: 'scheduled',
      kickoffTime: '2026-06-23T23:00:00Z'
    };
    const market: NormalizedMarket = {
      id: 'market-alpha-001',
      matchId: 'match-alpha-001',
      marketName: '1X2',
      providerId: 'provider-mock-alpha',
      updatedAt: '2026-06-23T23:01:00Z',
      outcomes: [{ outcomeId: 'outcome-alpha-home', name: 'home', odds: 2.1 }]
    };
    const run: IngestionRun = {
      id: 'run-alpha-001',
      providerId: 'provider-mock-alpha',
      status: 'success',
      startTime: '2026-06-23T23:00:00Z',
      endTime: '2026-06-23T23:02:00Z',
      metrics: { processedCount: 2, successCount: 2, skippedCount: 0 }
    };

    memoryIngestionRepository.saveMatch(match);
    memoryIngestionRepository.saveMarket(market);
    memoryIngestionRepository.saveRun(run);

    match.status = 'completed';

    expect(memoryIngestionRepository.getMatch('match-alpha-001')?.status).toBe('scheduled');
    expect(memoryIngestionRepository.getMarket('market-alpha-001')?.outcomes[0]?.odds).toBe(2.1);
    expect(memoryIngestionRepository.listRuns()).toEqual([run]);
  });
});
