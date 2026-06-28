/**
 * Mock Provider Adapter mapping raw feeds into normalized contracts.
 * Fully competition-agnostic. No business logic.
 */
import type { NormalizedMarket, NormalizedMatch, NormalizedMatchStatus } from '../../../../packages/shared/src/contracts/index.js';

type RawProviderMatch = {
  fixture_id: string;
  comp_name: string;
  season_year: string;
  home_team_tag: string;
  away_team_tag: string;
  match_status: NormalizedMatchStatus;
  start_utc: string;
  venue?: string;
  score_result?: {
    home: number;
    away: number;
  };
};

type RawProviderMarketSelection = {
  id: string;
  label: string;
  odds_value: number;
};

type RawProviderMarket = {
  market_id: string;
  fixture_ref: string;
  name_type: string;
  timestamp_utc: string;
  selections: RawProviderMarketSelection[];
};

export class MockProviderAdapter {
  providerId = 'provider-mock-alpha';

  parseMatches(rawMatches: RawProviderMatch[]): NormalizedMatch[] {
    if (!Array.isArray(rawMatches)) {
      throw new Error('Raw matches must be an array');
    }

    return rawMatches.map((raw) => {
      const normalized: NormalizedMatch = {
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

  parseMarkets(rawMarkets: RawProviderMarket[]): NormalizedMarket[] {
    if (!Array.isArray(rawMarkets)) {
      throw new Error('Raw markets must be an array');
    }

    return rawMarkets.map((raw) => ({
      id: raw.market_id,
      matchId: raw.fixture_ref,
      marketName: raw.name_type,
      providerId: this.providerId,
      updatedAt: raw.timestamp_utc,
      outcomes: raw.selections.map((selection) => ({
        outcomeId: selection.id,
        name: selection.label,
        odds: selection.odds_value
      }))
    }));
  }
}
