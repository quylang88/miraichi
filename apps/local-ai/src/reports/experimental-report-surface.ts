import type { CandidateEvaluationResult } from '../candidates/candidate-types.js';

export type CandidateBakeoffReportForSurface = {
  reportId: 'phase-8-4-candidate-model-bakeoff';
  phase: '8.4';
  status: 'pass' | 'fail';
  datasetId: string;
  competitionIds: readonly string[];
  featureSpecVersion: string;
  sampleCount: number;
  bookmakerBaselineAvailable: boolean;
  candidateResults: readonly CandidateEvaluationResult[];
  rankedCandidateIds: readonly string[];
  selectedCandidateId: string | null;
  selectionAuthority: 'blocked_until_phase_8_6_model_selection_adr';
  warnings: readonly string[];
  forbiddenScope: readonly string[];
};

export type ExperimentalCandidateEvidence = {
  candidateId: string;
  candidateFamily: string;
  rank: number | null;
  trainedOnSplitNames: readonly string[];
  evaluatedOnSplitName: string;
  evaluatedSampleCount: number;
  metrics: {
    brierScore: number;
    logLoss: number;
    classAccuracy: number;
    expectedCalibrationError: number;
    calibrationBinCount: number;
  };
};

export type ExperimentalReportSurface = {
  reportId: 'phase-8-5-owner-only-experimental-report-surface';
  phase: '8.5';
  sourceReportId: string;
  audience: 'owner_only';
  experimentLabel: 'experimental_not_production_ready';
  datasetId: string;
  competitionIds: readonly string[];
  featureSpecVersion: string;
  sampleCount: number;
  bookmakerBaselineAvailable: boolean;
  selectedCandidateId: null;
  selectionAuthority: 'blocked_until_phase_8_6_model_selection_adr';
  nextAllowedPhase: 'phase:plan Phase 8.6 Model Selection ADR';
  candidateEvidence: ExperimentalCandidateEvidence[];
  knownWeaknesses: string[];
  nonAuthorizations: string[];
};

const NON_AUTHORIZATIONS = [
  'No public prediction surface.',
  'No `engineMode: production`.',
  'No model selected.',
  'No betting recommendation.',
  'No stake sizing, Kelly, bankroll, ROI, or CLV.',
  'No club competition expansion.'
] as const;

function rankForCandidate(report: CandidateBakeoffReportForSurface, candidateId: string): number | null {
  const index = report.rankedCandidateIds.indexOf(candidateId);
  return index < 0 ? null : index + 1;
}

function evidenceForCandidate(
  report: CandidateBakeoffReportForSurface,
  candidate: CandidateEvaluationResult
): ExperimentalCandidateEvidence {
  return {
    candidateId: candidate.candidateId,
    candidateFamily: candidate.candidateFamily,
    rank: rankForCandidate(report, candidate.candidateId),
    trainedOnSplitNames: candidate.trainedOnSplitNames,
    evaluatedOnSplitName: candidate.evaluatedOnSplitName,
    evaluatedSampleCount: candidate.evaluatedSampleCount,
    metrics: {
      brierScore: candidate.metrics.brierScore,
      logLoss: candidate.metrics.logLoss,
      classAccuracy: candidate.metrics.classAccuracy,
      expectedCalibrationError: candidate.metrics.expectedCalibrationError.ece,
      calibrationBinCount: candidate.metrics.expectedCalibrationError.binCount
    }
  };
}

export function buildExperimentalReportSurface(
  report: CandidateBakeoffReportForSurface
): ExperimentalReportSurface {
  if (report.selectedCandidateId !== null) {
    throw new Error('Phase 8.5 cannot surface a selected model before Phase 8.6 Model Selection ADR.');
  }

  return {
    reportId: 'phase-8-5-owner-only-experimental-report-surface',
    phase: '8.5',
    sourceReportId: report.reportId,
    audience: 'owner_only',
    experimentLabel: 'experimental_not_production_ready',
    datasetId: report.datasetId,
    competitionIds: [...report.competitionIds],
    featureSpecVersion: report.featureSpecVersion,
    sampleCount: report.sampleCount,
    bookmakerBaselineAvailable: report.bookmakerBaselineAvailable,
    selectedCandidateId: null,
    selectionAuthority: report.selectionAuthority,
    nextAllowedPhase: 'phase:plan Phase 8.6 Model Selection ADR',
    candidateEvidence: report.candidateResults.map((candidate) => evidenceForCandidate(report, candidate)),
    knownWeaknesses: [...report.warnings],
    nonAuthorizations: [...NON_AUTHORIZATIONS]
  };
}

function formatList(values: readonly string[]): string {
  if (values.length === 0) return '- None.';
  return values.map((value) => `- ${value}`).join('\n');
}

function formatCandidateEvidence(candidates: readonly ExperimentalCandidateEvidence[]): string {
  if (candidates.length === 0) return '- No candidate evidence available.';

  return candidates
    .map((candidate) =>
      `- Rank ${candidate.rank ?? 'unranked'}: \`${candidate.candidateId}\` (${candidate.candidateFamily}) - ` +
      `LogLoss=${candidate.metrics.logLoss.toFixed(6)}, ` +
      `Brier=${candidate.metrics.brierScore.toFixed(6)}, ` +
      `Accuracy=${candidate.metrics.classAccuracy.toFixed(6)}, ` +
      `ECE=${candidate.metrics.expectedCalibrationError.toFixed(6)}, ` +
      `N=${candidate.evaluatedSampleCount}`
    )
    .join('\n');
}

export function generateExperimentalReportSurfaceMarkdown(surface: ExperimentalReportSurface): string {
  return `# Phase 8.5 Owner-Only Experimental Report Surface

## Status
- **Audience**: owner-only
- **Label**: Experimental, not production ready.
- **Source report**: \`${surface.sourceReportId}\`
- **Selected candidate**: null
- **Selection authority**: \`${surface.selectionAuthority}\`

## Dataset Evidence
- Dataset: \`${surface.datasetId}\`
- Competitions: ${surface.competitionIds.map((id) => `\`${id}\``).join(', ')}
- Feature spec version: \`${surface.featureSpecVersion}\`
- Test sample count: ${surface.sampleCount}
- Bookmaker baseline available: ${surface.bookmakerBaselineAvailable ? 'yes' : 'no'}

## Candidate Evidence
${formatCandidateEvidence(surface.candidateEvidence)}

## Known Weaknesses
${formatList(surface.knownWeaknesses)}

## Explicit Non-Authorizations
${formatList(surface.nonAuthorizations)}

## Next Allowed Phase
\`${surface.nextAllowedPhase}\`
`;
}
