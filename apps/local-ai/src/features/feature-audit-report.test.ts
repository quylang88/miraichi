import { describe, expect, it } from 'vitest';
import { APPROVED_FEATURE_SPEC } from './feature-spec.js';
import { auditFeatureSpec, type LeakageAuditResult } from './leakage-audit.js';
import { buildFeatureAuditReport } from './feature-audit-report.js';

// Intentionally tiny sample (total=3) to trigger the low-sample-count warning in test 2.
const metadata = {
  datasetId: 'dataset-comp-int-world-cup-2026-06-28',
  competitionId: 'comp-int-world-cup',
  schemaVersion: '1.0.0',
  featureSpecVersion: '0.1.0',
  sourceProviderId: 'soccerdata-fbref',
  sourceSnapshotHash: 'hash',
  builtAt: '2026-06-28T00:00:00Z',
  trainCount: 1,
  valCount: 1,
  testCount: 1
};

const qualityReport = {
  processedCount: 3,
  rejectedCount: 0,
  trainCount: 1,
  valCount: 1,
  testCount: 1,
  warnings: []
};

describe('Phase 8.2 feature audit report', () => {
  it('builds a passing owner-only report for the approved spec', () => {
    const report = buildFeatureAuditReport({
      metadata,
      qualityReport,
      featureSpec: APPROVED_FEATURE_SPEC,
      leakageAudit: auditFeatureSpec(APPROVED_FEATURE_SPEC)
    });

    expect(report.status).toBe('pass');
    expect(report.phase).toBe('8.2');
    expect(report.datasetId).toBe(metadata.datasetId);
    expect(report.competitionId).toBe('comp-int-world-cup');
    expect(report.targetCompetitionScope).toBe('world-cup-national-team-first');
    expect(report.checkedFeatureCount).toBe(13);
    expect(report.violations).toEqual([]);
  });

  it('warns that the Phase 8.1 sample is not enough for model training', () => {
    const report = buildFeatureAuditReport({
      metadata,
      qualityReport,
      featureSpec: APPROVED_FEATURE_SPEC,
      leakageAudit: auditFeatureSpec(APPROVED_FEATURE_SPEC)
    });

    expect(report.warnings).toContain(
      'Dataset sample count is below 100 fixtures; this is audit evidence only, not model-training evidence.'
    );
  });

  it('fails the report when leakage violations exist', () => {
    const leakedAudit: LeakageAuditResult = {
      ok: false,
      checkedFeatureCount: 14,
      violations: [
        {
          code: 'forbidden_source_column',
          featureName: 'leaked_target_home_score',
          field: 'home_score',
          message: 'Feature uses target match score.'
        }
      ]
    };

    const report = buildFeatureAuditReport({
      metadata,
      qualityReport,
      featureSpec: APPROVED_FEATURE_SPEC,
      leakageAudit: leakedAudit
    });

    expect(report.status).toBe('fail');
    expect(report.violations).toEqual(leakedAudit.violations);
  });
});
