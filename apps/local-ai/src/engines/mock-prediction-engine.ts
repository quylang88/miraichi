/**
 * mock-prediction-engine.js
 * Scaffolds the mock prediction engine that runs the input candidate validator
 * and maps properties into a traceable prediction envelope.
 */

import { validateInputCandidate } from '../input/input-candidate-validator.js';
import { buildPredictionEnvelope } from '../output/prediction-envelope-builder.js';

export function runMockPrediction(inputCandidate) {
  // 1. Run schema validation
  const validation = validateInputCandidate(inputCandidate);
  if (!validation.valid) {
    throw new Error(`Invalid input candidate: ${validation.errors.join(', ')}`);
  }

  // 2. Prepare warnings list
  const warnings = [
    'Mock engine only. No prediction algorithm has been approved.',
    ...validation.warnings
  ];

  // 3. Construct traceable prediction envelope matching the ADR-0018 contract
  return buildPredictionEnvelope({
    matchId: inputCandidate.matchId,
    competitionId: inputCandidate.competitionId,
    seasonId: inputCandidate.seasonId,
    engineMode: 'mock',
    predictionAvailable: false,
    confidenceLabel: 'not_available',
    outputSummary: 'No owner-approved prediction algorithm is active.',
    traceInput: {
      inputCandidateId: inputCandidate.inputCandidateId,
      workerRunId: inputCandidate.trace ? inputCandidate.trace.workerRunId : 'unknown-run',
      sourceProviderId: inputCandidate.sourceProviderId
    },
    warnings
  });
}
