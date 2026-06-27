/**
 * Mock Provider Adapter mapping raw feeds into normalized contracts.
 * Fully competition-agnostic. No business logic.
 */
export class MockProviderAdapter {
  providerId: string;

  constructor() {
    this.providerId = "provider-mock-alpha";
  }

  parseMatches(rawMatches): Array<Record<string, any>> {
    if (!Array.isArray(rawMatches)) {
      throw new Error("Raw matches must be an array");
    }

    return rawMatches.map((raw) => {
      const normalized: Record<string, any> = {
        id: raw.fixture_id,
        competitionId: raw.comp_name,
        seasonId: raw.season_year,
        homeTeamId: raw.home_team_tag,
        awayTeamId: raw.away_team_tag,
        status: raw.match_status,
        kickoffTime: raw.start_utc
      };

      if (raw.venue) {
        normalized.venueName = raw.venue;
      }

      if (raw.score_result) {
        normalized.scores = {
          homeScore: raw.score_result.home,
          awayScore: raw.score_result.away
        };
      }

      return normalized;
    });
  }

  parseMarkets(rawMarkets): Array<Record<string, any>> {
    if (!Array.isArray(rawMarkets)) {
      throw new Error("Raw markets must be an array");
    }

    return rawMarkets.map((raw) => {
      return {
        id: raw.market_id,
        matchId: raw.fixture_ref,
        marketName: raw.name_type,
        providerId: this.providerId,
        updatedAt: raw.timestamp_utc,
        outcomes: raw.selections.map((sel) => ({
          outcomeId: sel.id,
          name: sel.label,
          odds: sel.odds_value
        }))
      };
    });
  }
}
