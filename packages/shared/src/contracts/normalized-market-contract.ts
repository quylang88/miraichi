/**
 * Normalized Market Data Contract Object Schema.
 * Fully competition-agnostic. No business logic.
 */

export type NormalizedMarketOutcome = {
  outcomeId: string;
  name: string;
  odds: number;
};

export type NormalizedMarket = {
  id: string;
  matchId: string;
  marketName: string;
  providerId: string;
  updatedAt: string;
  outcomes: NormalizedMarketOutcome[];
};

export const NORMALIZED_MARKET_CONTRACT = {
  id: "string",         // Unique ID (e.g. market-alpha-001)
  matchId: "string",    // Target match identifier (e.g. match-alpha-001)
  marketName: "string", // Classification (e.g. 1X2, over_under_2.5)
  providerId: "string", // Source tracker (e.g. provider-mock-alpha)
  updatedAt: "string",  // ISO-8601 UTC timestamp
  outcomes: [
    {
      outcomeId: "string", // Option identifier
      name: "string",      // Choice descriptor (home, draw, away)
      odds: "number"       // strictly positive decimal float > 1.0
    }
  ]
};
Object.freeze(NORMALIZED_MARKET_CONTRACT);
