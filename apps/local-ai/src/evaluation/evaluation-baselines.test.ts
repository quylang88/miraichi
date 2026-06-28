import { describe, expect, it } from 'vitest';
import type { EvaluationFixture } from './evaluation-dataset.js';
import {
  bookmakerBaselineForFixture,
  smoothedOutcomeFrequencyBaseline,
  uniformBaseline
} from './evaluation-baselines.js';

const trainFixtures: EvaluationFixture[] = [
  {
    matchId: 'match-1',
    split: 'train',
    competitionId: 'comp-int-world-cup',
    kickoffTime: '2014-06-16T13:00:00Z',
    actualOutcome: 'home'
  },
  {
    matchId: 'match-2',
    split: 'train',
    competitionId: 'comp-int-world-cup',
    kickoffTime: '2018-07-15T18:00:00Z',
    actualOutcome: 'draw'
  }
];

describe('Phase 8.3 evaluation baselines', () => {
  it('builds a uniform 1X2 baseline', () => {
    expect(uniformBaseline().probabilities).toEqual({
      home: 1 / 3,
      draw: 1 / 3,
      away: 1 / 3
    });
  });

  it('builds a smoothed train-split outcome frequency baseline', () => {
    const baseline = smoothedOutcomeFrequencyBaseline(trainFixtures);

    expect(baseline.id).toBe('train_outcome_frequency_smoothed');
    expect(baseline.probabilities).toEqual({
      home: 0.4,
      draw: 0.4,
      away: 0.2
    });
  });

  it('returns bookmaker probabilities only when all pre-match market probabilities exist', () => {
    expect(
      bookmakerBaselineForFixture({
        matchId: 'match-market',
        split: 'test',
        competitionId: 'comp-int-world-cup',
        kickoffTime: '2022-11-26T22:00:00Z',
        actualOutcome: 'home',
        marketProbabilities: { home: 0.5, draw: 0.25, away: 0.25 }
      })
    ).toEqual({
      id: 'bookmaker_implied_pre_match',
      probabilities: { home: 0.5, draw: 0.25, away: 0.25 }
    });

    expect(
      bookmakerBaselineForFixture({
        matchId: 'match-no-market',
        split: 'test',
        competitionId: 'comp-int-world-cup',
        kickoffTime: '2022-11-26T22:00:00Z',
        actualOutcome: 'home'
      })
    ).toBeNull();
  });
});
