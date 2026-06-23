/**
 * input-candidate-validator.js
 * Validates inputCandidate snapshots to ensure all required fields are present.
 * This module is strictly schema-mediating and does not calculate features,
 * score teams, generate probabilities, or produce betting signals.
 */

export function validateInputCandidate(candidate) {
  const errors = [];
  const warnings = [];

  if (!candidate || typeof candidate !== 'object') {
    return {
      valid: false,
      errors: ['Input candidate must be a non-null object.'],
      warnings
    };
  }

  const requiredFields = [
    'inputCandidateId',
    'matchId',
    'competitionId',
    'seasonId',
    'sourceProviderId',
    'ingestedAt',
    'freshnessStatus',
    'validationStatus',
    'trace'
  ];

  for (const field of requiredFields) {
    if (candidate[field] === undefined || candidate[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (candidate.trace && typeof candidate.trace === 'object') {
    if (!candidate.trace.workerRunId) {
      errors.push('Missing required trace field: workerRunId');
    }
  } else if (candidate.trace !== undefined && candidate.trace !== null) {
    errors.push('Field "trace" must be an object.');
  }

  if (candidate.validationStatus === 'failed') {
    warnings.push('Input candidate had failed validationStatus at ingestion.');
  }

  if (Array.isArray(candidate.dataQualityIssues)) {
    for (const issue of candidate.dataQualityIssues) {
      warnings.push(`Ingestion Quality Warning: ${issue}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
