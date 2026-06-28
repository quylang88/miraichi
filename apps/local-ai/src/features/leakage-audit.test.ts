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
