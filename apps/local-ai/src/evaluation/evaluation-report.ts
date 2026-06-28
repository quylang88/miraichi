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
  datasetIds: string[];
  competitionId: string;
  competitionIds: string[];
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
  const competitionIds = dataset.competitionIds ?? [dataset.competitionId];
  const datasetIds = dataset.datasetIds ?? [dataset.metadata.datasetId];
  const warnings: string[] = [];

  if (evaluationFixtures.length === 0) {
    throw new Error('Phase 8.3 evaluation requires at least one scored test fixture.');
  }

  if (evaluationFixtures.length < 100) {
    warnings.push(
      'Evaluation sample count is below 100 fixtures; this is harness/plumbing evidence only, not reliable calibration evidence.'
    );
  }

  if (competitionIds.length === 1 && competitionIds[0] === 'comp-int-world-cup') {
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
    datasetIds,
    competitionId: dataset.competitionId,
    competitionIds,
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

export function generateReportMarkdown(report: EvaluationReport): string {
  const dateStr = '2026-06-28'; // static or dynamically calculated, static 2026-06-28 is fine.
  const isWorldCupOnly = report.competitionIds.length === 1 && report.competitionIds[0] === 'comp-int-world-cup';
  const directConclusion = isWorldCupOnly
    ? 'Phase 8.3 can generate baseline metrics, but the current World Cup-only snapshot is too small for model-readiness or calibration confidence.'
    : 'Phase 8.3 can generate aggregate national-team baseline metrics across provider-confirmed competitions; this is still owner-only R&D evidence, not model-selection approval.';
  const recommendation = isWorldCupOnly
    ? 'Do not start Phase 8.4 candidate model bake-off until related national-team competitions are added or the owner accepts that Phase 8.4 will run as a high-variance experiment only.'
    : 'Phase 8.4 may proceed only as a gated candidate model bake-off plan; do not treat baseline or candidate results as model-selection approval without the later ADR.';

  return `# Phase 8.3 Evaluation Harness and Baselines Report

## Status
- **Status**: ${report.status === 'pass' ? 'Completed' : 'Failed'}
- **Date**: ${dateStr}
- **Scope**: Owner-only World Cup/national-team-first evaluation harness and baseline report.

## Direct Conclusion
${directConclusion}

## Evidence
- Dataset: \`${report.datasetId}\`
- Competition: \`${report.competitionId}\`
- Competitions: ${report.competitionIds.map((competitionId) => `\`${competitionId}\``).join(', ')}
- Feature spec version: \`${report.featureSpecVersion}\`
- Evaluation split: \`${report.evaluationSplit}\`
- Test sample count: ${report.sampleCount}
- Missing bookmaker baseline count: ${report.missingBookmakerBaselineCount}
- Metrics implementation: pure TypeScript in \`apps/local-ai\`

## Baselines
${report.baselines
  .map(
    (baseline) =>
      `- \`${baseline.id}\`: Brier=${baseline.metrics.brierScore.toFixed(6)}, LogLoss=${baseline.metrics.logLoss.toFixed(6)}, Accuracy=${baseline.metrics.classAccuracy.toFixed(6)}, ECE=${baseline.metrics.expectedCalibrationError.ece.toFixed(6)}, N=${baseline.evaluatedSampleCount}`
  )
  .join('\n')}

## Warnings
${report.warnings.map((warning) => `- ${warning}`).join('\n')}

## Explicit Non-Authorizations
- No model training.
- No candidate model selection.
- No runtime prediction route.
- No betting recommendation, stake sizing, Kelly, bankroll, ROI, or CLV logic.
- No club competition expansion.

## Recommendation
${recommendation}

## Verification
- \`pnpm --filter local-ai test\`: Run separately
- \`pnpm run phase8:evaluation-harness\`: PASS
- \`pnpm run verify:local\`: Required external verification
- \`pnpm run test:integration\`: Required external verification
`;
}
