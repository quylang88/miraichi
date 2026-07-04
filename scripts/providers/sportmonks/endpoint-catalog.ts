/**
 * Sportmonks endpoint catalog.
 *
 * Each entry describes one logical endpoint or endpoint variant available
 * via the Sportmonks v3 football API.  The `capturePolicy` field is now a
 * risk label only; the capture runner captures every non-live endpoint by
 * default. Live/in-play endpoints require `SPORTMONKS_ALLOW_LIVE_ENDPOINTS=true`.
 *
 * Risk-labelled families: livescores, odds, predictions, news, xG, and
 * related premium feeds. Raw archival is allowed for non-live endpoints;
 * formulas, recommendations, and runtime betting surfaces remain out of scope.
 *
 * Owner override on 2026-07-03: raw non-live odds/prediction/news/xG capture
 * is allowed for trial archiving. Live/in-play capture remains excluded unless
 * explicitly enabled.
 *
 * Reference: https://docs.sportmonks.com/v3/endpoints-and-entities/endpoints
 */

export type EndpointCapturePolicy = 'allowed' | 'gated';

export interface SportmonksEndpointEntry {
  /** Stable dot-notation key used as the manifest endpointKey and raw-cache directory segment. */
  endpointKey: string;
  /** Human-readable logical grouping. One of the gated groups for risky families. */
  group: string;
  /** URL path template relative to the football API base URL, or an absolute Sportmonks component URL. `{id}` is a per-request substitution. */
  urlPath: string;
  /** Query values that should be present on the first page request. Pagination controls are added by the capture runner. */
  defaultQuery?: Record<string, string>;
  /** Whether this endpoint is captured by default or requires explicit opt-in. */
  capturePolicy: EndpointCapturePolicy;
  /** If true, this endpoint requires a per-record ID (e.g. fixture enrichment). */
  requiresId?: boolean;
  /** If true, this endpoint is live/in-play and must stay excluded from Phase 9 trial capture. */
  isLive?: boolean;
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
 * Live endpoints are marked with `isLive` so the runner can exclude them while
 * still collecting every non-live endpoint family.
 */
export function buildSportmonksEndpointCatalog(): SportmonksEndpointEntry[] {
  return [
    // ── Reference / lookup data ──────────────────────────────────────────────
    { endpointKey: 'types.all',       group: 'reference', urlPath: 'https://api.sportmonks.com/v3/core/types',      capturePolicy: 'allowed', note: 'All entity types (e.g. event types)' },
    { endpointKey: 'continents.all',  group: 'reference', urlPath: 'https://api.sportmonks.com/v3/core/continents', capturePolicy: 'allowed' },
    { endpointKey: 'states.all',      group: 'reference', urlPath: '/states',     capturePolicy: 'allowed', note: 'All fixture states' },
    { endpointKey: 'countries.all',   group: 'reference', urlPath: 'https://api.sportmonks.com/v3/core/countries',  capturePolicy: 'allowed' },
    { endpointKey: 'regions.all',     group: 'reference', urlPath: 'https://api.sportmonks.com/v3/core/regions',    capturePolicy: 'allowed' },
    { endpointKey: 'cities.all',      group: 'reference', urlPath: 'https://api.sportmonks.com/v3/core/cities',     capturePolicy: 'allowed' },
    { endpointKey: 'filters.entityAll', group: 'reference', urlPath: 'https://api.sportmonks.com/v3/my/filters/entity', capturePolicy: 'allowed' },
    { endpointKey: 'timezones.all',   group: 'reference', urlPath: 'https://api.sportmonks.com/v3/core/timezones',  capturePolicy: 'allowed' },
    { endpointKey: 'venues.all',      group: 'venues',    urlPath: '/venues',     capturePolicy: 'allowed' },
    { endpointKey: 'referees.all',    group: 'referees',  urlPath: '/referees',   capturePolicy: 'allowed' },
    { endpointKey: 'coaches.all',     group: 'coaches',   urlPath: '/coaches',    capturePolicy: 'allowed' },

    // ── Competitions / seasons ────────────────────────────────────────────────
    { endpointKey: 'leagues.all',     group: 'leagues',   urlPath: '/leagues',    capturePolicy: 'allowed' },
    { endpointKey: 'seasons.all',     group: 'seasons',   urlPath: '/seasons',    capturePolicy: 'allowed' },
    { endpointKey: 'stages.all',      group: 'stages',    urlPath: '/stages',     capturePolicy: 'allowed' },
    { endpointKey: 'rounds.all',      group: 'rounds',    urlPath: '/rounds',     capturePolicy: 'allowed' },
    { endpointKey: 'standings.all',   group: 'standings', urlPath: '/standings',  capturePolicy: 'allowed' },

    // ── Teams / players ───────────────────────────────────────────────────────
    { endpointKey: 'teams.all',       group: 'teams',   urlPath: '/teams',    capturePolicy: 'allowed' },
    { endpointKey: 'players.all',     group: 'players', urlPath: '/players',  capturePolicy: 'allowed' },
    { endpointKey: 'players.latestUpdated', group: 'players', urlPath: '/players/latest', capturePolicy: 'allowed', note: 'Recently updated players; non-live incremental feed' },
    { endpointKey: 'transfers.all',   group: 'transfers', urlPath: '/transfers', capturePolicy: 'allowed' },
    { endpointKey: 'transferRumours.all', group: 'transfer-rumours', urlPath: '/transfer-rumours', capturePolicy: 'gated', note: 'Transfer rumours raw payloads only; add-on dependent' },

    // ── Fixtures ──────────────────────────────────────────────────────────────
    { endpointKey: 'fixtures.all',         group: 'fixtures', urlPath: '/fixtures',       capturePolicy: 'allowed', note: 'Paginated fixture list' },
    { endpointKey: 'fixtures.latestUpdated', group: 'fixtures', urlPath: '/fixtures/latest', capturePolicy: 'allowed', note: 'Recently updated fixtures; non-live incremental feed' },
    { endpointKey: 'fixtures.enrichedById', group: 'fixtures', urlPath: '/fixtures/{id}', capturePolicy: 'allowed', requiresId: true, note: 'Per-fixture enrichment with includes' },

    // ── Gated: livescores ─────────────────────────────────────────────────────
    { endpointKey: 'livescores.all',      group: 'livescores', urlPath: '/livescores',               capturePolicy: 'gated', isLive: true, note: 'Live match data — out of scope for Phase 9' },

    // ── Gated: odds ───────────────────────────────────────────────────────────
    { endpointKey: 'bookmakers.all',        group: 'odds', urlPath: 'https://api.sportmonks.com/v3/odds/bookmakers',         capturePolicy: 'gated', note: 'Bookmaker reference data for raw odds payloads' },
    { endpointKey: 'bookmakers.premiumAll', group: 'odds', urlPath: 'https://api.sportmonks.com/v3/odds/bookmakers/premium', capturePolicy: 'gated', note: 'Premium bookmaker reference data' },
    { endpointKey: 'markets.all',           group: 'odds', urlPath: 'https://api.sportmonks.com/v3/odds/markets',            capturePolicy: 'gated', note: 'Market reference data for raw odds payloads' },
    { endpointKey: 'markets.premiumAll',    group: 'odds', urlPath: 'https://api.sportmonks.com/v3/odds/markets/premium',    capturePolicy: 'gated', note: 'Premium market reference data' },
    { endpointKey: 'odds.prematch.all',     group: 'odds', urlPath: '/odds/pre-match',         capturePolicy: 'gated', note: 'Pre-match standard odds raw payloads only' },
    { endpointKey: 'odds.prematch.latest',  group: 'odds', urlPath: '/odds/pre-match/latest',  capturePolicy: 'gated', note: 'Latest pre-match standard odds raw payloads only' },
    { endpointKey: 'odds.premium.all',      group: 'odds', urlPath: '/odds/premium',           capturePolicy: 'gated', note: 'Premium odds raw payloads only; access may require Sportmonks Premium Odds add-on' },
    { endpointKey: 'odds.inplay.all',       group: 'odds', urlPath: '/odds/inplay',            capturePolicy: 'gated', isLive: true, note: 'In-play/live odds — explicitly excluded' },

    // ── Gated: predictions ────────────────────────────────────────────────────
    { endpointKey: 'predictions.probabilities', group: 'predictions', urlPath: '/predictions/probabilities', capturePolicy: 'gated', note: 'Raw provider probabilities only; no local formula or recommendation' },
    { endpointKey: 'predictions.valueBets',     group: 'predictions', urlPath: '/predictions/value-bets',    capturePolicy: 'gated', note: 'Raw provider value-bet feed only; no recommendation surface' },

    // ── Gated: news ───────────────────────────────────────────────────────────
    { endpointKey: 'news.prematch',       group: 'news',       urlPath: '/news/pre-match',           capturePolicy: 'gated', note: 'Pre-match news articles' },
    { endpointKey: 'news.prematch.upcoming', group: 'news',    urlPath: '/news/pre-match/upcoming',  capturePolicy: 'gated', note: 'Pre-match news for upcoming fixtures' },
    { endpointKey: 'news.postmatch',      group: 'news',       urlPath: '/news/post-match',          capturePolicy: 'gated', note: 'Post-match news articles' },

    // ── Gated: xg ─────────────────────────────────────────────────────────────
    { endpointKey: 'expected.fixtures',   group: 'xg',         urlPath: '/expected/fixtures',        capturePolicy: 'gated', note: 'Expected-goals fixture data raw payloads only' },
    { endpointKey: 'expected.lineups',    group: 'xg',         urlPath: '/expected/lineups',         capturePolicy: 'gated', note: 'Expected-goals lineup/player data raw payloads only' },

    // ── Additional non-live information families ──────────────────────────────
    { endpointKey: 'commentaries.all',    group: 'commentaries', urlPath: '/commentaries',           capturePolicy: 'gated', note: 'Match commentaries, raw only' },
    { endpointKey: 'matchFacts.all',      group: 'match-facts',  urlPath: '/match-facts',            capturePolicy: 'gated', note: 'Match facts, raw only' },
    { endpointKey: 'rankings.teams',      group: 'rankings',     urlPath: '/team-rankings',          capturePolicy: 'gated', note: 'Team rankings, raw only' },
    { endpointKey: 'teamOfWeek.all',      group: 'team-of-week', urlPath: '/team-of-the-week',       capturePolicy: 'gated', note: 'Team of the week raw payloads only' },
    { endpointKey: 'tvStations.all',      group: 'tv',           urlPath: '/tv-stations',            capturePolicy: 'gated', note: 'TV station reference data' },
    { endpointKey: 'rivals.all',          group: 'rivals',       urlPath: '/rivals',                 capturePolicy: 'gated', note: 'Rival reference data' }
  ];
}

export function buildOwnerApprovedNonLiveEndpointCatalog(): SportmonksEndpointEntry[] {
  return buildSportmonksEndpointCatalog().filter((entry) => entry.isLive !== true);
}
