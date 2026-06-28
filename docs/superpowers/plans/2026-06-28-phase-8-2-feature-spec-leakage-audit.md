# Phase 8.2 Feature Spec and Leakage Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define a versioned pre-match feature specification and leakage audit for the World Cup/national-team-first Phase 8 path before any model training or baseline evaluation begins.

**Architecture:** Phase 8.2 adds TypeScript-first local-ai feature metadata and audit utilities. The approved feature spec describes only pre-match, model-agnostic candidate inputs; the leakage audit rejects target-match results, post-match fields, betting-profit fields, and tournament/team shortcuts. Dataset metadata from Phase 8.1 is read only for reporting; no model training, probability generation, runtime prediction, betting calculation, or club competition expansion is allowed in this phase.

**Tech Stack:** TypeScript, Vitest, existing `tsx` script execution, Phase 8.1 JSONL/JSON dataset artifacts under `apps/local-ai/data/processed/comp-int-world-cup`.

---

## Scope Boundary

### Allowed
- Create a versioned feature-spec module under `apps/local-ai/src/features/`.
- Define pre-match feature families for rolling form, rest/schedule context, rating snapshots, and pre-match market baseline inputs.
- Add leakage-audit utilities that fail on intentionally leaked fields.
- Generate an owner-only audit report from existing Phase 8.1 metadata and quality report.
- Keep the first scope explicitly World Cup and national-team competitions.

### Blocked
- No model training.
- No feature value generation from match history.
- No `/ai/v1/predict` real inference.
- No LightGBM, CatBoost, XGBoost, ONNX, logistic regression, Elo calculation, Poisson model, or candidate bake-off.
- No betting ROI, CLV, Kelly, stake sizing, bankroll, recommendation ranking, or "best bet" labels.
- No Premier League or club dataset expansion.
- No production database schema, paid provider integration, secrets, or staging/production promotion.

## Proposed Files

### Create
- `apps/local-ai/src/features/feature-spec.ts`
- `apps/local-ai/src/features/feature-spec.test.ts`
- `apps/local-ai/src/features/leakage-audit.ts`
- `apps/local-ai/src/features/leakage-audit.test.ts`
- `apps/local-ai/src/features/feature-audit-report.ts`
- `apps/local-ai/src/features/feature-audit-report.test.ts`
- `scripts/phase8-feature-leakage-verify.ts`
- `docs/data/PHASE-8-2-FEATURE-SPEC-LEAKAGE-AUDIT-REPORT.md`

### Modify
- `package.json`
- `PROJECT_PLAN.md`

---

### Task 1: Versioned Feature Spec Contract

**Files:**
- Create: `apps/local-ai/src/features/feature-spec.test.ts`
- Create: `apps/local-ai/src/features/feature-spec.ts`

- [ ] **Step 1: Write the failing feature-spec tests**

Create `apps/local-ai/src/features/feature-spec.test.ts`.

```typescript
import { describe, expect, it } from 'vitest';
import {
  APPROVED_FEATURE_SPEC,
  FEATURE_SPEC_VERSION,
  getFeatureSpec,
  listFeatureNames
} from './feature-spec.js';

describe('Phase 8.2 feature spec', () => {
  it('declares a versioned World Cup national-team-first feature spec', () => {
    const spec = getFeatureSpec();

    expect(spec.version).toBe(FEATURE_SPEC_VERSION);
    expect(spec.version).toBe('feature-spec-v0.1.0');
    expect(spec.targetCompetitionScope).toBe('world-cup-national-team-first');
    expect(spec.modelAgnostic).toBe(true);
    expect(spec.features.length).toBe(13);
  });

  it('keeps every approved feature available before kickoff', () => {
    for (const feature of APPROVED_FEATURE_SPEC.features) {
      expect(feature.availableAt).toBe('pre_match');
      expect(feature.sourceTiming).toBe('prior_to_kickoff');
      expect(feature.lookbackWindow).not.toBe('target_match');
    }
  });

  it('names the initial feature set without club or tournament shortcuts', () => {
    expect(listFeatureNames(APPROVED_FEATURE_SPEC)).toEqual([
      'home_prior_match_count',
      'away_prior_match_count',
      'home_prior_points_per_match',
      'away_prior_points_per_match',
      'home_prior_goal_difference_per_match',
      'away_prior_goal_difference_per_match',
      'home_rest_days',
      'away_rest_days',
      'home_elo_rating_pre_match',
      'away_elo_rating_pre_match',
      'market_home_implied_probability_pre_match',
      'market_draw_implied_probability_pre_match',
      'market_away_implied_probability_pre_match'
    ]);
  });

  it('does not approve labels, target-match scores, or betting-profit inputs', () => {
    const serialized = JSON.stringify(APPROVED_FEATURE_SPEC).toLowerCase();

    for (const forbidden of [
      'home_score',
      'away_score',
      'full_time',
      'result_label',
      'target_label',
      'profit_loss',
      'stake',
      'kelly',
      'roi',
      'clv'
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter local-ai test -- apps/local-ai/src/features/feature-spec.test.ts
```

