import type { EvaluationSplitName } from '../evaluation/evaluation-dataset.js';
import type {
  ExpectedCalibrationErrorResult,
  OutcomeClass,
  OutcomeProbabilities
} from '../evaluation/evaluation-metrics.js';

export type CandidateFamily =
  | 'elo_rating'
  | 'multinomial_logistic_regression';

export type CandidatePrediction = {
  matchId: string;
  actualOutcome: OutcomeClass;
  probabilities: OutcomeProbabilities;
};

export type CandidatePredictionBatch = {
  candidateId: string;
  candidateFamily: CandidateFamily;
  trainedOnSplitNames: EvaluationSplitName[];
  evaluatedOnSplitName: EvaluationSplitName;
  predictions: CandidatePrediction[];
};

export type CandidateEvaluationResult = {
  candidateId: string;
  candidateFamily: CandidateFamily;
  trainedOnSplitNames: EvaluationSplitName[];
  evaluatedOnSplitName: EvaluationSplitName;
  evaluatedSampleCount: number;
  metrics: {
    brierScore: number;
    logLoss: number;
    classAccuracy: number;
    expectedCalibrationError: ExpectedCalibrationErrorResult;
  };
};
