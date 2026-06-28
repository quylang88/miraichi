import fs from 'fs';
import path from 'path';
import { buildEvaluationReport, generateReportMarkdown } from '../apps/local-ai/src/evaluation/evaluation-report.js';
import { loadEvaluationDataset } from '../apps/local-ai/src/evaluation/evaluation-dataset.js';

const rootDir = process.cwd();
const processedDir = path.join(rootDir, 'apps/local-ai/data/processed/comp-int-world-cup');
const reportDir = path.join(rootDir, 'apps/local-ai/reports');
const reportPath = path.join(reportDir, 'phase-8-3-evaluation-harness-baselines.json');
const docsPath = path.join(rootDir, 'docs/data/PHASE-8-3-EVALUATION-HARNESS-BASELINES-REPORT.md');

const dataset = loadEvaluationDataset(processedDir);
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