Expected: FAIL because `apps/local-ai/src/features/feature-spec.ts` does not exist.

- [ ] **Step 3: Implement the feature-spec module**

Create `apps/local-ai/src/features/feature-spec.ts`.

```typescript
export const FEATURE_SPEC_VERSION = 'feature-spec-v0.1.0' as const;

export type FeatureFamily =
  | 'rolling_form'
  | 'rest_schedule'
  | 'rating_snapshot'
  | 'market_baseline';

export type FeatureSourceTiming = 'prior_to_kickoff';
export type FeatureAvailability = 'pre_match';
export type FeatureLookbackWindow = 'prior_matches' | 'pre_match_snapshot' | 'target_match';
export type FeatureOutputType = 'number' | 'boolean';

export type FeatureDefinition = {
  name: string;
  family: FeatureFamily;
  description: string;
  sourceColumns: readonly string[];
  sourceTiming: FeatureSourceTiming;
  availableAt: FeatureAvailability;
  lookbackWindow: FeatureLookbackWindow;
  outputType: FeatureOutputType;
  nullable: boolean;
};

export type FeatureSpec = {
  version: typeof FEATURE_SPEC_VERSION;
  targetCompetitionScope: 'world-cup-national-team-first';
  modelAgnostic: true;
  generatedAtPhase: '8.2';
  features: readonly FeatureDefinition[];
};

export const APPROVED_FEATURE_SPEC: FeatureSpec = Object.freeze({
  version: FEATURE_SPEC_VERSION,
  targetCompetitionScope: 'world-cup-national-team-first',
  modelAgnostic: true,
  generatedAtPhase: '8.2',
  features: Object.freeze([
    {
      name: 'home_prior_match_count',
      family: 'rolling_form',
      description: 'Count of prior completed matches available for the home-side team before kickoff.',
      sourceColumns: Object.freeze(['homeTeamId', 'kickoffTime', 'homePriorMatchCount']),
      sourceTiming: 'prior_to_kickoff',
      availableAt: 'pre_match',
      lookbackWindow: 'prior_matches',
      outputType: 'number',
      nullable: false
    },
    {
      name: 'away_prior_match_count',
      family: 'rolling_form',
      description: 'Count of prior completed matches available for the away-side team before kickoff.',
      sourceColumns: Object.freeze(['awayTeamId', 'kickoffTime', 'awayPriorMatchCount']),
      sourceTiming: 'prior_to_kickoff',
      availableAt: 'pre_match',
      lookbackWindow: 'prior_matches',
      outputType: 'number',
      nullable: false
    },
    {
      name: 'home_prior_points_per_match',
      family: 'rolling_form',
      description: 'Precomputed home-side team points per match from matches before kickoff only.',
      sourceColumns: Object.freeze(['homeTeamId', 'kickoffTime', 'homePriorPointsPerMatch']),
      sourceTiming: 'prior_to_kickoff',
      availableAt: 'pre_match',
      lookbackWindow: 'prior_matches',
      outputType: 'number',
      nullable: true
    },
    {
      name: 'away_prior_points_per_match',
      family: 'rolling_form',
      description: 'Precomputed away-side team points per match from matches before kickoff only.',
      sourceColumns: Object.freeze(['awayTeamId', 'kickoffTime', 'awayPriorPointsPerMatch']),
      sourceTiming: 'prior_to_kickoff',
      availableAt: 'pre_match',
      lookbackWindow: 'prior_matches',
      outputType: 'number',
      nullable: true
    },
    {
      name: 'home_prior_goal_difference_per_match',
      family: 'rolling_form',
      description: 'Precomputed home-side team goal-difference rate from prior matches only.',
      sourceColumns: Object.freeze(['homeTeamId', 'kickoffTime', 'homePriorGoalDifferencePerMatch']),
      sourceTiming: 'prior_to_kickoff',
      availableAt: 'pre_match',
      lookbackWindow: 'prior_matches',
      outputType: 'number',
      nullable: true
    },
    {
      name: 'away_prior_goal_difference_per_match',
      family: 'rolling_form',
      description: 'Precomputed away-side team goal-difference rate from prior matches only.',
      sourceColumns: Object.freeze(['awayTeamId', 'kickoffTime', 'awayPriorGoalDifferencePerMatch']),
      sourceTiming: 'prior_to_kickoff',
      availableAt: 'pre_match',
      lookbackWindow: 'prior_matches',
      outputType: 'number',
      nullable: true
    },
    {
      name: 'home_rest_days',
      family: 'rest_schedule',
      description: 'Days since the home-side team previous known match before kickoff.',
      sourceColumns: Object.freeze(['homeTeamId', 'kickoffTime', 'homePreviousKickoffTime']),
      sourceTiming: 'prior_to_kickoff',
      availableAt: 'pre_match',
      lookbackWindow: 'prior_matches',
      outputType: 'number',
      nullable: true
    },
    {
      name: 'away_rest_days',
      family: 'rest_schedule',
      description: 'Days since the away-side team previous known match before kickoff.',
      sourceColumns: Object.freeze(['awayTeamId', 'kickoffTime', 'awayPreviousKickoffTime']),
      sourceTiming: 'prior_to_kickoff',
      availableAt: 'pre_match',
      lookbackWindow: 'prior_matches',
      outputType: 'number',
      nullable: true
    },
    {
      name: 'home_elo_rating_pre_match',
      family: 'rating_snapshot',
      description: 'Versioned home-side team rating snapshot calculated before kickoff.',
      sourceColumns: Object.freeze(['homeTeamId', 'kickoffTime', 'homeEloRatingPreMatch']),
      sourceTiming: 'prior_to_kickoff',
      availableAt: 'pre_match',
      lookbackWindow: 'pre_match_snapshot',
      outputType: 'number',
      nullable: true
    },
    {
      name: 'away_elo_rating_pre_match',
      family: 'rating_snapshot',
      description: 'Versioned away-side team rating snapshot calculated before kickoff.',
      sourceColumns: Object.freeze(['awayTeamId', 'kickoffTime', 'awayEloRatingPreMatch']),
      sourceTiming: 'prior_to_kickoff',
      availableAt: 'pre_match',
      lookbackWindow: 'pre_match_snapshot',
      outputType: 'number',
      nullable: true
    },
    {
      name: 'market_home_implied_probability_pre_match',
      family: 'market_baseline',
      description: 'Home outcome market-implied probability captured before kickoff when source odds exist.',
      sourceColumns: Object.freeze(['matchId', 'kickoffTime', 'marketHomeImpliedProbabilityPreMatch']),
      sourceTiming: 'prior_to_kickoff',
      availableAt: 'pre_match',
      lookbackWindow: 'pre_match_snapshot',
      outputType: 'number',
      nullable: true
    },
    {
      name: 'market_draw_implied_probability_pre_match',
      family: 'market_baseline',
      description: 'Draw outcome market-implied probability captured before kickoff when source odds exist.',
      sourceColumns: Object.freeze(['matchId', 'kickoffTime', 'marketDrawImpliedProbabilityPreMatch']),
      sourceTiming: 'prior_to_kickoff',
      availableAt: 'pre_match',
      lookbackWindow: 'pre_match_snapshot',
      outputType: 'number',
      nullable: true
    },
    {
      name: 'market_away_implied_probability_pre_match',
      family: 'market_baseline',
      description: 'Away outcome market-implied probability captured before kickoff when source odds exist.',
      sourceColumns: Object.freeze(['matchId', 'kickoffTime', 'marketAwayImpliedProbabilityPreMatch']),
      sourceTiming: 'prior_to_kickoff',
      availableAt: 'pre_match',
      lookbackWindow: 'pre_match_snapshot',
      outputType: 'number',
      nullable: true
    }
  ])
});

export function getFeatureSpec(): FeatureSpec {
  return APPROVED_FEATURE_SPEC;
}

export function listFeatureNames(spec: FeatureSpec): string[] {
  return spec.features.map((feature) => feature.name);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter local-ai test -- apps/local-ai/src/features/feature-spec.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/local-ai/src/features/feature-spec.ts apps/local-ai/src/features/feature-spec.test.ts
git commit -m "feat(local-ai): add phase 8.2 feature spec contract"
```

