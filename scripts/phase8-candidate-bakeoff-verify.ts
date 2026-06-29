import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  buildCandidateBakeoffReport,
  generateCandidateBakeoffMarkdown
} from '../apps/local-ai/src/candidates/candidate-bakeoff-report.js';
import { evaluateCandidateBatch } from '../apps/local-ai/src/candidates/candidate-evaluator.js';
import { predictWithEloRatingCandidate } from '../apps/local-ai/src/candidates/elo-rating-candidate.js';
import { predictWithMultinomialLogisticCandidate } from '../apps/local-ai/src/candidates/multinomial-logistic-candidate.js';
import { loadEvaluationDatasets } from '../apps/local-ai/src/evaluation/evaluation-dataset.js';
import { buildEvaluationReport } from '../apps/local-ai/src/evaluation/evaluation-report.js';

export type Phase83AReport = {
  phase84DataReady: boolean;
};

export type RegistryCompetition = {
  competition_id: string;
  competition_type: 'national_team';
  provider_status: 'supported' | 'unsupported';
  enabled: boolean;
};

function phase83AReportPath(rootDir: string): string {
  return path.join(rootDir, 'apps/local-ai/reports/phase-8-3a-national-team-dataset-expansion.json');
}

export function verifyPhase84Preflight(rootDir: string): void {
  const reportPath = phase83AReportPath(rootDir);
  if (!fs.existsSync(reportPath)) {
    throw new Error('Phase 8.4 requires phase84DataReady=true from Phase 8.3A.');
  }

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as Phase83AReport;
  if (report.phase84DataReady !== true) {
    throw new Error('Phase 8.4 requires phase84DataReady=true from Phase 8.3A.');
  }
}

function enabledProcessedDirs(rootDir: string): string[] {
  const registryPath = path.join(rootDir, 'apps/local-ai/config/competition-registry.json');
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as {
    competitions: RegistryCompetition[];
  };

  return registry.competitions
    .filter(
      (competition) =>
        competition.enabled &&
        competition.competition_type === 'national_team' &&
        competition.provider_status === 'supported'
    )
    .map((competition) => path.join(rootDir, 'apps/local-ai/data/processed', competition.competition_id));
}

export function generatePhase84Report(rootDir: string) {
  verifyPhase84Preflight(rootDir);

  const dataset = loadEvaluationDatasets(enabledProcessedDirs(rootDir));
  const baselineReport = buildEvaluationReport(dataset);
  const baselineLogLoss = Math.min(...baselineReport.baselines.map((baseline) => baseline.metrics.logLoss));
  const baselineBrierScore = Math.min(
    ...baselineReport.baselines.map((baseline) => baseline.metrics.brierScore)
  );

  const candidateResults = [
    evaluateCandidateBatch(predictWithEloRatingCandidate(dataset)),
    evaluateCandidateBatch(predictWithMultinomialLogisticCandidate(dataset))
  ];

  return buildCandidateBakeoffReport({
    datasetId: dataset.metadata.datasetId,
    competitionIds: dataset.competitionIds,
    featureSpecVersion: dataset.metadata.featureSpecVersion,
    sampleCount: dataset.test.length,
    baselineLogLoss,
    baselineBrierScore,
    bookmakerBaselineAvailable: baselineReport.nonBlockingGates.bookmakerBaselineAvailable,
    candidateResults
  });
}

export function main(): void {
  const rootDir = process.cwd();
  const reportPath = path.join(rootDir, 'apps/local-ai/reports/phase-8-4-candidate-model-bakeoff.json');
  const docsPath = path.join(rootDir, 'docs/data/PHASE-8-4-CANDIDATE-MODEL-BAKEOFF-REPORT.md');
  const report = generatePhase84Report(rootDir);
  const markdown = generateCandidateBakeoffMarkdown(report);

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.mkdirSync(path.dirname(docsPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(docsPath, markdown, 'utf8');

  if (report.status !== 'pass' || report.selectedCandidateId !== null) {
    console.error(`[Phase 8.4 Candidate Bake-Off] FAILED. Report: ${reportPath}`);
    process.exit(1);
  }

  console.log(`[Phase 8.4 Candidate Bake-Off] PASSED. Report: ${reportPath}`);
  console.log(`[Phase 8.4 Candidate Bake-Off] Candidates: ${report.candidateResults.length}`);
  console.log('[Phase 8.4 Candidate Bake-Off] Selected candidate: none');
}

const currentModulePath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const isMain = Boolean(invokedPath) && (
  invokedPath === path.resolve(currentModulePath) ||
  invokedPath.endsWith('phase8-candidate-bakeoff-verify.ts') ||
  invokedPath.endsWith('phase8-candidate-bakeoff-verify.js') ||
  invokedPath.endsWith('phase8-candidate-bakeoff-verify')
);

if (isMain) {
  main();
}
