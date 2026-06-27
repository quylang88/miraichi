/**
 * prediction-envelope-builder.ts
 * Centralizes construction of prediction output envelopes.
 * Defaults to safe mock values and does not calculate probabilities,
 * outcome labels, or betting wagers.
 */

import crypto from 'crypto';

export function buildPredictionEnvelope({
  matchId,
  competitionId,
  seasonId,
  engineMode = 'mock',
  predictionAvailable = false,
  confidenceLabel = 'not_available',
  outputSummary = 'No owner-approved prediction algorithm is active.',
  traceInput = {},
  warnings = []
}: Record<string, any>) {
  const predictionId = `pred-${crypto.randomUUID()}`;
  const generatedAt = new Date().toISOString();

  // Standardize trace block format
  const trace = {
    inputCandidateId: traceInput.inputCandidateId || 'unknown-candidate',
    workerRunId: traceInput.workerRunId || 'unknown-run',
    sourceProviderId: traceInput.sourceProviderId || 'unknown-provider',
    engineVersion: '1.0.0-mock' // Statically declared mock version
  };

  return {
    predictionId,
    matchId: matchId || 'unknown-match',
    competitionId: competitionId || 'unknown-competition',
    seasonId: seasonId || 'unknown-season',
    generatedAt,
    engineMode,
    predictionAvailable,
    confidenceLabel,
    outputSummary,
    trace,
    warnings
  };
}