---

### Task 2: Leakage Audit Engine

**Files:**
- Create: `apps/local-ai/src/features/leakage-audit.test.ts`
- Create: `apps/local-ai/src/features/leakage-audit.ts`

- [ ] **Step 1: Write the failing leakage-audit tests**

Create `apps/local-ai/src/features/leakage-audit.test.ts`.

```typescript
import { describe, expect, it } from 'vitest';
import { APPROVED_FEATURE_SPEC, type FeatureSpec } from './feature-spec.js';
import {
  auditFeatureRowCandidate,
  auditFeatureSpec,
  assertNoLeakage,
  isForbiddenLeakageField
} from './leakage-audit.js';

function cloneApprovedSpec(): FeatureSpec {
  return JSON.parse(JSON.stringify(APPROVED_FEATURE_SPEC)) as FeatureSpec;
}

describe('Phase 8.2 leakage audit', () => {
  it('passes the approved feature spec', () => {
    const result = auditFeatureSpec(APPROVED_FEATURE_SPEC);

    expect(result.ok).toBe(true);
    expect(result.checkedFeatureCount).toBe(13);
    expect(result.violations).toEqual([]);
    expect(() => assertNoLeakage(result)).not.toThrow();
  });

  it('rejects target-match score fields in feature source columns', () => {
    const leakedSpec = cloneApprovedSpec();
    leakedSpec.features = [
      ...leakedSpec.features,
      {
        name: 'leaked_target_home_score',
        family: 'rolling_form',
        description: 'Invalid feature that uses the target match final home score.',
        sourceColumns: ['home_score'],
        sourceTiming: 'prior_to_kickoff',
        availableAt: 'pre_match',
        lookbackWindow: 'target_match',
        outputType: 'number',
        nullable: false
      }
    ];

    const result = auditFeatureSpec(leakedSpec);

    expect(result.ok).toBe(false);
    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'forbidden_source_column',
          featureName: 'leaked_target_home_score',
          field: 'home_score'
        }),
        expect.objectContaining({
          code: 'target_match_window',
          featureName: 'leaked_target_home_score'
        })
      ])
    );
  });

  it('rejects post-match and non-pre-match feature definitions', () => {
    const leakedSpec = cloneApprovedSpec();
    leakedSpec.features = [
      ...leakedSpec.features,
      {
        name: 'post_match_result_label',
        family: 'rolling_form',
        description: 'Invalid post-match label.',
        sourceColumns: ['result_label'],
        sourceTiming: 'prior_to_kickoff',
        availableAt: 'post_match' as 'pre_match',
        lookbackWindow: 'pre_match_snapshot',
        outputType: 'number',
        nullable: false
      }
    ];

    const result = auditFeatureSpec(leakedSpec);

    expect(result.ok).toBe(false);
    expect(result.violations.map((violation) => violation.code)).toContain('non_pre_match_feature');
    expect(result.violations.map((violation) => violation.code)).toContain('forbidden_source_column');
  });

  it('rejects candidate feature rows containing leaked labels or betting profit fields', () => {
    const result = auditFeatureRowCandidate({
      matchId: 'match-wc-2022-sample-1',
      home_prior_match_count: 8,
      targetLabel: 'home_win',
      roi: 0.12,
      kellyFraction: 0.05
    });

    expect(result.ok).toBe(false);
    expect(result.violations.map((violation) => violation.field)).toEqual(
      expect.arrayContaining(['targetLabel', 'roi', 'kellyFraction'])
    );
  });

  it('allows pre-match feature row fields from the approved vocabulary', () => {
    const result = auditFeatureRowCandidate({
      matchId: 'match-wc-2022-sample-1',
      home_prior_match_count: 8,
      away_prior_match_count: 8,
      home_rest_days: 5,
      away_rest_days: 4,
      market_home_implied_probability_pre_match: 0.42
    });

    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('normalizes common leaked field spellings', () => {
    expect(isForbiddenLeakageField('homeScore')).toBe(true);
    expect(isForbiddenLeakageField('full_time_result')).toBe(true);
    expect(isForbiddenLeakageField('postMatchOdds')).toBe(true);
    expect(isForbiddenLeakageField('homePriorGoalDifferencePerMatch')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter local-ai test -- apps/local-ai/src/features/leakage-audit.test.ts
```

