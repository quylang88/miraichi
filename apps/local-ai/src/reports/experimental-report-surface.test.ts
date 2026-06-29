import { describe, expect, it } from 'vitest';
import {
  buildExperimentalReportSurface,
  generateExperimentalReportSurfaceMarkdown,
  type CandidateBakeoffReportForSurface
} from './experimental-report-surface.js';

function bakeoffReport(): CandidateBakeoffReportForSurface {
  return {
    reportId: 'phase-8-4-candidate-model-bakeoff',
    phase: '8.4',
    status: 'pass',
    datasetId: 'dataset-national-team-aggregate-comp-int-world-cup__comp-int-euro',
    competitionIds: ['comp-int-world-cup', 'comp-int-euro'],
    featureSpecVersion: 'feature-spec-v0.1.0',
    sampleCount: 107,
    bookmakerBaselineAvailable: false,
    rankedCandidateIds: ['elo_rating_v0', 'multinomial_logistic_competition_v0'],
    selectedCandidateId: null,
    selectionAuthority: 'blocked_until_phase_8_6_model_selection_adr',
    warnings: [
      'Test sample count is 107; treat Phase 8.4 as high-variance R&D evidence, not model-selection evidence.',
      'Bookmaker baseline is unavailable for the current dataset; candidate results cannot be judged against market-implied probabilities.'
    ],
    forbiddenScope: [
      'model_selection',
      'runtime_prediction',
      'betting_recommendation',
      'stake_sizing',
      'club_competition_expansion'
    ],
    candidateResults: [
      {
        candidateId: 'elo_rating_v0',
        candidateFamily: 'elo_rating',
        trainedOnSplitNames: ['train', 'validation'],
        evaluatedOnSplitName: 'test',
        evaluatedSampleCount: 107,
        metrics: {
          brierScore: 0.628985,
          logLoss: 1.048001,
          classAccuracy: 0.514019,
          expectedCalibrationError: {
            ece: 0.044913,
            sampleCount: 107,
            binCount: 10,
            bins: []
          }
        }
      }
    ]
  };
}

describe('Phase 8.5 experimental report surface', () => {
  it('builds an owner-only experimental surface without selecting a model', () => {
    const surface = buildExperimentalReportSurface(bakeoffReport());

    expect(surface.reportId).toBe('phase-8-5-owner-only-experimental-report-surface');
    expect(surface.phase).toBe('8.5');
    expect(surface.audience).toBe('owner_only');
    expect(surface.experimentLabel).toBe('experimental_not_production_ready');
    expect(surface.selectedCandidateId).toBeNull();
    expect(surface.nextAllowedPhase).toBe('phase:plan Phase 8.6 Model Selection ADR');
    expect(surface.candidateEvidence).toHaveLength(1);
    expect(surface.candidateEvidence[0]?.candidateId).toBe('elo_rating_v0');
    expect(surface.nonAuthorizations).toContain('No public prediction surface.');
    expect(surface.nonAuthorizations).toContain('No betting recommendation.');
    expect(surface.knownWeaknesses).toContain('Test sample count is 107; treat Phase 8.4 as high-variance R&D evidence, not model-selection evidence.');
  });

  it('generates Markdown that cannot be confused with production or betting advice', () => {
    const markdown = generateExperimentalReportSurfaceMarkdown(
      buildExperimentalReportSurface(bakeoffReport())
    );

    expect(markdown).toContain('Owner-Only Experimental Report Surface');
    expect(markdown).toContain('Experimental, not production ready.');
    expect(markdown).toContain('No public prediction surface.');
    expect(markdown).toContain('No `engineMode: production`.');
    expect(markdown).toContain('No betting recommendation.');
    expect(markdown).toContain('No stake sizing, Kelly, bankroll, ROI, or CLV.');
    expect(markdown).toContain('No club competition expansion.');
    expect(markdown).not.toMatch(/best bet|recommended pick|recommended bet/i);
  });

  it('rejects a bake-off report that already selected a model', () => {
    const report = {
      ...bakeoffReport(),
      selectedCandidateId: 'elo_rating_v0'
    } as unknown as CandidateBakeoffReportForSurface;

    expect(() => buildExperimentalReportSurface(report)).toThrow(
      'Phase 8.5 cannot surface a selected model before Phase 8.6 Model Selection ADR.'
    );
  });
});
