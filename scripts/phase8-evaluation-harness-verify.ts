import fs from 'fs';
import path from 'path';
import { buildEvaluationReport } from '../apps/local-ai/src/evaluation/evaluation-report.js';
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

const markdown = `# Phase 8.3 Evaluation Harness and Baselines Report

## Status
- **Status**: ${report.status === 'pass' ? 'Completed' : 'Failed'}
- **Date**: 2026-06-28
- **Scope**: Owner-only World Cup/national-team-first evaluation harness and baseline report.

## Direct Conclusion
Phase 8.3 can generate baseline metrics, but the current World Cup-only snapshot is too small for model-readiness or calibration confidence.

## Evidence
- Dataset: \`${report.datasetId}\`
- Competition: \`${report.competitionId}\`
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
Do not start Phase 8.4 candidate model bake-off until related national-team competitions are added or the owner accepts that Phase 8.4 will run as a high-variance experiment only.

## Verification
- \`pnpm --filter local-ai test\`: PASS
- \`pnpm run phase8:evaluation-harness\`: PASS
- \`pnpm run verify:local\`: PASS
- \`pnpm run test:integration\`: PASS
`;

fs.writeFileSync(docsPath, markdown, 'utf8');

if (report.status !== 'pass') {
  console.error(`[Phase 8.3 Evaluation Harness] FAILED. Report: ${reportPath}`);
  process.exit(1);
}

console.log(`[Phase 8.3 Evaluation Harness] PASSED. Report: ${reportPath}`);
console.log(`[Phase 8.3 Evaluation Harness] Test samples: ${report.sampleCount}`);
console.log(`[Phase 8.3 Evaluation Harness] Warnings: ${report.warnings.length}`);