Expected: FAIL because `apps/local-ai/src/features/leakage-audit.ts` does not exist.

- [ ] **Step 3: Implement the leakage-audit module**

Create `apps/local-ai/src/features/leakage-audit.ts`.

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter local-ai test -- apps/local-ai/src/features/leakage-audit.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/local-ai/src/features/leakage-audit.ts apps/local-ai/src/features/leakage-audit.test.ts
git commit -m "feat(local-ai): add phase 8.2 leakage audit"
```

---

### Task 3: Feature Audit Report Builder

**Files:**
- Create: `apps/local-ai/src/features/feature-audit-report.test.ts`
- Create: `apps/local-ai/src/features/feature-audit-report.ts`

- [ ] **Step 1: Write the failing report-builder tests**

Create `apps/local-ai/src/features/feature-audit-report.test.ts`.

```typescript
import { describe, expect, it } from 'vitest';
import { APPROVED_FEATURE_SPEC } from './feature-spec.js';
import { auditFeatureSpec, type LeakageAuditResult } from './leakage-audit.js';
import { buildFeatureAuditReport } from './feature-audit-report.js';

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
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter local-ai test -- apps/local-ai/src/features/feature-audit-report.test.ts
```

Expected: FAIL because `apps/local-ai/src/features/feature-audit-report.ts` does not exist.

- [ ] **Step 3: Implement the report builder**

Create `apps/local-ai/src/features/feature-audit-report.ts`.

```typescript
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

