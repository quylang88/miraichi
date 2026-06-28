import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadEvaluationDataset } from '../apps/local-ai/src/evaluation/evaluation-dataset.js';

export const MIN_TEST_SAMPLE_COUNT = 100;
export const MIN_ENABLED_COMPETITIONS = 2;

type RegistryCompetition = {
  competition_id: string;
  soccerdata_league: string;
  competition_type: 'national_team';
  provider_status: 'supported' | 'unsupported';
  enabled: boolean;
};

type QualityReport = {
  rejectedCount: number;
  warnings: string[];
};

function readQualityReport(processedDir: string): QualityReport | null {
  const qualityReportPath = path.join(processedDir, 'quality_report.json');
  if (!fs.existsSync(qualityReportPath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(qualityReportPath, 'utf8')) as QualityReport;
}

export function generateExpansionReport(rootDir: string) {
  const registryPath = path.join(rootDir, 'apps/local-ai/config/competition-registry.json');
  const processedRoot = path.join(rootDir, 'apps/local-ai/data/processed');

  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as { competitions: RegistryCompetition[] };
  const enabledCompetitions = registry.competitions.filter(
    (competition) =>
      competition.enabled &&
      competition.competition_type === 'national_team' &&
      competition.provider_status === 'supported'
  );

  const processedDirs = enabledCompetitions.map((competition) =>
    path.join(processedRoot, competition.competition_id)
  );
  const missingProcessedDirs = processedDirs.filter((processedDir) => !fs.existsSync(processedDir));
  const warnings = [];
  const loadedDatasets = [];

  for (const competition of enabledCompetitions) {
    const processedDir = path.join(processedRoot, competition.competition_id);
    if (!fs.existsSync(processedDir)) {
      continue;
    }

    const dataset = loadEvaluationDataset(processedDir);
    loadedDatasets.push(dataset);

    if (dataset.train.length === 0) {
      warnings.push(`${competition.competition_id} train split has 0 scored fixtures.`);
    }

    if (dataset.validation.length === 0) {
      warnings.push(`${competition.competition_id} validation split has 0 scored fixtures.`);
    }

    if (dataset.test.length === 0) {
      warnings.push(`${competition.competition_id} test split has 0 scored fixtures.`);
    }

    const qualityReport = readQualityReport(processedDir);
    if (!qualityReport) {
      warnings.push(`${competition.competition_id} quality report is missing.`);
      continue;
    }

    if (qualityReport.rejectedCount > 0) {
      warnings.push(`${competition.competition_id} quality report has ${qualityReport.rejectedCount} rejected records.`);
    }

    if (qualityReport.warnings.length > 0) {
      const label = qualityReport.warnings.length === 1 ? 'warning' : 'warnings';
      warnings.push(`${competition.competition_id} quality report has ${qualityReport.warnings.length} ${label}.`);
    }
  }

  const totalTrainCount = loadedDatasets.reduce((sum, dataset) => sum + dataset.train.length, 0);
  const totalValidationCount = loadedDatasets.reduce((sum, dataset) => sum + dataset.validation.length, 0);
  const totalTestCount = loadedDatasets.reduce((sum, dataset) => sum + dataset.test.length, 0);

  if (enabledCompetitions.length < MIN_ENABLED_COMPETITIONS) {
    warnings.push('Fewer than two enabled national-team competitions are available.');
  }

  if (missingProcessedDirs.length > 0) {
    warnings.push(`Missing processed dataset directories: ${missingProcessedDirs.join(', ')}`);
  }

  if (totalTestCount < MIN_TEST_SAMPLE_COUNT) {
    warnings.push(`Aggregate national-team test sample count is below ${MIN_TEST_SAMPLE_COUNT}; Phase 8.4 remains blocked for meaningful model comparison.`);
  }

  const phase84DataReady =
    missingProcessedDirs.length === 0 &&
    enabledCompetitions.length >= MIN_ENABLED_COMPETITIONS &&
    totalTestCount >= MIN_TEST_SAMPLE_COUNT &&
    warnings.length === 0;

  const report = {
    reportId: 'phase-8-3a-national-team-dataset-expansion',
    phase: '8.3A',
    status: phase84DataReady ? 'pass' : 'blocked_for_phase_8_4',
    enabledCompetitionIds: enabledCompetitions.map((competition) => competition.competition_id),
    totalTrainCount,
    totalValidationCount,
    totalTestCount,
    missingProcessedDirs,
    phase84DataReady,
    warnings,
    blockedScope: [
      'club_competition_expansion',
      'candidate_model_bake_off_until_phase84DataReady',
      'runtime_prediction',
      'betting_recommendation',
    ],
  };

  const currentDate = new Date().toISOString().split('T')[0];

  const markdown = `# Phase 8.3A National-Team Dataset Expansion Report

## Status
- **Status**: ${report.status}
- **Date**: ${currentDate}
- **Scope**: National-team dataset expansion before Phase 8.4.

## Evidence
- Enabled national-team competitions: ${report.enabledCompetitionIds.map((id) => `\`${id}\``).join(', ')}
- Total train count: ${report.totalTrainCount}
- Total validation count: ${report.totalValidationCount}
- Total test count: ${report.totalTestCount}
- Phase 8.4 data ready: ${report.phase84DataReady ? 'yes' : 'no'}

## Warnings
${report.warnings.map((warning) => `- ${warning}`).join('\n')}

## Blocked Scope
${report.blockedScope.map((scope) => `- ${scope}`).join('\n')}

---
*Copa America remains desired future national-team scope, but it is not enabled until a clean provider source is confirmed.*
`;

  return { report, markdown };
}

export function main() {
  const rootDir = process.cwd();
  const reportPath = path.join(rootDir, 'apps/local-ai/reports/phase-8-3a-national-team-dataset-expansion.json');
  const docsPath = path.join(rootDir, 'docs/data/PHASE-8-3A-NATIONAL-TEAM-DATASET-EXPANSION-REPORT.md');

  const { report, markdown } = generateExpansionReport(rootDir);

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(docsPath, markdown, 'utf8');

  if (!report.phase84DataReady) {
    console.error(`[Phase 8.3A] BLOCKED for Phase 8.4. Report: ${reportPath}`);
    process.exit(1);
  }

  console.log(`[Phase 8.3A] PASSED. Report: ${reportPath}`);
}

const isMain = process.argv[1] && (
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url)) ||
  process.argv[1].endsWith('phase8-national-team-expansion-verify.ts') ||
  process.argv[1].endsWith('phase8-national-team-expansion-verify.js') ||
  process.argv[1].endsWith('phase8-national-team-expansion-verify')
);

if (isMain) {
  main();
}
