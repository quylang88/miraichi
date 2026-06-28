import fs from 'fs';
import path from 'path';
import { APPROVED_FEATURE_SPEC } from '../apps/local-ai/src/features/feature-spec.js';
import { buildFeatureAuditReport, type Phase82DatasetMetadata, type Phase82DatasetQualityReport } from '../apps/local-ai/src/features/feature-audit-report.js';
import { assertNoLeakage, auditFeatureSpec } from '../apps/local-ai/src/features/leakage-audit.js';

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

const rootDir = process.cwd();
const processedDir = path.join(rootDir, 'apps/local-ai/data/processed/comp-int-world-cup');
const metadataPath = path.join(processedDir, 'metadata.json');
const qualityReportPath = path.join(processedDir, 'quality_report.json');

if (!fs.existsSync(metadataPath)) {
  throw new Error(`Missing Phase 8.1 dataset metadata: ${metadataPath}`);
}

if (!fs.existsSync(qualityReportPath)) {
  throw new Error(`Missing Phase 8.1 quality report: ${qualityReportPath}`);
}

const metadata = readJsonFile<Phase82DatasetMetadata>(metadataPath);
const qualityReport = readJsonFile<Phase82DatasetQualityReport>(qualityReportPath);
const leakageAudit = auditFeatureSpec(APPROVED_FEATURE_SPEC);

assertNoLeakage(leakageAudit);

const report = buildFeatureAuditReport({
  metadata,
  qualityReport,
  featureSpec: APPROVED_FEATURE_SPEC,
  leakageAudit
});

const reportDir = path.join(rootDir, 'apps/local-ai/reports');
const reportPath = path.join(reportDir, 'phase-8-2-feature-leakage-audit.json');
fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

if (report.status !== 'pass') {
  console.error(`[Phase 8.2 Feature Leakage Verify] FAILED. Report: ${reportPath}`);
  process.exit(1);
}

console.log(`[Phase 8.2 Feature Leakage Verify] PASSED. Report: ${reportPath}`);
console.log(`[Phase 8.2 Feature Leakage Verify] Checked features: ${report.checkedFeatureCount}`);
console.log(`[Phase 8.2 Feature Leakage Verify] Warnings: ${report.warnings.length}`);