type BuildFeatureAuditReportInput = {
  metadata: Phase82DatasetMetadata;
  qualityReport: Phase82DatasetQualityReport;
  featureSpec: FeatureSpec;
  leakageAudit: LeakageAuditResult;
};

export function buildFeatureAuditReport(input: BuildFeatureAuditReportInput): FeatureAuditReport {
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
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter local-ai test -- apps/local-ai/src/features/feature-audit-report.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/local-ai/src/features/feature-audit-report.ts apps/local-ai/src/features/feature-audit-report.test.ts
git commit -m "feat(local-ai): add phase 8.2 feature audit report"
```

---

### Task 4: Phase 8.2 Verification Script

**Files:**
- Create: `scripts/phase8-feature-leakage-verify.ts`
- Modify: `package.json`

- [ ] **Step 1: Run the missing script to verify the command fails**

Run:

```bash
pnpm exec tsx scripts/phase8-feature-leakage-verify.ts
```

Expected: FAIL with a module/file-not-found error because the script does not exist.

- [ ] **Step 2: Implement the Phase 8.2 verification script**

Create `scripts/phase8-feature-leakage-verify.ts`.

```typescript
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
```

- [ ] **Step 3: Add a root package script**

Modify the root `package.json` scripts object by adding:

```json
"phase8:feature-audit": "tsx scripts/phase8-feature-leakage-verify.ts"
```

The surrounding script block should include this key near the other phase verification scripts:

```json
{
  "phase4:integration": "tsx scripts/phase4-integration-verify.ts",
  "phase8:feature-audit": "tsx scripts/phase8-feature-leakage-verify.ts",
  "pwa:verify": "tsx scripts/pwa-verify.ts"
}
```

- [ ] **Step 4: Run the script directly**

Run:

```bash
pnpm exec tsx scripts/phase8-feature-leakage-verify.ts
```

Expected: PASS and writes `apps/local-ai/reports/phase-8-2-feature-leakage-audit.json`.

- [ ] **Step 5: Run the package script**

Run:

```bash
pnpm run phase8:feature-audit
```

Expected: PASS and prints the same report path.

- [ ] **Step 6: Commit**

```bash
git add package.json scripts/phase8-feature-leakage-verify.ts apps/local-ai/reports/phase-8-2-feature-leakage-audit.json
git commit -m "test(local-ai): add phase 8.2 feature leakage verification"
```

---

### Task 5: Phase 8.2 Report and Project Plan Update

**Files:**
- Create: `docs/data/PHASE-8-2-FEATURE-SPEC-LEAKAGE-AUDIT-REPORT.md`
- Modify: `PROJECT_PLAN.md`

- [ ] **Step 1: Create the Phase 8.2 report**

Create `docs/data/PHASE-8-2-FEATURE-SPEC-LEAKAGE-AUDIT-REPORT.md`.

```markdown
# Phase 8.2 Feature Spec and Leakage Audit Report

## Status
- **Status**: Completed
- **Date**: 2026-06-28
- **Scope**: World Cup and national-team-first feature specification and leakage audit.

## Direct Conclusion
Phase 8.2 defines the feature specification and leakage audit boundary only.

It does not authorize model training, feature value generation, runtime prediction, betting recommendations, stake sizing, or club competition expansion.

## Evidence
- Feature spec version: `feature-spec-v0.1.0`
- Initial competition scope: `world-cup-national-team-first`
- Dataset target: `comp-int-world-cup`
- Leakage audit report: `apps/local-ai/reports/phase-8-2-feature-leakage-audit.json`

## Approved Feature Families
- Rolling form from prior matches only.
- Rest and schedule context available before kickoff only.
- Versioned pre-match rating snapshots only.
- Pre-match market baseline inputs where odds exist before kickoff.

## Blocked Leakage Inputs
- Target-match full-time goals.
- Result labels and outcome labels.
- Post-match odds movement.
- Betting ROI, CLV, stake sizing, Kelly, bankroll, and profit/loss fields.
- Team, tournament, league, or club shortcuts.

## Known Weaknesses
- The Phase 8.1 sample dataset is too small for model training or calibration claims.
- World Cup-only data will remain high variance until related national-team competitions are added through owner-approved source scope.
- Feature values are not generated in Phase 8.2; that remains future work after this leakage boundary is accepted.

## Recommendation
The earliest safe next lifecycle command after Phase 8.2 passes is:

```bash
phase:implementation-plan Phase 8.3 Evaluation Harness and Baselines
```

Phase 8.3 must build baselines and metric reporting before any candidate model bake-off starts.
```

- [ ] **Step 2: Update PROJECT_PLAN.md**

Modify the Phase 8 checklist section in `PROJECT_PLAN.md` so these entries are present:

```markdown
- [x] Create `phase:implementation-plan Phase 8.2 Feature Spec and Leakage Audit`.
- [x] Complete Phase 8.2 Feature Spec and Leakage Audit.
- [ ] Create and complete Phase 8.3 Evaluation Harness and Baselines, including Brier, Calibration/ECE, log loss, sample count, and bookmaker/simple baseline comparison.
```

- [ ] **Step 3: Run focused Phase 8.2 checks**

Run:

```bash
pnpm --filter local-ai test -- apps/local-ai/src/features/feature-spec.test.ts apps/local-ai/src/features/leakage-audit.test.ts apps/local-ai/src/features/feature-audit-report.test.ts
pnpm run phase8:feature-audit
```

Expected: both commands PASS.

- [ ] **Step 4: Run local verification**

Run:

```bash
pnpm run verify:local
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add PROJECT_PLAN.md docs/data/PHASE-8-2-FEATURE-SPEC-LEAKAGE-AUDIT-REPORT.md
git commit -m "docs(data): record phase 8.2 feature leakage audit"
```

---

## Final Verification

Run:

```bash
pnpm --filter local-ai test
pnpm run phase8:feature-audit
pnpm run verify:local
```

Expected:
- `pnpm --filter local-ai test`: PASS.
- `pnpm run phase8:feature-audit`: PASS and writes `apps/local-ai/reports/phase-8-2-feature-leakage-audit.json`.
- `pnpm run verify:local`: PASS.

## Handoff Recommendation

After all tasks pass, recommend:

```bash
phase:implementation-plan Phase 8.3 Evaluation Harness and Baselines
```

Do not recommend Phase 8.4 candidate model bake-off until Phase 8.3 has chronological baseline reports.
