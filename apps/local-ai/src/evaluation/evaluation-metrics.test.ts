import { describe, expect, it } from 'vitest';
import {
  brierScore,
  expectedCalibrationError,
  logLoss,
  type EvaluationSample
} from './evaluation-metrics.js';

const samples: EvaluationSample[] = [
  {
    actualOutcome: 'home',
    probabilities: { home: 0.7, draw: 0.2, away: 0.1 }
  },
  {
    actualOutcome: 'draw',
    probabilities: { home: 0.2, draw: 0.5, away: 0.3 }
  },
  {
    actualOutcome: 'away',
    probabilities: { home: 0.1, draw: 0.3, away: 0.6 }
  }
];

describe('Phase 8.3 pure TypeScript evaluation metrics', () => {
  it('calculates multiclass Brier score without external libraries', () => {
    expect(brierScore(samples)).toBeCloseTo(0.26, 10);
  });

  it('calculates clipped multiclass log loss', () => {
    expect(logLoss(samples)).toBeCloseTo(0.5202159160882228, 12);
    expect(
      logLoss([
        {
          actualOutcome: 'away',
          probabilities: { home: 0.5, draw: 0.5, away: 0 }
        }
      ])
    ).toBeCloseTo(-Math.log(1e-15), 12);
  });

  it('calculates ECE with explicit bin counts and confidence gaps', () => {
    const result = expectedCalibrationError(samples, 5);

    expect(result.sampleCount).toBe(3);
    expect(result.binCount).toBe(5);
    expect(result.ece).toBeCloseTo(0.4, 10);
    expect(result.bins.map((bin) => bin.sampleCount)).toEqual([0, 0, 1, 2, 0]);
  });

  it('rejects empty samples and invalid probability vectors', () => {
    expect(() => brierScore([])).toThrow('At least one evaluation sample is required.');
    expect(() =>
      brierScore([
        {
          actualOutcome: 'home',
          probabilities: { home: 0.8, draw: 0.2, away: 0.2 }
        }
      ])
    ).toThrow('Predicted probabilities must sum to 1.');
  });
});
