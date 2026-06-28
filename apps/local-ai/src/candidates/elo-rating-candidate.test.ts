import { describe, expect, it } from 'vitest';
import { predictWithEloRatingCandidate, type EloCandidateInput } from './elo-rating-candidate.js';

describe('Phase 8.4 Elo rating candidate', () => {
  it('lets validation move team strength beyond what train alone learns', () => {
    const testFixture = {
      matchId: 'test-1',
      split: 'test',
      competitionId: 'comp-test-national-team',
      homeTeamId: 'team-a',
      awayTeamId: 'team-b',
      kickoffTime: '2026-01-04T12:00:00Z',
      actualOutcome: 'away'
    } satisfies EloCandidateInput['test'][number];

    const trainOnlyInput: EloCandidateInput = {
      train: [
        {
          matchId: 'train-1',
          split: 'train',
          competitionId: 'comp-test-national-team',
          homeTeamId: 'team-a',
          awayTeamId: 'team-c',
          kickoffTime: '2026-01-01T12:00:00Z',
          actualOutcome: 'away'
        },
        {
          matchId: 'train-2',
          split: 'train',
          competitionId: 'comp-test-national-team',
          homeTeamId: 'team-b',
          awayTeamId: 'team-c',
          kickoffTime: '2026-01-02T12:00:00Z',
          actualOutcome: 'away'
        }
      ],
      validation: [],
      test: [testFixture]
    };

    const validationBoostedInput: EloCandidateInput = {
      train: trainOnlyInput.train,
      validation: [
        {
          matchId: 'validation-1',
          split: 'validation',
          competitionId: 'comp-test-national-team',
          homeTeamId: 'team-a',
          awayTeamId: 'team-b',
          kickoffTime: '2026-01-03T12:00:00Z',
          actualOutcome: 'home'
        }
      ],
      test: [testFixture]
    };

    const trainOnlyBatch = predictWithEloRatingCandidate(trainOnlyInput);
    const validationBoostedBatch = predictWithEloRatingCandidate(validationBoostedInput);

    expect(trainOnlyBatch.candidateId).toBe('elo_rating_v0');
    expect(trainOnlyBatch.evaluatedOnSplitName).toBe('test');
    expect(trainOnlyBatch.predictions).toHaveLength(1);
    expect(trainOnlyBatch.predictions[0]?.probabilities.home).toBeLessThanOrEqual(
      trainOnlyBatch.predictions[0]?.probabilities.away ?? 1
    );

    expect(validationBoostedBatch.trainedOnSplitNames).toEqual(['train', 'validation']);
    expect(validationBoostedBatch.predictions).toHaveLength(1);
    expect(validationBoostedBatch.predictions[0]?.probabilities.home).toBeGreaterThan(
      validationBoostedBatch.predictions[0]?.probabilities.away ?? 0
    );
    expect(validationBoostedBatch.predictions[0]?.probabilities.draw).toBeGreaterThan(0);
  });

  it('does not let the test actual outcome leak into the learned ratings', () => {
    const baseTraining: EloCandidateInput = {
      train: [
        {
          matchId: 'train-1',
          split: 'train',
          competitionId: 'comp-test-national-team',
          homeTeamId: 'team-a',
          awayTeamId: 'team-c',
          kickoffTime: '2026-01-01T12:00:00Z',
          actualOutcome: 'away'
        },
        {
          matchId: 'train-2',
          split: 'train',
          competitionId: 'comp-test-national-team',
          homeTeamId: 'team-b',
          awayTeamId: 'team-c',
          kickoffTime: '2026-01-02T12:00:00Z',
          actualOutcome: 'away'
        }
      ],
      validation: [
        {
          matchId: 'validation-1',
          split: 'validation',
          competitionId: 'comp-test-national-team',
          homeTeamId: 'team-a',
          awayTeamId: 'team-b',
          kickoffTime: '2026-01-03T12:00:00Z',
          actualOutcome: 'home'
        }
      ],
      test: [
        {
          matchId: 'test-1',
          split: 'test',
          competitionId: 'comp-test-national-team',
          homeTeamId: 'team-a',
          awayTeamId: 'team-b',
          kickoffTime: '2026-01-04T12:00:00Z',
          actualOutcome: 'away'
        }
      ]
    };

    const flippedOutcomeInput: EloCandidateInput = {
      train: baseTraining.train,
      validation: baseTraining.validation,
      test: [
        {
          matchId: 'test-1',
          split: 'test',
          competitionId: 'comp-test-national-team',
          homeTeamId: 'team-a',
          awayTeamId: 'team-b',
          kickoffTime: '2026-01-04T12:00:00Z',
          actualOutcome: 'home'
        }
      ]
    };

    const awayOutcomeBatch = predictWithEloRatingCandidate(baseTraining);
    const homeOutcomeBatch = predictWithEloRatingCandidate(flippedOutcomeInput);

    expect(awayOutcomeBatch.predictions).toHaveLength(1);
    expect(homeOutcomeBatch.predictions).toHaveLength(1);
    expect(awayOutcomeBatch.predictions[0]?.probabilities).toEqual(
      homeOutcomeBatch.predictions[0]?.probabilities
    );
    expect(awayOutcomeBatch.predictions[0]?.probabilities.home).toBeGreaterThan(
      awayOutcomeBatch.predictions[0]?.probabilities.away ?? 0
    );
  });
});
