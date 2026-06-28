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
