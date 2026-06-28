/**
 * Ingestion Validator checks match and market normalized schemas.
 * Fully competition-agnostic. No business logic.
 */

type LooseMatch = {
  id?: unknown;
  competitionId?: unknown;
  seasonId?: unknown;
  homeTeamId?: unknown;
  awayTeamId?: unknown;
  status?: unknown;
  kickoffTime?: unknown;
  scores?: {
    homeScore?: unknown;
    awayScore?: unknown;
  };
};

type LooseOutcome = {
  outcomeId?: unknown;
  name?: unknown;
  odds?: unknown;
};

type LooseMarket = {
  id?: unknown;
  matchId?: unknown;
  marketName?: unknown;
  outcomes?: unknown[];
};

export function validateMatch(matchInput: unknown) {
  const errors: string[] = [];
  const match = (matchInput || {}) as LooseMatch;
  
  if (!match.id) errors.push("Missing id");
  if (!match.competitionId) errors.push("Missing competitionId");
  if (!match.seasonId) errors.push("Missing seasonId");
  if (!match.homeTeamId) errors.push("Missing homeTeamId");
  if (!match.awayTeamId) errors.push("Missing awayTeamId");
  if (!match.status) errors.push("Missing status");
  if (!match.kickoffTime) errors.push("Missing kickoffTime");

  if (match.status === "completed") {
    const scores = match.scores;
    if (!scores) {
      errors.push("Missing scores object for completed match");
    } else {
      if (typeof scores.homeScore !== "number" || scores.homeScore < 0) {
        errors.push("Invalid homeScore (must be non-negative number)");
      }
      if (typeof scores.awayScore !== "number" || scores.awayScore < 0) {
        errors.push("Invalid awayScore (must be non-negative number)");
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateMarket(marketInput: unknown) {
  const errors: string[] = [];
  const market = (marketInput || {}) as LooseMarket;
  
  if (!market.id) errors.push("Missing id");
  if (!market.matchId) errors.push("Missing matchId");
  if (!market.marketName) errors.push("Missing marketName");
  
  const outcomes = market.outcomes;
  if (!outcomes || !Array.isArray(outcomes) || outcomes.length < 2) {
    errors.push("Outcomes must be an array with at least 2 elements");
  } else {
    outcomes.forEach((outcomeInput: unknown, idx: number) => {
      const outcome = (outcomeInput || {}) as LooseOutcome;
      if (!outcome.outcomeId) errors.push(`Outcome at index ${idx} missing outcomeId`);
      if (!outcome.name) errors.push(`Outcome at index ${idx} missing name`);
      if (typeof outcome.odds !== "number" || outcome.odds <= 1.0) {
        errors.push(`Outcome at index ${idx} has invalid odds: ${outcome.odds} (must be > 1.0)`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
