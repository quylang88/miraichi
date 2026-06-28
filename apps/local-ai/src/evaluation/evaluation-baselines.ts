import type { EvaluationFixture } from './evaluation-dataset.js';
import type { OutcomeClass, OutcomeProbabilities } from './evaluation-metrics.js';

export type BaselinePrediction = {
  id: 'uniform_1x2' | 'train_outcome_frequency_smoothed' | 'bookmaker_implied_pre_match';
  probabilities: OutcomeProbabilities;
};

const OUTCOMES: readonly OutcomeClass[] = ['home', 'draw', 'away'];
const LAPLACE_ALPHA = 1;

export function uniformBaseline(): BaselinePrediction {
  return {
    id: 'uniform_1x2',
    probabilities: {
      home: 1 / 3,
      draw: 1 / 3,
      away: 1 / 3
    }
  };
}

export function smoothedOutcomeFrequencyBaseline(
  trainFixtures: readonly EvaluationFixture[]
): BaselinePrediction {
  const counts: Record<OutcomeClass, number> = {
    home: LAPLACE_ALPHA,
    draw: LAPLACE_ALPHA,
    away: LAPLACE_ALPHA
  };

  for (const fixture of trainFixtures) {
    counts[fixture.actualOutcome] += 1;
  }

  const total = OUTCOMES.reduce((sum, outcome) => sum + counts[outcome], 0);

  return {
    id: 'train_outcome_frequency_smoothed',
    probabilities: {
      home: counts.home / total,
      draw: counts.draw / total,
      away: counts.away / total
    }
  };
}

export function bookmakerBaselineForFixture(
  fixture: EvaluationFixture
): BaselinePrediction | null {
  if (!fixture.marketProbabilities) return null;

  return {
    id: 'bookmaker_implied_pre_match',
    probabilities: fixture.marketProbabilities
  };
}
