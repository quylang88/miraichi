import type { CandidateEvaluationResult } from './candidate-types.js';

export type CandidateBakeoffReportInput = {
  datasetId: string;
  competitionIds: readonly string[];
  featureSpecVersion: string;
  sampleCount: number;
  baselineLogLoss: number;
  baselineBrierScore: number;
  bookmakerBaselineAvailable: boolean;
  candidateResults: readonly CandidateEvaluationResult[];
};

export type CandidateBakeoffReport = {
  reportId: string;
  phase: '8.4';
  status: 'pass' | 'fail';
  datasetId: string;
  competitionIds: readonly string[];
  featureSpecVersion: string;
  sampleCount: number;
  baselineLogLoss: number;
  baselineBrierScore: number;
  bookmakerBaselineAvailable: boolean;
  candidateResults: readonly CandidateEvaluationResult[];
  rankedCandidateIds: string[];
  selectedCandidateId: null;
  selectionAuthority: 'blocked_until_phase_8_6_model_selection_adr';
  warnings: string[];
  forbiddenScope: readonly string[];
};

function sortCandidateResults(candidateResults: readonly CandidateEvaluationResult[]): CandidateEvaluationResult[] {
  return [...candidateResults].sort((left, right) => {
    const logLossDelta = left.metrics.logLoss - right.metrics.logLoss;
    if (logLossDelta !== 0) {
      return logLossDelta;
    }

    return left.candidateId.localeCompare(right.candidateId);
  });
}

function formatStringList(values: readonly string[]): string {
  if (values.length === 0) {
    return 'None';
  }

  return values.map((value) => `\`${value}\``).join(', ');
}

function formatWarnings(warnings: readonly string[]): string {
  if (warnings.length === 0) {
    return '- None.';
  }

  return warnings.map((warning) => `- ${warning}`).join('\n');
}

function formatCandidateSection(report: CandidateBakeoffReport): string {
  if (report.candidateResults.length === 0) {
    return '- No candidate results were provided.';
  }

  const candidateById = new Map(report.candidateResults.map((candidate) => [candidate.candidateId, candidate]));

  return report.rankedCandidateIds
    .map((candidateId, index) => {
      const candidate = candidateById.get(candidateId);
      if (!candidate) {
        return `- ${index + 1}. \`${candidateId}\` (missing candidate details)`;
      }

      return `- ${index + 1}. \`${candidate.candidateId}\` (` +
        `${candidate.candidateFamily}) - LogLoss=${candidate.metrics.logLoss.toFixed(3)}, ` +
        `Brier=${candidate.metrics.brierScore.toFixed(3)}, Accuracy=${candidate.metrics.classAccuracy.toFixed(3)}, ` +
        `N=${candidate.evaluatedSampleCount}`;
    })
    .join('\n');
}

export function buildCandidateBakeoffReport(input: CandidateBakeoffReportInput): CandidateBakeoffReport {
  const rankedCandidateResults = sortCandidateResults(input.candidateResults);
  const warnings: string[] = [];

  if (input.sampleCount < 200) {
    warnings.push(
      `Test sample count is ${input.sampleCount}; treat Phase 8.4 as high-variance R&D evidence, not model-selection evidence.`
    );
  }

  if (!input.bookmakerBaselineAvailable) {
    warnings.push(
      'Bookmaker baseline is unavailable for the current dataset; candidate results cannot be judged against market-implied probabilities.'
    );
  }

  if (input.candidateResults.length === 0) {
    warnings.push('No candidate results were provided; the bake-off cannot rank models.');
  }

  return {
    reportId: 'phase-8-4-candidate-model-bakeoff',
    phase: '8.4',
    status: input.candidateResults.length > 0 ? 'pass' : 'fail',
    datasetId: input.datasetId,
    competitionIds: [...input.competitionIds],
    featureSpecVersion: input.featureSpecVersion,
    sampleCount: input.sampleCount,
    baselineLogLoss: input.baselineLogLoss,
    baselineBrierScore: input.baselineBrierScore,
    bookmakerBaselineAvailable: input.bookmakerBaselineAvailable,
    candidateResults: rankedCandidateResults,
    rankedCandidateIds: rankedCandidateResults.map((candidate) => candidate.candidateId),
    selectedCandidateId: null,
    selectionAuthority: 'blocked_until_phase_8_6_model_selection_adr',
    warnings,
    forbiddenScope: [
      'model_selection',
      'runtime_prediction',
      'betting_recommendation',
      'stake_sizing',
      'club_competition_expansion'
    ]
  };
}

export function generateCandidateBakeoffMarkdown(report: CandidateBakeoffReport): string {
  const directConclusion = 'No model is selected in Phase 8.4. Phase 8.4 only ranks candidates and does not authorize runtime or betting use.';
  const candidateSection = formatCandidateSection(report);
  const warningsSection = formatWarnings(report.warnings);

  return `# Phase 8.4 Candidate Model Bake-Off Report

## Status
- **Status**: ${report.status === 'pass' ? 'Completed' : 'Failed'}
- **Report ID**: \`${report.reportId}\`
- **Phase**: \`${report.phase}\`

## Direct Conclusion
${directConclusion}
- No runtime prediction route.
- No betting recommendation.
- No stake sizing, Kelly, bankroll, ROI, or CLV.
- No club expansion.

## Evidence
- Dataset: \`${report.datasetId}\`
- Competitions: ${formatStringList(report.competitionIds)}
- Feature spec version: \`${report.featureSpecVersion}\`
- Sample count: ${report.sampleCount}
- Baseline log loss: ${report.baselineLogLoss.toFixed(3)}
- Baseline Brier score: ${report.baselineBrierScore.toFixed(3)}
- Bookmaker baseline available: ${report.bookmakerBaselineAvailable ? 'yes' : 'no'}

## Candidates
${candidateSection}

## Ranking
- Ranked candidate IDs: ${formatStringList(report.rankedCandidateIds)}
- Selected candidate ID: ${report.selectedCandidateId === null ? 'null' : `\`${report.selectedCandidateId}\``}
- Selection authority: \`${report.selectionAuthority}\`

## Warnings
${warningsSection}

## Explicit Non-Authorizations
- No model is selected in Phase 8.4.
- No runtime prediction route.
- No betting recommendation.
- No stake sizing, Kelly, bankroll, ROI, or CLV.
- No club competition expansion.
- No model selection until Phase 8.6 Model Selection ADR.

## Next Phase
Phase 8.5 Owner-Only Experimental Report Surface, before any Phase 8.6 Model Selection ADR.
`;
}
