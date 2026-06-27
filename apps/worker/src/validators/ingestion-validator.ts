/**
 * Ingestion Validator checks match and market normalized schemas.
 * Fully competition-agnostic. No business logic.
 */

export function validateMatch(match) {
  const errors: string[] = [];
  if (!match.id) errors.push("Missing id");
  if (!match.competitionId) errors.push("Missing competitionId");
  if (!match.seasonId) errors.push("Missing seasonId");
  if (!match.homeTeamId) errors.push("Missing homeTeamId");
  if (!match.awayTeamId) errors.push("Missing awayTeamId");
  if (!match.status) errors.push("Missing status");
  if (!match.kickoffTime) errors.push("Missing kickoffTime");

  if (match.status === "completed") {
    if (!match.scores) {
      errors.push("Missing scores object for completed match");
    } else {
      if (typeof match.scores.homeScore !== "number" || match.scores.homeScore < 0) {
        errors.push("Invalid homeScore (must be non-negative number)");
      }
      if (typeof match.scores.awayScore !== "number" || match.scores.awayScore < 0) {
        errors.push("Invalid awayScore (must be non-negative number)");
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateMarket(market) {
  const errors: string[] = [];
  if (!market.id) errors.push("Missing id");
  if (!market.matchId) errors.push("Missing matchId");
  if (!market.marketName) errors.push("Missing marketName");
  if (!market.outcomes || !Array.isArray(market.outcomes) || market.outcomes.length < 2) {
    errors.push("Outcomes must be an array with at least 2 elements");
  } else {
    market.outcomes.forEach((outcome, idx) => {
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
