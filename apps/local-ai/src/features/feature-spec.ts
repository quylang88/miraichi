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
  ] as readonly FeatureDefinition[])
});

export function getFeatureSpec(): FeatureSpec {
  return APPROVED_FEATURE_SPEC;
}

export function listFeatureNames(spec: FeatureSpec): string[] {
  return spec.features.map((feature) => feature.name);
}
