/**
 * mock-prediction-contracts.ts
 * Typed input candidate, prediction envelope, explanation, validation, and guard helpers.
 * Fully competition-agnostic. No business logic, prediction algorithms, or betting formulas.
 */

export type InputCandidateTrace = {
  workerRunId: string;
  adapterVersion?: string;
};

export type InputCandidate = {
  inputCandidateId: string;
  matchId: string;
  competitionId: string;
  seasonId: string;
  sourceProviderId: string;
  ingestedAt: string;
  freshnessStatus: string;
  validationStatus: 'passed' | 'warning' | 'failed';
  availableMarkets?: string[];
  dataQualityIssues?: string[];
  trace: InputCandidateTrace;
};

export type InputCandidateValidation = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  candidate?: InputCandidate;
};

export type PredictionEnvelopeTrace = {
  inputCandidateId: string;
  workerRunId: string;
  sourceProviderId: string;
  engineVersion: string;
};

export type PredictionEnvelope = {
  predictionId: string;
  matchId: string;
  competitionId: string;
  seasonId: string;
  generatedAt: string;
  engineMode: 'mock';
  predictionAvailable: false;
  confidenceLabel: 'not_available';
  outputSummary: string;
  trace: PredictionEnvelopeTrace;
  warnings: string[];
};

export type PredictionEnvelopeBuildInput = {
  matchId: string;
  competitionId: string;
  seasonId: string;
  engineMode?: 'mock';
  predictionAvailable?: false;
  confidenceLabel?: 'not_available';
  outputSummary?: string;
  traceInput?: Partial<PredictionEnvelopeTrace>;
  warnings?: string[];
};

export type MockExplanationRefusal = {
  explanationAvailable: false;
  reason: string;
  references: {
    predictionId?: string;
    traceId?: string;
  };
  text?: string;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

export function readStringArray(record: Record<string, unknown>, key: string): string[] | undefined {
  const value = record[key];
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
    ? value
    : undefined;
}
