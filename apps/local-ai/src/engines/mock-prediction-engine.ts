/**
 * mock-prediction-engine.ts
 * Scaffolds the mock prediction engine that runs the input candidate validator
 * and maps properties into a traceable prediction envelope.
 */

import type { PredictionEnvelope } from '../contracts/mock-prediction-contracts.js';
import { validateInputCandidate } from '../input/input-candidate-validator.js';
import { buildPredictionEnvelope } from '../output/prediction-envelope-builder.js';

export function runMockPrediction(inputCandidate: unknown): PredictionEnvelope {
  // 1. Run schema validation
  const validation = validateInputCandidate(inputCandidate);
  if (!validation.valid) {
    throw new Error(`Invalid input candidate: ${validation.errors.join(', ')}`);
  }

  const candidate = validation.candidate!;

  // 2. Prepare warnings list
  const warnings: string[] = [
    'Mock engine only. No prediction algorithm has been approved.',
    ...validation.warnings
  ];

  // 3. Construct traceable prediction envelope matching the ADR-0018 contract
  return buildPredictionEnvelope({
    matchId: candidate.matchId,
    competitionId: candidate.competitionId,
    seasonId: candidate.seasonId,
    engineMode: 'mock',
    predictionAvailable: false,
    confidenceLabel: 'not_available',
    outputSummary: 'No owner-approved prediction algorithm is active.',
    traceInput: {
      inputCandidateId: candidate.inputCandidateId,
      workerRunId: candidate.trace.workerRunId,
      sourceProviderId: candidate.sourceProviderId
    },
    warnings
  });
}
