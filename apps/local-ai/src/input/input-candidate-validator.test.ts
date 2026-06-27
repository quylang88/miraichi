import { describe, expect, it } from 'vitest';
import { validateInputCandidate } from './input-candidate-validator.js';

const validCandidate = {
  inputCandidateId: 'input-candidate-alpha-001',
  matchId: 'match-alpha-001',
  competitionId: 'competition-alpha',
  seasonId: 'season-alpha-2026',
  sourceProviderId: 'provider-mock-alpha',
  ingestedAt: '2026-06-23T12:00:00Z',
  freshnessStatus: 'fresh',
  validationStatus: 'passed',
  trace: {
    workerRunId: 'run-alpha-001'
  }
};

describe('input candidate validator', () => {
  it('accepts a complete traceable input candidate', () => {
    expect(validateInputCandidate(validCandidate)).toEqual({
      valid: true,
      errors: [],
      warnings: []
    });
  });

  it('rejects missing required fields and trace metadata', () => {
    const result = validateInputCandidate({
      ...validCandidate,
      matchId: undefined,
      trace: {}
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required field: matchId');
    expect(result.errors).toContain('Missing required trace field: workerRunId');
  });
});
