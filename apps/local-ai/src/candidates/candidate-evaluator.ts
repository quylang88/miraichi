import {
  brierScore,
  classAccuracy,
  expectedCalibrationError,
  logLoss,
  type EvaluationSample
} from '../evaluation/evaluation-metrics.js';
import type { CandidateEvaluationResult, CandidatePredictionBatch } from './candidate-types.js';

export type CandidateEvaluatorOptions = {
  eceBinCount?: number;
};

export function evaluateCandidateBatch(
  batch: CandidatePredictionBatch,
  options: CandidateEvaluatorOptions = {}
): CandidateEvaluationResult {
  if (batch.predictions.length === 0) {
    throw new Error(`Candidate ${batch.candidateId} produced no test predictions.`);
  }

  const samples: EvaluationSample[] = batch.predictions.map((prediction) => ({
    actualOutcome: prediction.actualOutcome,
    probabilities: prediction.probabilities
  }));

  return {
    candidateId: batch.candidateId,
    candidateFamily: batch.candidateFamily,
    trainedOnSplitNames: batch.trainedOnSplitNames,
    evaluatedOnSplitName: batch.evaluatedOnSplitName,
    evaluatedSampleCount: samples.length,
    metrics: {
      brierScore: brierScore(samples),
      logLoss: logLoss(samples),
      classAccuracy: classAccuracy(samples),
      expectedCalibrationError: expectedCalibrationError(samples, options.eceBinCount ?? 10)
    }
  };
}
