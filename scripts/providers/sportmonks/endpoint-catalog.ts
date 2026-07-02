/**
 * Sportmonks endpoint catalog.
 *
 * Each entry describes one logical endpoint or endpoint variant available
 * via the Sportmonks v3 football API.  The `capturePolicy` field controls
 * whether the endpoint is captured by default (`allowed`) or only when
 * `allowGatedEndpoints: true` is set in the config (`gated`).
 *
 * Gated families: livescores, odds, predictions, news, xg.
 * These are catalogued but blocked by default because they carry
 * prediction/odds data that is out of scope for Phase 9.
 *
 * Reference: https://docs.sportmonks.com/v3/endpoints-and-entities/endpoints
 */

export type EndpointCapturePolicy = 'allowed' | 'gated';

export interface SportmonksEndpointEntry {
  /** Stable dot-notation key used as the manifest endpointKey and raw-cache directory segment. */
  endpointKey: string;
  /** Human-readable logical grouping. One of the gated groups for risky families. */
  group: string;
  /** URL path template relative to the API base URL. `{id}` is a per-request substitution. */
  urlPath: string;
  /** Whether this endpoint is captured by default or requires explicit opt-in. */
  capturePolicy: EndpointCapturePolicy;
  /** If true, this endpoint requires a per-record ID (e.g. fixture enrichment). */
  requiresId?: boolean;
  /** Informational note about the endpoint. */
  note?: string;
}

/**
 * Build the complete Sportmonks endpoint catalog.
 *
 * Allowed families cover all reference and match-data endpoints needed for
 * the Phase 9 trial: types, states, reference data, league/season/team
 * hierarchies, fixtures, and statistics.
 *
 * Gated families (livescores, odds, predictions, news, xg) are listed so
 * future operators can opt in explicitly, but they are not captured by default.
 */
export function buildSportmonksEndpointCatalog(): SportmonksEndpointEntry[] {
  return [
    // ── Reference / lookup data ──────────────────────────────────────────────
    { endpointKey: 'types.all',       group: 'reference', urlPath: '/types',      capturePolicy: 'allowed', note: 'All entity types (e.g. event types)' },
    { endpointKey: 'states.all',      group: 'reference', urlPath: '/states',     capturePolicy: 'allowed', note: 'All fixture states' },
    { endpointKey: 'countries.all',   group: 'reference', urlPath: '/countries',  capturePolicy: 'allowed' },
    { endpointKey: 'regions.all',     group: 'reference', urlPath: '/regions',    capturePolicy: 'allowed' },
    { endpointKey: 'cities.all',      group: 'reference', urlPath: '/cities',     capturePolicy: 'allowed' },
    { endpointKey: 'venues.all',      group: 'venues',    urlPath: '/venues',     capturePolicy: 'allowed' },
    { endpointKey: 'referees.all',    group: 'referees',  urlPath: '/referees',   capturePolicy: 'allowed' },
    { endpointKey: 'coaches.all',     group: 'coaches',   urlPath: '/coaches',    capturePolicy: 'allowed' },

    // ── Competitions / seasons ────────────────────────────────────────────────
    { endpointKey: 'leagues.all',     group: 'leagues',   urlPath: '/leagues',    capturePolicy: 'allowed' },
    { endpointKey: 'seasons.all',     group: 'seasons',   urlPath: '/seasons',    capturePolicy: 'allowed' },
    { endpointKey: 'stages.all',      group: 'stages',    urlPath: '/stages',     capturePolicy: 'allowed' },
    { endpointKey: 'rounds.all',      group: 'rounds',    urlPath: '/rounds',     capturePolicy: 'allowed' },
    { endpointKey: 'groups.all',      group: 'groups',    urlPath: '/groups',     capturePolicy: 'allowed' },
    { endpointKey: 'schedules.all',   group: 'schedules', urlPath: '/schedules',  capturePolicy: 'allowed' },
    { endpointKey: 'standings.all',   group: 'standings', urlPath: '/standings',  capturePolicy: 'allowed' },

    // ── Teams / players ───────────────────────────────────────────────────────
    { endpointKey: 'teams.all',       group: 'teams',   urlPath: '/teams',    capturePolicy: 'allowed' },
    { endpointKey: 'players.all',     group: 'players', urlPath: '/players',  capturePolicy: 'allowed' },
    { endpointKey: 'squads.all',      group: 'squads',  urlPath: '/squads',   capturePolicy: 'allowed' },
    { endpointKey: 'transfers.all',   group: 'transfers', urlPath: '/transfers', capturePolicy: 'allowed' },
    { endpointKey: 'sidelined.all',   group: 'sidelined', urlPath: '/sidelined', capturePolicy: 'allowed' },

    // ── Fixtures ──────────────────────────────────────────────────────────────
    { endpointKey: 'fixtures.all',         group: 'fixtures', urlPath: '/fixtures',       capturePolicy: 'allowed', note: 'Paginated fixture list' },
    { endpointKey: 'fixtures.enrichedById', group: 'fixtures', urlPath: '/fixtures/{id}', capturePolicy: 'allowed', requiresId: true, note: 'Per-fixture enrichment with includes' },

    // ── Statistics ────────────────────────────────────────────────────────────
    { endpointKey: 'statistics.fixtures',  group: 'statistics', urlPath: '/statistics/fixtures',  capturePolicy: 'allowed' },
    { endpointKey: 'statistics.teams',     group: 'statistics', urlPath: '/statistics/teams',     capturePolicy: 'allowed' },
    { endpointKey: 'statistics.players',   group: 'statistics', urlPath: '/statistics/players',   capturePolicy: 'allowed' },
    { endpointKey: 'statistics.seasons',   group: 'statistics', urlPath: '/statistics/seasons',   capturePolicy: 'allowed' },

    // ── Gated: livescores ─────────────────────────────────────────────────────
    { endpointKey: 'livescores.all',      group: 'livescores', urlPath: '/livescores',               capturePolicy: 'gated', note: 'Live match data — out of scope for Phase 9' },

    // ── Gated: odds ───────────────────────────────────────────────────────────
    { endpointKey: 'odds.prematch',       group: 'odds',       urlPath: '/odds/pre-match',           capturePolicy: 'gated', note: 'Pre-match odds — blocked without ADR approval' },

    // ── Gated: predictions ────────────────────────────────────────────────────
    { endpointKey: 'predictions.probabilities', group: 'predictions', urlPath: '/predictions/probabilities', capturePolicy: 'gated', note: 'Match prediction probabilities — blocked until Phase 10' },

    // ── Gated: news ───────────────────────────────────────────────────────────
    { endpointKey: 'news.prematch',       group: 'news',       urlPath: '/news/pre-match',           capturePolicy: 'gated', note: 'Pre-match news articles' },

    // ── Gated: xg ─────────────────────────────────────────────────────────────
    { endpointKey: 'xg.fixtures',         group: 'xg',         urlPath: '/expected/goals',           capturePolicy: 'gated', note: 'Expected goals data — blocked until Phase 10' }
  ];
}
