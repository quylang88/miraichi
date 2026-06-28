import { describe, expect, it } from 'vitest';
import type { EvaluationDataset } from './evaluation-dataset.js';
import { buildEvaluationReport, generateReportMarkdown } from './evaluation-report.js';

const dataset: EvaluationDataset = {
  metadata: {
    datasetId: 'dataset-comp-int-world-cup-2026-06-28',
    competitionId: 'comp-int-world-cup',
    schemaVersion: '1.0.0',
    featureSpecVersion: 'feature-spec-v0.1.0',
    sourceProviderId: 'soccerdata-fbref',
    sourceSnapshotHash: 'hash',
    builtAt: '2026-06-28T00:00:00Z',
    trainCount: 3,
    valCount: 1,
    testCount: 2
  },
  competitionId: 'comp-int-world-cup',
  train: [
    {
      matchId: 'match-train-1',
      split: 'train',
      competitionId: 'comp-int-world-cup',
      kickoffTime: '2014-06-16T13:00:00Z',
      actualOutcome: 'home'
    },
    {
      matchId: 'match-train-2',
      split: 'train',
      competitionId: 'comp-int-world-cup',
      kickoffTime: '2014-06-17T13:00:00Z',
      actualOutcome: 'home'
    },
    {
      matchId: 'match-train-3',
      split: 'train',
      competitionId: 'comp-int-world-cup',
      kickoffTime: '2018-07-15T18:00:00Z',
      actualOutcome: 'draw'
    }
  ],
  validation: [
    {
      matchId: 'match-val',
      split: 'validation',
      competitionId: 'comp-int-world-cup',
      kickoffTime: '2018-07-15T18:00:00Z',
      actualOutcome: 'home'
    }
  ],
  test: [
    {
      matchId: 'match-test-1',
      split: 'test',
      competitionId: 'comp-int-world-cup',
      kickoffTime: '2022-11-26T22:00:00Z',
      actualOutcome: 'home',
      marketProbabilities: { home: 0.6, draw: 0.3, away: 0.1 }
    },
    {
      matchId: 'match-test-2',
      split: 'test',
      competitionId: 'comp-int-world-cup',
      kickoffTime: '2022-11-27T22:00:00Z',
      actualOutcome: 'draw',
      marketProbabilities: { home: 0.2, draw: 0.5, away: 0.3 }
    }
  ],
  skippedRecordCount: 0
};

describe('Phase 8.3 evaluation report', () => {
  it('evaluates simple baselines, including bookmaker, and computes exact metric values', () => {
    const report = buildEvaluationReport(dataset, { eceBinCount: 5 });

    expect(report.phase).toBe('8.3');
    expect(report.status).toBe('pass');
    expect(report.datasetId).toBe(dataset.metadata.datasetId);
    expect(report.evaluationSplit).toBe('test');
    expect(report.sampleCount).toBe(2);
    expect(report.missingBookmakerBaselineCount).toBe(0);

    // Uniform 1X2 Baseline
    const uniform = report.baselines.find((b) => b.id === 'uniform_1x2')!;
    expect(uniform).toBeDefined();
    expect(uniform.metrics.brierScore).toBeCloseTo(2 / 3, 10);
    expect(uniform.metrics.logLoss).toBeCloseTo(Math.log(3), 10);
    expect(uniform.metrics.classAccuracy).toBe(0.5);
    expect(uniform.metrics.expectedCalibrationError.ece).toBeCloseTo(1 / 6, 10);

    // Smoothed train-frequency baseline
    const frequency = report.baselines.find((b) => b.id === 'train_outcome_frequency_smoothed')!;
    expect(frequency).toBeDefined();
    expect(frequency.metrics.brierScore).toBeCloseTo(5 / 9, 10);
    expect(frequency.metrics.logLoss).toBeCloseTo(Math.log(6) / 2, 10);
    expect(frequency.metrics.classAccuracy).toBe(0.5);
    expect(frequency.metrics.expectedCalibrationError.ece).toBeCloseTo(0, 10);

    // Bookmaker pre-match baseline
    const bookmaker = report.baselines.find((b) => b.id === 'bookmaker_implied_pre_match')!;
    expect(bookmaker).toBeDefined();
    expect(bookmaker.metrics.brierScore).toBeCloseTo(0.32, 10);
    expect(bookmaker.metrics.logLoss).toBeCloseTo((-Math.log(0.6) - Math.log(0.5)) / 2, 10);
    expect(bookmaker.metrics.classAccuracy).toBe(1.0);
    expect(bookmaker.metrics.expectedCalibrationError.ece).toBeCloseTo(0.45, 10);

    expect(report.warnings).toEqual(
      expect.arrayContaining([
        'Evaluation sample count is below 100 fixtures; this is harness/plumbing evidence only, not reliable calibration evidence.',
        'World Cup-only evaluation must not be treated as statistically strong until related national-team competitions are added.'
      ])
    );
    expect(report.nonBlockingGates.sampleCountAtLeast100).toBe(false);
    expect(report.nonBlockingGates.bookmakerBaselineAvailable).toBe(true);
    expect(report.ownerDecisions.metricsImplementation).toBe('pure_typescript_no_external_metrics_library');
  });

  it('omits the World Cup-specific warning when competitionId is not comp-int-world-cup', () => {
    const nonWcDataset = {
      ...dataset,
      competitionId: 'comp-euro-cup',
      metadata: {
        ...dataset.metadata,
        competitionId: 'comp-euro-cup'
      }
    };
    const report = buildEvaluationReport(nonWcDataset, { eceBinCount: 5 });

    expect(report.warnings).toContain(
      'Evaluation sample count is below 100 fixtures; this is harness/plumbing evidence only, not reliable calibration evidence.'
    );
    expect(report.warnings).not.toContain(
      'World Cup-only evaluation must not be treated as statistically strong until related national-team competitions are added.'
    );
  });

  it('omits the low sample warning and sets nonBlockingGates.sampleCountAtLeast100 to true when test count >= 100', () => {
    const largeTestFixtures = Array.from({ length: 100 }, (_, i) => ({
      matchId: `match-test-${i}`,
      split: 'test' as const,
      competitionId: 'comp-int-world-cup',
      kickoffTime: '2022-11-26T22:00:00Z',
      actualOutcome: 'home' as const,
      marketProbabilities: { home: 0.6, draw: 0.3, away: 0.1 }
    }));

    const largeDataset = {
      ...dataset,
      test: largeTestFixtures
    };

    const report = buildEvaluationReport(largeDataset, { eceBinCount: 5 });

    expect(report.sampleCount).toBe(100);
    expect(report.nonBlockingGates.sampleCountAtLeast100).toBe(true);
    expect(report.warnings).not.toContain(
      'Evaluation sample count is below 100 fixtures; this is harness/plumbing evidence only, not reliable calibration evidence.'
    );
    expect(report.warnings).toContain(
      'World Cup-only evaluation must not be treated as statistically strong until related national-team competitions are added.'
    );
  });

  it('generates report markdown that does not hardcode verify:local as PASS', () => {
    const report = buildEvaluationReport(dataset, { eceBinCount: 5 });
    const markdown = generateReportMarkdown(report);

    expect(markdown).toContain('## Verification');
    expect(markdown).toContain('- `pnpm run phase8:evaluation-harness`: PASS');
    expect(markdown).not.toContain('- `pnpm run verify:local`: PASS');
    expect(markdown).not.toContain('- `pnpm run test:integration`: PASS');
    expect(markdown).toContain('- `pnpm run verify:local`: Required external verification');
    expect(markdown).toContain('- `pnpm run test:integration`: Required external verification');
  });
});
