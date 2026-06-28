import fs from 'fs';
import path from 'path';
import { buildEvaluationReport, generateReportMarkdown } from '../apps/local-ai/src/evaluation/evaluation-report.js';
import { loadEvaluationDatasets } from '../apps/local-ai/src/evaluation/evaluation-dataset.js';

const rootDir = process.cwd();
const reportDir = path.join(rootDir, 'apps/local-ai/reports');
const reportPath = path.join(reportDir, 'phase-8-3-evaluation-harness-baselines.json');
const docsPath = path.join(rootDir, 'docs/data/PHASE-8-3-EVALUATION-HARNESS-BASELINES-REPORT.md');
const registryPath = path.join(rootDir, 'apps/local-ai/config/competition-registry.json');

const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as {
  competitions: Array<{
    competition_id: string;
    competition_type: 'national_team';
    provider_status: 'supported' | 'unsupported';
    enabled: boolean;
  }>;
};

const processedDirs = registry.competitions
  .filter((competition) =>
    competition.enabled &&
    competition.competition_type === 'national_team' &&
    competition.provider_status === 'supported'
  )
  .map((competition) => path.join(rootDir, 'apps/local-ai/data/processed', competition.competition_id));

const dataset = loadEvaluationDatasets(processedDirs);
const report = buildEvaluationReport(dataset);

fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

const markdown = generateReportMarkdown(report);

fs.writeFileSync(docsPath, markdown, 'utf8');

if (report.status !== 'pass') {
  console.error(`[Phase 8.3 Evaluation Harness] FAILED. Report: ${reportPath}`);
  process.exit(1);
}

console.log(`[Phase 8.3 Evaluation Harness] PASSED. Report: ${reportPath}`);
console.log(`[Phase 8.3 Evaluation Harness] Test samples: ${report.sampleCount}`);
console.log(`[Phase 8.3 Evaluation Harness] Warnings: ${report.warnings.length}`);
