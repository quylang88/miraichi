/**
 * Mock API Client for the frontend.
 * Relays web client requests to the API Mediation Gateway.
 */

const API_BASE_URL = 'http://localhost:3001';

export async function getMatches() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/matches`);
    if (!res.ok) throw new Error(`HTTP status ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[Mock Client] API Mediation Gateway offline. Using fallback mock.', err);
    return [
      {
        id: "match_2026_001",
        competitionId: "comp_international_cup_2026",
        seasonId: "season_2026",
        status: "scheduled",
        homeTeam: { id: "team_generic_a", name: "Team A" },
        awayTeam: { id: "team_generic_b", name: "Team B" },
        scheduledTime: "2026-06-25T18:00:00Z"
      }
    ];
  }
}

export async function getPrediction(matchId: string) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/predictions?matchId=${matchId}`);
    if (!res.ok) throw new Error(`HTTP status ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[Mock Client] API Mediation Gateway offline. Using fallback mock.', err);
    return {
      matchId,
      predictionId: "pred_2026_9999",
      generatedAt: new Date().toISOString(),
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
    };
  }
}

export async function sendChatQuery(predictionId: string, message: string) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ predictionId, message })
    });
    if (!res.ok) throw new Error(`HTTP status ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[Mock Client] API Mediation Gateway offline. Using fallback mock.', err);
    return {
      predictionId,
      reply: "Based on the mock historical trace, the model favors Team A due to their higher average home scoring rate (2.1 vs 1.2) and a strong head-to-head record.",
      trace: {
        llmProvider: "mock-local-llm",
        modelName: "mock-instruct-v1",
        tokensUsed: { prompt: 45, completion: 30 },
        refusalCheck: { passed: true, action: "reply" }
      }
    };
  }
}

export async function getBetHistory() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/bets`);
    if (!res.ok) throw new Error(`HTTP status ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[Mock Client] API Mediation Gateway offline. Using fallback mock.', err);
    return [
      {
        betId: "bet_2026_1001",
        matchId: "match_2026_001",
        predictionId: "pred_2026_9999",
        amount: 100.0,
        selectedMarket: "home_win",
        placedOdds: 1.95,
        status: "placed",
        placedAt: new Date().toISOString()
      }
    ];
  }
}

export async function getMockPrediction(inputCandidate: Record<string, unknown>) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/mock/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inputCandidate)
    });
    if (!res.ok) throw new Error(`HTTP status ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[Mock Client] API Gateway offline. Using mock predict fallback.', err);
    return {
      predictionId: "pred-fallback-offline",
      matchId: typeof inputCandidate.matchId === 'string' ? inputCandidate.matchId : "match-alpha-001",
      competitionId: typeof inputCandidate.competitionId === 'string' ? inputCandidate.competitionId : "competition-alpha",
      seasonId: typeof inputCandidate.seasonId === 'string' ? inputCandidate.seasonId : "season-alpha-2026",
      generatedAt: new Date().toISOString(),
      engineMode: "mock",
      predictionAvailable: false,
      confidenceLabel: "not_available",
      outputSummary: "No owner-approved prediction algorithm is active.",
      trace: {
        inputCandidateId: typeof inputCandidate.inputCandidateId === 'string' ? inputCandidate.inputCandidateId : "input-candidate-alpha-001",
        workerRunId: "run-alpha-001",
        sourceProviderId: "provider-mock-alpha",
        engineVersion: "1.0.0-mock"
      },
      warnings: ["api_gateway_offline_fallback"]
    };
  }
}

export async function getMockExplanation(envelope: unknown) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/mock/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(envelope)
    });
    if (!res.ok) throw new Error(`HTTP status ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[Mock Client] API Gateway offline. Using mock explain fallback.', err);
    const env = envelope as Record<string, unknown>;
    return {
      predictionId: typeof env.predictionId === 'string' ? env.predictionId : 'unknown',
      reply: env.trace && (env.trace as Record<string, unknown>).llmProvider === 'openai' 
        ? "AI Explanation: This is a fallback explanation because the API gateway is offline."
        : `Explanation fallback for match ${(env as Record<string, unknown>).matchId}`,
      trace: { clientFallback: "active" }
    };
  }
}
