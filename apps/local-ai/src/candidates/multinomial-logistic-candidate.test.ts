import { describe, expect, it } from 'vitest';
import type { EvaluationDataset } from '../evaluation/evaluation-dataset.js';
import {
  predictWithMultinomialLogisticCandidate,
  trainMultinomialLogisticRegression
} from './multinomial-logistic-candidate.js';

describe('Phase 8.4 multinomial logistic candidate', () => {
  it('learns separable 3-class rows with deterministic softmax gradient descent', () => {
    const model = trainMultinomialLogisticRegression(
      [
        { features: [1, 1, 0], actualOutcome: 'home' },
        { features: [1, 1, 0], actualOutcome: 'home' },
        { features: [1, 0, 1], actualOutcome: 'away' },
        { features: [1, 0, 1], actualOutcome: 'away' },
        { features: [1, 0, 0], actualOutcome: 'draw' },
        { features: [1, 0, 0], actualOutcome: 'draw' }
      ],
      {
        iterations: 300,
        learningRate: 0.2,
        l2Penalty: 0.001
      }
    );

    const homePrediction = model.predict([1, 1, 0]);
    const awayPrediction = model.predict([1, 0, 1]);
    const drawPrediction = model.predict([1, 0, 0]);

    expect(homePrediction.home).toBeGreaterThan(homePrediction.away);
    expect(awayPrediction.away).toBeGreaterThan(awayPrediction.home);
    expect(drawPrediction.draw).toBeGreaterThan(0.34);
    expect(homePrediction.home + homePrediction.draw + homePrediction.away).toBeCloseTo(1, 10);
  });

  it('predicts batches from the public wrapper without leaking test outcomes', () => {
    const baseDataset: EvaluationDataset = {
      metadata: {
        datasetId: 'dataset-test-1',
        competitionId: 'comp-test-national-team',
        schemaVersion: '1',
        featureSpecVersion: '1',
        sourceProviderId: 'provider-test',
        sourceSnapshotHash: 'hash-test',
        builtAt: '2026-01-01T00:00:00Z',
        trainCount: 1,
        valCount: 0,
        testCount: 1
      },
      competitionId: 'comp-test-national-team',
      train: [
        {
          matchId: 'train-1',
          split: 'train',
          competitionId: 'comp-test-national-team',
          homeTeamId: 'home-1',
          awayTeamId: 'away-1',
          kickoffTime: '2026-01-01T12:00:00Z',
          actualOutcome: 'home'
        }
      ],
      validation: [],
      test: [
        {
          matchId: 'test-1',
          split: 'test',
          competitionId: 'comp-test-national-team',
          homeTeamId: 'home-2',
          awayTeamId: 'away-2',
          kickoffTime: '2026-01-02T12:00:00Z',
          actualOutcome: 'away'
        }
      ],
      skippedRecordCount: 0
    };

    const flippedDataset: EvaluationDataset = {
      ...baseDataset,
      test: [
        {
          ...baseDataset.test[0]!,
          actualOutcome: 'home'
        }
      ]
    };

    const batch = predictWithMultinomialLogisticCandidate(baseDataset);
    const flippedBatch = predictWithMultinomialLogisticCandidate(flippedDataset);

    expect(batch.candidateId).toBe('multinomial_logistic_competition_v0');
    expect(batch.candidateFamily).toBe('multinomial_logistic_regression');
    expect(batch.trainedOnSplitNames).toEqual(['train']);
    expect(batch.evaluatedOnSplitName).toBe('test');
    expect(batch.predictions).toHaveLength(1);
    expect(batch.predictions[0]?.matchId).toBe('test-1');
    expect(batch.predictions[0]?.actualOutcome).toBe('away');
    expect(
      batch.predictions[0]!.probabilities.home +
        batch.predictions[0]!.probabilities.draw +
        batch.predictions[0]!.probabilities.away
    ).toBeCloseTo(1, 10);

    expect(flippedBatch.predictions).toHaveLength(1);
    expect(flippedBatch.predictions[0]?.matchId).toBe('test-1');
    expect(flippedBatch.predictions[0]?.actualOutcome).toBe('home');
    expect(flippedBatch.predictions[0]?.probabilities).toEqual(batch.predictions[0]?.probabilities);
  });

  it('fails fast when a test fixture uses a competition not seen in train', () => {
    const dataset: EvaluationDataset = {
      metadata: {
        datasetId: 'dataset-test-unknown-comp',
        competitionId: 'comp-train-only',
        schemaVersion: '1',
        featureSpecVersion: '1',
        sourceProviderId: 'provider-test',
        sourceSnapshotHash: 'hash-test',
        builtAt: '2026-01-01T00:00:00Z',
        trainCount: 1,
        valCount: 0,
        testCount: 1
      },
      competitionId: 'comp-train-only',
      train: [
        {
          matchId: 'train-1',
          split: 'train',
          competitionId: 'comp-train-only',
          homeTeamId: 'home-1',
          awayTeamId: 'away-1',
          kickoffTime: '2026-01-01T12:00:00Z',
          actualOutcome: 'draw'
        }
      ],
      validation: [],
      test: [
        {
          matchId: 'test-unknown',
          split: 'test',
          competitionId: 'comp-away',
          homeTeamId: 'home-2',
          awayTeamId: 'away-2',
          kickoffTime: '2026-01-02T12:00:00Z',
          actualOutcome: 'away'
        }
      ],
      skippedRecordCount: 0
    };

    expect(() => predictWithMultinomialLogisticCandidate(dataset)).toThrow(
      'Fixture test-unknown uses unknown competition comp-away.'
    );
  });
});
