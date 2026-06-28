import {
  bookmakerBaselineForFixture,
  smoothedOutcomeFrequencyBaseline,
  uniformBaseline,
  type BaselinePrediction
} from './evaluation-baselines.js';
import type { EvaluationDataset, EvaluationFixture } from './evaluation-dataset.js';
import {
  brierScore,
  classAccuracy,
  expectedCalibrationError,
  logLoss,
  type EvaluationSample,
  type ExpectedCalibrationErrorResult
} from './evaluation-metrics.js';

export type EvaluatedBaseline = {
  id: BaselinePrediction['id'];
  evaluatedSampleCount: number;
  metrics: {
    brierScore: number;
    logLoss: number;
    classAccuracy: number;
    expectedCalibrationError: ExpectedCalibrationErrorResult;
  };
};

export type EvaluationReport = {
  reportId: string;
  phase: '8.3';
  status: 'pass' | 'fail';
  datasetId: string;
  competitionId: string;
  featureSpecVersion: string;
  evaluationSplit: 'test';
  sampleCount: number;
  trainSampleCount: number;
  validationSampleCount: number;
  skippedRecordCount: number;
  missingBookmakerBaselineCount: number;
  baselines: EvaluatedBaseline[];
  warnings: string[];
  nonBlockingGates: {
    sampleCountAtLeast100: boolean;
    bookmakerBaselineAvailable: boolean;
  };
  ownerDecisions: {
    harnessBlocksOnAdditionalCompetitions: false;
    nationalTeamExpansionRequiredBeforeCandidateBakeOff: true;
    metricsImplementation: 'pure_typescript_no_external_metrics_library';
  };
};

export type EvaluationReportOptions = {
  eceBinCount?: number;
};

function samplesForConstantBaseline(
  fixtures: readonly EvaluationFixture[],
  baseline: BaselinePrediction
): EvaluationSample[] {
  return fixtures.map((fixture) => ({
    actualOutcome: fixture.actualOutcome,
    probabilities: baseline.probabilities
  }));
}

function evaluateBaseline(
  fixtures: readonly EvaluationFixture[],
  baseline: BaselinePrediction,
  eceBinCount: number
): EvaluatedBaseline {
  const samples = samplesForConstantBaseline(fixtures, baseline);

  return {
    id: baseline.id,
    evaluatedSampleCount: samples.length,
    metrics: {
      brierScore: brierScore(samples),
      logLoss: logLoss(samples),
      classAccuracy: classAccuracy(samples),
      expectedCalibrationError: expectedCalibrationError(samples, eceBinCount)
    }
  };
}

function evaluateBookmakerBaseline(
  fixtures: readonly EvaluationFixture[],
  eceBinCount: number
): { baseline: EvaluatedBaseline | null; missingCount: number } {
  const samples: EvaluationSample[] = [];
  let missingCount = 0;

  for (const fixture of fixtures) {
    const baseline = bookmakerBaselineForFixture(fixture);
    if (!baseline) {
      missingCount += 1;
      continue;
    }

    samples.push({
      actualOutcome: fixture.actualOutcome,
      probabilities: baseline.probabilities
    });
  }

  if (samples.length === 0) {
    return { baseline: null, missingCount };
  }

  return {
    baseline: {
      id: 'bookmaker_implied_pre_match',
      evaluatedSampleCount: samples.length,
      metrics: {
        brierScore: brierScore(samples),
        logLoss: logLoss(samples),
        classAccuracy: classAccuracy(samples),
        expectedCalibrationError: expectedCalibrationError(samples, eceBinCount)
      }
    },
    missingCount
  };
}

export function buildEvaluationReport(
  dataset: EvaluationDataset,
  options: EvaluationReportOptions = {}
): EvaluationReport {
  const eceBinCount = options.eceBinCount ?? 10;
  const evaluationFixtures = dataset.test;
  const warnings: string[] = [];

  if (evaluationFixtures.length === 0) {
    throw new Error('Phase 8.3 evaluation requires at least one scored test fixture.');
  }

  if (evaluationFixtures.length < 100) {
    warnings.push(
      'Evaluation sample count is below 100 fixtures; this is harness/plumbing evidence only, not reliable calibration evidence.'
    );
  }

  if (dataset.competitionId === 'comp-int-world-cup') {
    warnings.push(
      'World Cup-only evaluation must not be treated as statistically strong until related national-team competitions are added.'
    );
  }

  const uniform = evaluateBaseline(evaluationFixtures, uniformBaseline(), eceBinCount);
  const frequency = evaluateBaseline(
    evaluationFixtures,
    smoothedOutcomeFrequencyBaseline(dataset.train),
    eceBinCount
  );
  const bookmaker = evaluateBookmakerBaseline(evaluationFixtures, eceBinCount);
  const baselines = bookmaker.baseline
    ? [uniform, frequency, bookmaker.baseline]
    : [uniform, frequency];

  return {
    reportId: `phase-8-3-evaluation-harness-${dataset.competitionId}`,
    phase: '8.3',
    status: 'pass',
    datasetId: dataset.metadata.datasetId,
    competitionId: dataset.competitionId,
    featureSpecVersion: dataset.metadata.featureSpecVersion,
    evaluationSplit: 'test',
    sampleCount: evaluationFixtures.length,
    trainSampleCount: dataset.train.length,
    validationSampleCount: dataset.validation.length,
    skippedRecordCount: dataset.skippedRecordCount,
    missingBookmakerBaselineCount: bookmaker.missingCount,
    baselines,
    warnings,
    nonBlockingGates: {
      sampleCountAtLeast100: evaluationFixtures.length >= 100,
      bookmakerBaselineAvailable: bookmaker.baseline !== null
    },
    ownerDecisions: {
      harnessBlocksOnAdditionalCompetitions: false,
      nationalTeamExpansionRequiredBeforeCandidateBakeOff: true,
      metricsImplementation: 'pure_typescript_no_external_metrics_library'
    }
  };
}
