import type { FeatureDefinition, FeatureSpec } from './feature-spec.js';

export type LeakageViolationCode =
  | 'forbidden_source_column'
  | 'forbidden_row_field'
  | 'non_pre_match_feature'
  | 'target_match_window';

export type LeakageViolation = {
  code: LeakageViolationCode;
  featureName?: string;
  field?: string;
  message: string;
};

export type LeakageAuditResult = {
  ok: boolean;
  checkedFeatureCount: number;
  violations: LeakageViolation[];
};

const FORBIDDEN_EXACT_FIELDS = new Set([
  'homescore',
  'awayscore',
  'score',
  'scores',
  'result',
  'resultlabel',
  'target',
  'targetlabel',
  'outcome',
  'outcomelabel',
  'fulltimeresult',
  'finalscore',
  'postmatchodds',
  'profitloss',
  'stake',
  'stakeamount',
  'kelly',
  'kellyfraction',
  'roi',
  'clv'
]);

const FORBIDDEN_SUBSTRINGS = [
  'postmatch',
  'fulltime',
  'targetlabel',
  'resultlabel',
  'profitloss',
  'kellyfraction'
];

export function normalizeFieldName(field: string): string {
  return field.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function isForbiddenLeakageField(field: string): boolean {
  const normalized = normalizeFieldName(field);
  return (
    FORBIDDEN_EXACT_FIELDS.has(normalized) ||
    FORBIDDEN_SUBSTRINGS.some((forbidden) => normalized.includes(forbidden))
  );
}

function forbiddenSourceColumnViolation(feature: FeatureDefinition, field: string): LeakageViolation {
  return {
    code: 'forbidden_source_column',
    featureName: feature.name,
    field,
    message: `Feature "${feature.name}" uses forbidden source column "${field}".`
  };
}

function auditFeatureDefinition(feature: FeatureDefinition): LeakageViolation[] {
  const violations: LeakageViolation[] = [];

  for (const field of feature.sourceColumns) {
    if (isForbiddenLeakageField(field)) {
      violations.push(forbiddenSourceColumnViolation(feature, field));
    }
  }

  if (feature.availableAt !== 'pre_match') {
    violations.push({
      code: 'non_pre_match_feature',
      featureName: feature.name,
      message: `Feature "${feature.name}" is not available before kickoff.`
    });
  }

  if (feature.lookbackWindow === 'target_match') {
    violations.push({
      code: 'target_match_window',
      featureName: feature.name,
      message: `Feature "${feature.name}" uses target-match information.`
    });
  }

  return violations;
}

export function auditFeatureSpec(spec: FeatureSpec): LeakageAuditResult {
  const violations = spec.features.flatMap((feature) => auditFeatureDefinition(feature));

  return {
    ok: violations.length === 0,
    checkedFeatureCount: spec.features.length,
    violations
  };
}

export function auditFeatureRowCandidate(row: Record<string, unknown>): LeakageAuditResult {
  const violations: LeakageViolation[] = [];

  for (const field of Object.keys(row)) {
    if (isForbiddenLeakageField(field)) {
      violations.push({
        code: 'forbidden_row_field',
        field,
        message: `Candidate feature row contains forbidden field "${field}".`
      });
    }
  }

  return {
    ok: violations.length === 0,
    checkedFeatureCount: 0,
    violations
  };
}

export function assertNoLeakage(result: LeakageAuditResult): void {
  if (result.ok) return;

  const details = result.violations
    .map((violation) => `${violation.code}: ${violation.message}`)
    .join('\n');

  throw new Error(`Feature leakage audit failed:\n${details}`);
}
