import { describe, expect, it } from 'vitest';
import { runMockPrediction } from './mock-prediction-engine.js';

const inputCandidate = {
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

describe('mock prediction engine', () => {
  it('returns a safe unavailable prediction envelope with lineage trace', () => {
    const envelope = runMockPrediction(inputCandidate);

    expect(envelope).toMatchObject({
      matchId: 'match-alpha-001',
      competitionId: 'competition-alpha',
      seasonId: 'season-alpha-2026',
      engineMode: 'mock',
      predictionAvailable: false,
      confidenceLabel: 'not_available',
      trace: {
        inputCandidateId: 'input-candidate-alpha-001',
        workerRunId: 'run-alpha-001',
        sourceProviderId: 'provider-mock-alpha'
      }
    });
    expect(envelope.predictionId).toMatch(/^pred-/);
  });

  it('rejects invalid candidates before building an envelope', () => {
    expect(() => runMockPrediction({ trace: {} })).toThrow(
      /Invalid input candidate/
    );
  });
  it('rejects non-object input candidates without using loose any payloads', () => {
    expect(() => runMockPrediction(null)).toThrow('Input candidate must be a non-null object.');
  });
});
