import type { FeatureSpec } from './feature-spec.js';
import type { LeakageAuditResult, LeakageViolation } from './leakage-audit.js';

export type Phase82DatasetMetadata = {
  datasetId: string;
  competitionId: string;
  schemaVersion: string;
  featureSpecVersion: string;
  sourceProviderId: string;
  sourceSnapshotHash: string;
  builtAt: string;
  trainCount: number;
  valCount: number;
  testCount: number;
};

export type Phase82DatasetQualityReport = {
  processedCount: number;
  rejectedCount: number;
  trainCount: number;
  valCount: number;
  testCount: number;
  warnings: string[];
};

export type FeatureAuditReport = {
  reportId: string;
  phase: '8.2';
  status: 'pass' | 'fail';
  datasetId: string;
  competitionId: string;
  targetCompetitionScope: FeatureSpec['targetCompetitionScope'];
  featureSpecVersion: FeatureSpec['version'];
  checkedFeatureCount: number;
  datasetSampleCount: number;
  rejectedRecordCount: number;
  violations: LeakageViolation[];
  warnings: string[];
  forbiddenScope: readonly string[];
};

export type FeatureAuditReportInput = {
  metadata: Phase82DatasetMetadata;
  qualityReport: Phase82DatasetQualityReport;
  featureSpec: FeatureSpec;
  leakageAudit: LeakageAuditResult;
};

export function buildFeatureAuditReport(input: FeatureAuditReportInput): FeatureAuditReport {
  const datasetSampleCount = input.metadata.trainCount + input.metadata.valCount + input.metadata.testCount;
  const warnings = [...input.qualityReport.warnings];

  if (datasetSampleCount < 100) {
    warnings.push(
      'Dataset sample count is below 100 fixtures; this is audit evidence only, not model-training evidence.'
    );
  }

  return {
    reportId: `phase-8-2-feature-leakage-audit-${input.metadata.competitionId}`,
    phase: '8.2',
    status: input.leakageAudit.ok ? 'pass' : 'fail',
    datasetId: input.metadata.datasetId,
    competitionId: input.metadata.competitionId,
    targetCompetitionScope: input.featureSpec.targetCompetitionScope,
    featureSpecVersion: input.featureSpec.version,
    checkedFeatureCount: input.leakageAudit.checkedFeatureCount,
    datasetSampleCount,
    rejectedRecordCount: input.qualityReport.rejectedCount,
    violations: input.leakageAudit.violations,
    warnings,
    forbiddenScope: [
      'model_training',
      'runtime_prediction',
      'betting_recommendation',
      'stake_sizing',
      'club_competition_expansion'
    ]
  };
}
