/**
 * input-candidate-validator.ts
 * Validates inputCandidate snapshots to ensure all required fields are present.
 * This module is strictly schema-mediating and does not calculate features,
 * score teams, generate probabilities, or produce betting signals.
 */

import type { InputCandidate, InputCandidateValidation } from '../contracts/mock-prediction-contracts.js';
import { isRecord, readString, readStringArray } from '../contracts/mock-prediction-contracts.js';

export function validateInputCandidate(candidate: unknown): InputCandidateValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isRecord(candidate)) {
    return {
      valid: false,
      errors: ['Input candidate must be a non-null object.'],
      warnings
    };
  }

  const traceValue = candidate.trace;
  const trace = isRecord(traceValue) ? traceValue : null;

  const requiredFields = [
    'inputCandidateId',
    'matchId',
    'competitionId',
    'seasonId',
    'sourceProviderId',
    'ingestedAt',
    'freshnessStatus',
    'validationStatus'
  ];

  for (const field of requiredFields) {
    if (!readString(candidate, field)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (!trace) {
    errors.push('Missing required field: trace');
  } else if (!readString(trace, 'workerRunId')) {
    errors.push('Missing required trace field: workerRunId');
  }

  if (readString(candidate, 'validationStatus') === 'failed') {
    warnings.push('Input candidate had failed validationStatus at ingestion.');
  }

  const dataQualityIssues = readStringArray(candidate, 'dataQualityIssues');
  if (dataQualityIssues) {
    for (const issue of dataQualityIssues) {
      warnings.push(`Ingestion Quality Warning: ${issue}`);
    }
  }

  if (errors.length > 0 || !trace) {
    return { valid: false, errors, warnings };
  }

  const candidateResult: InputCandidate = {
    inputCandidateId: readString(candidate, 'inputCandidateId')!,
    matchId: readString(candidate, 'matchId')!,
    competitionId: readString(candidate, 'competitionId')!,
    seasonId: readString(candidate, 'seasonId')!,
    sourceProviderId: readString(candidate, 'sourceProviderId')!,
    ingestedAt: readString(candidate, 'ingestedAt')!,
    freshnessStatus: readString(candidate, 'freshnessStatus')!,
    validationStatus: readString(candidate, 'validationStatus') as 'passed' | 'warning' | 'failed',
    trace: {
      workerRunId: readString(trace, 'workerRunId')!,
      ...(readString(trace, 'adapterVersion') ? { adapterVersion: readString(trace, 'adapterVersion') as string } : {})
    },
    ...(readStringArray(candidate, 'availableMarkets') ? { availableMarkets: readStringArray(candidate, 'availableMarkets') as string[] } : {}),
    ...(dataQualityIssues ? { dataQualityIssues: dataQualityIssues as string[] } : {})
  };

  return {
    valid: true,
    errors,
    warnings,
    candidate: candidateResult
  };
}
