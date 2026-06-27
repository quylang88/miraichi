/**
 * mock-input-candidate.js
 * Exports a generic, competition-agnostic mock input candidate payload.
 * Strictly adheres to project guardrails: no real team names, real leagues,
 * prediction labels, or wagers.
 */

export const mockInputCandidate = {
  inputCandidateId: 'input-candidate-alpha-001',
  matchId: 'match-alpha-001',
  competitionId: 'competition-alpha',
  seasonId: 'season-alpha-2026',
  sourceProviderId: 'provider-mock-alpha',
  ingestedAt: '2026-06-23T23:00:00Z',
  freshnessStatus: 'fresh',
  validationStatus: 'passed',
  availableMarkets: ['1X2'],
  dataQualityIssues: [],
  trace: {
    workerRunId: 'run-alpha-001',
    adapterVersion: '1.0.0-mock'
  }
};
