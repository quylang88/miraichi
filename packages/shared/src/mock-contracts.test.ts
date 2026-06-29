import { describe, expect, it } from 'vitest';
import { MOCK_BETS, MOCK_PREDICTIONS } from './mock-contracts.js';

describe('shared mock contracts', () => {
  it('links mock predictions and bets back to match identifiers', () => {
    expect(MOCK_PREDICTIONS.match_2026_001.matchId).toBe('match_2026_001');
    expect(MOCK_BETS[0]).toMatchObject({
      matchId: 'match_2026_001',
      predictionId: 'pred_2026_9999'
    });
  });
});
