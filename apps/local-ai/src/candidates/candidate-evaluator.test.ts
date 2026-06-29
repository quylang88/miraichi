import { describe, expect, it } from 'vitest';
import { evaluateCandidateBatch } from './candidate-evaluator.js';
import type { CandidatePredictionBatch } from './candidate-types.js';

describe('Phase 8.4 candidate evaluator', () => {
  it('scores candidate predictions with the existing Phase 8 metrics', () => {
    const batch: CandidatePredictionBatch = {
      candidateId: 'candidate-test',
      candidateFamily: 'elo_rating',
      trainedOnSplitNames: ['train'],
      evaluatedOnSplitName: 'test',
      predictions: [
        {
          matchId: 'match-1',
          actualOutcome: 'home',
          probabilities: { home: 0.7, draw: 0.2, away: 0.1 }
        },
        {
          matchId: 'match-2',
          actualOutcome: 'away',
          probabilities: { home: 0.2, draw: 0.2, away: 0.6 }
        }
      ]
    };

    const result = evaluateCandidateBatch(batch, { eceBinCount: 5 });

    expect(result.candidateId).toBe('candidate-test');
    expect(result.evaluatedSampleCount).toBe(2);
    expect(result.metrics.logLoss).toBeCloseTo((-Math.log(0.7) - Math.log(0.6)) / 2, 10);
    expect(result.metrics.classAccuracy).toBe(1);
    expect(result.metrics.expectedCalibrationError.sampleCount).toBe(2);
  });

  it('rejects candidate batches with no test predictions', () => {
    const batch: CandidatePredictionBatch = {
      candidateId: 'empty-candidate',
      candidateFamily: 'elo_rating',
      trainedOnSplitNames: ['train'],
      evaluatedOnSplitName: 'test',
      predictions: []
    };

    expect(() => evaluateCandidateBatch(batch)).toThrow(
      'Candidate empty-candidate produced no test predictions.'
    );
  });
});
