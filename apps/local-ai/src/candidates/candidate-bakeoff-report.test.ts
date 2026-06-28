import { describe, expect, it } from 'vitest';
import type { CandidateEvaluationResult } from './candidate-types.js';
import {
  buildCandidateBakeoffReport,
  generateCandidateBakeoffMarkdown
} from './candidate-bakeoff-report.js';

const candidateResults: CandidateEvaluationResult[] = [
  {
    candidateId: 'candidate-worse',
    candidateFamily: 'elo_rating',
    trainedOnSplitNames: ['train'],
    evaluatedOnSplitName: 'test',
    evaluatedSampleCount: 107,
    metrics: {
      brierScore: 0.654,
      logLoss: 1.2,
      classAccuracy: 0.44,
      expectedCalibrationError: {
        ece: 0.12,
        sampleCount: 107,
        binCount: 10,
        bins: []
      }
    }
  },
  {
    candidateId: 'candidate-better',
    candidateFamily: 'multinomial_logistic_regression',
    trainedOnSplitNames: ['train'],
    evaluatedOnSplitName: 'test',
    evaluatedSampleCount: 107,
    metrics: {
      brierScore: 0.632,
      logLoss: 1.0,
      classAccuracy: 0.55,
      expectedCalibrationError: {
        ece: 0.08,
        sampleCount: 107,
        binCount: 10,
        bins: []
      }
    }
  }
];

describe('buildCandidateBakeoffReport', () => {
  it('ranks candidates without selecting a model and emits Phase 8.4 warnings', () => {
    const report = buildCandidateBakeoffReport({
      datasetId: 'dataset-national-team-aggregate-comp-int-world-cup__comp-int-euro',
      competitionIds: ['comp-int-world-cup', 'comp-int-euro'],
      featureSpecVersion: 'feature-spec-v0.1.0',
      sampleCount: 107,
      baselineLogLoss: 1.066,
      baselineBrierScore: 0.644,
      bookmakerBaselineAvailable: false,
      candidateResults
    });

    expect(report.status).toBe('pass');
    expect(report.rankedCandidateIds).toEqual(['candidate-better', 'candidate-worse']);
    expect(report.selectedCandidateId).toBeNull();
    expect(report.selectionAuthority).toBe('blocked_until_phase_8_6_model_selection_adr');
    expect(report.warnings).toEqual(
      expect.arrayContaining([
        'Bookmaker baseline is unavailable for the current dataset; candidate results cannot be judged against market-implied probabilities.',
        'Test sample count is 107; treat Phase 8.4 as high-variance R&D evidence, not model-selection evidence.'
      ])
    );
  });

  it('generates markdown that states no model, runtime route, or betting recommendation is authorized', () => {
    const report = buildCandidateBakeoffReport({
      datasetId: 'dataset-national-team-aggregate-comp-int-world-cup__comp-int-euro',
      competitionIds: ['comp-int-world-cup', 'comp-int-euro'],
      featureSpecVersion: 'feature-spec-v0.1.0',
      sampleCount: 107,
      baselineLogLoss: 1.066,
      baselineBrierScore: 0.644,
      bookmakerBaselineAvailable: false,
      candidateResults
    });

    const markdown = generateCandidateBakeoffMarkdown(report);

    expect(markdown).toContain('No model is selected in Phase 8.4.');
    expect(markdown).toContain('No runtime prediction route.');
    expect(markdown).toContain('No betting recommendation.');
  });
});
