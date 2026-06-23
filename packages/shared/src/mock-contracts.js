/**
 * Mock Boundary Contracts for Miraichi Phase 2.
 * Fully competition-agnostic. No business logic.
 */

export const MOCK_MATCHES = [
  {
    id: "match_2026_001",
    competitionId: "comp_international_cup_2026",
    seasonId: "season_2026",
    status: "scheduled",
    homeTeam: {
      id: "team_generic_a",
      name: "Team A"
    },
    awayTeam: {
      id: "team_generic_b",
      name: "Team B"
    },
    scheduledTime: "2026-06-25T18:00:00Z"
  },
  {
    id: "match_2026_002",
    competitionId: "comp_international_cup_2026",
    seasonId: "season_2026",
    status: "scheduled",
    homeTeam: {
      id: "team_generic_c",
      name: "Team C"
    },
    awayTeam: {
      id: "team_generic_d",
      name: "Team D"
    },
    scheduledTime: "2026-06-26T20:00:00Z"
  }
];

export const MOCK_PREDICTIONS = {
  "match_2026_001": {
    matchId: "match_2026_001",
    predictionId: "pred_2026_9999",
    generatedAt: "2026-06-23T12:00:00Z",
    predictionOutcome: "home_win",
    confidenceScore: 0.68,
    confidenceLevel: "medium",
    trace: {
      engine: "local-statistical-stub",
      version: "1.0.0-mock",
      runTimeMs: 142,
      inputVariables: {
        homeScoringAverage: 2.1,
        awayScoringAverage: 1.2,
        headToHeadRatio: 0.6
      }
    }
  },
  "match_2026_002": {
    matchId: "match_2026_002",
    predictionId: "pred_2026_9998",
    generatedAt: "2026-06-23T12:05:00Z",
    predictionOutcome: "away_win",
    confidenceScore: 0.55,
    confidenceLevel: "low",
    trace: {
      engine: "local-statistical-stub",
      version: "1.0.0-mock",
      runTimeMs: 98,
      inputVariables: {
        homeScoringAverage: 1.0,
        awayScoringAverage: 1.8,
        headToHeadRatio: 0.4
      }
    }
  }
};

export const MOCK_EXPLANATIONS = {
  "pred_2026_9999": {
    predictionId: "pred_2026_9999",
    reply: "Based on the mock historical trace, the model favors Team A due to their higher average home scoring rate (2.1 vs 1.2) and a strong head-to-head record.",
    trace: {
      llmProvider: "mock-local-llm",
      modelName: "mock-instruct-v1",
      tokensUsed: {
        prompt: 45,
        completion: 30
      },
      refusalCheck: {
        passed: true,
        action: "reply"
      }
    }
  },
  "pred_2026_9998": {
    predictionId: "pred_2026_9998",
    reply: "Based on the mock historical trace, the model favors Team D due to their higher away scoring average (1.8 vs 1.0) and recent form trends.",
    trace: {
      llmProvider: "mock-local-llm",
      modelName: "mock-instruct-v1",
      tokensUsed: {
        prompt: 40,
        completion: 28
      },
      refusalCheck: {
        passed: true,
        action: "reply"
      }
    }
  }
};

export const MOCK_BETS = [
  {
    betId: "bet_2026_1001",
    matchId: "match_2026_001",
    predictionId: "pred_2026_9999",
    amount: 100.0,
    selectedMarket: "home_win",
    placedOdds: 1.95,
    status: "placed",
    placedAt: "2026-06-23T14:30:00Z"
  }
];

export const MOCK_FEED = {
  feedTimestamp: "2026-06-23T18:00:00Z",
  data: [
    {
      provider_fixture_id: "prov_9812",
      league_generic_name: "International Tournament",
      utc_kickoff: "2026-06-25T18:00:00Z",
      competitor_1: "Team A",
      competitor_2: "Team B"
    }
  ]
};
