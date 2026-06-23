/**
 * Normalized Match Data Contract Object Schema.
 * Fully competition-agnostic. No business logic.
 */
export const NORMALIZED_MATCH_CONTRACT = {
  id: "string",          // Unique ID (e.g. match-alpha-001)
  competitionId: "string", // Generic ID (e.g. competition-alpha)
  seasonId: "string",     // Generic ID (e.g. season-alpha-2026)
  homeTeamId: "string",   // Generic ID (e.g. team-alpha)
  awayTeamId: "string",   // Generic ID (e.g. team-beta)
  status: "string",       // scheduled, in_play, completed
  kickoffTime: "string",  // ISO-8601 UTC timestamp
  scores: {
    homeScore: "number",  // integer >= 0
    awayScore: "number"   // integer >= 0
  },
  venueName: "string"     // optional stadium/venue name
};
Object.freeze(NORMALIZED_MATCH_CONTRACT);
Object.freeze(NORMALIZED_MATCH_CONTRACT.scores);
