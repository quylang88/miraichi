// Endpoint catalog tests are co-located in config.test.ts.
// This file ensures the endpoint-catalog module is independently importable.
import { describe, expect, it } from 'vitest';
import {
  buildOwnerApprovedNonLiveEndpointCatalog,
  buildSportmonksEndpointCatalog
} from './endpoint-catalog.js';

describe('buildSportmonksEndpointCatalog', () => {
  it('exports a callable function that returns an array', () => {
    expect(Array.isArray(buildSportmonksEndpointCatalog())).toBe(true);
  });

  it('builds an owner-approved non-live catalog with odds but without live endpoints', () => {
    const catalog = buildOwnerApprovedNonLiveEndpointCatalog();
    const keys = catalog.map((item) => item.endpointKey);

    expect(keys).toEqual(expect.arrayContaining([
      'continents.all',
      'filters.entityAll',
      'odds.prematch.all',
      'odds.prematch.latest',
      'odds.premium.all',
      'markets.all',
      'markets.premiumAll',
      'bookmakers.all',
      'bookmakers.premiumAll',
      'predictions.probabilities',
      'expected.fixtures',
      'expected.lineups',
      'news.prematch',
      'news.prematch.upcoming',
      'transferRumours.all',
      'teamOfWeek.all'
    ]));
    expect(keys).not.toEqual(expect.arrayContaining([
      'groups.all',
      'schedules.all',
      'squads.all',
      'sidelined.all',
      'statistics.fixtures',
      'statistics.teams',
      'statistics.players',
      'statistics.seasons',
      'expected.teams',
      'expected.players'
    ]));
    expect(catalog.some((item) =>
      item.group === 'livescores'
      || item.endpointKey.toLowerCase().includes('live')
      || item.urlPath.toLowerCase().includes('inplay')
    )).toBe(false);
  });

  it('uses the correct Sportmonks API component bases for core and odds endpoints', () => {
    const catalogByKey = new Map(buildSportmonksEndpointCatalog().map((item) => [item.endpointKey, item]));

    expect(catalogByKey.get('countries.all')?.urlPath).toBe('https://api.sportmonks.com/v3/core/countries');
    expect(catalogByKey.get('regions.all')?.urlPath).toBe('https://api.sportmonks.com/v3/core/regions');
    expect(catalogByKey.get('cities.all')?.urlPath).toBe('https://api.sportmonks.com/v3/core/cities');
    expect(catalogByKey.get('types.all')?.urlPath).toBe('https://api.sportmonks.com/v3/core/types');
    expect(catalogByKey.get('continents.all')?.urlPath).toBe('https://api.sportmonks.com/v3/core/continents');
    expect(catalogByKey.get('filters.entityAll')?.urlPath).toBe('https://api.sportmonks.com/v3/my/filters/entity');
    expect(catalogByKey.get('timezones.all')?.urlPath).toBe('https://api.sportmonks.com/v3/core/timezones');

    expect(catalogByKey.get('bookmakers.all')?.urlPath).toBe('https://api.sportmonks.com/v3/odds/bookmakers');
    expect(catalogByKey.get('bookmakers.premiumAll')?.urlPath).toBe('https://api.sportmonks.com/v3/odds/bookmakers/premium');
    expect(catalogByKey.get('markets.all')?.urlPath).toBe('https://api.sportmonks.com/v3/odds/markets');
    expect(catalogByKey.get('markets.premiumAll')?.urlPath).toBe('https://api.sportmonks.com/v3/odds/markets/premium');

    expect(catalogByKey.get('odds.premium.all')?.urlPath).toBe('/odds/premium');
    expect(catalogByKey.has('odds.premium.latest')).toBe(false);
    expect(catalogByKey.get('expected.fixtures')?.urlPath).toBe('/expected/fixtures');
    expect(catalogByKey.get('expected.lineups')?.urlPath).toBe('/expected/lineups');
    expect(catalogByKey.get('transferRumours.all')?.urlPath).toBe('/transfer-rumours');
    expect(catalogByKey.get('teamOfWeek.all')?.urlPath).toBe('/team-of-the-week');
  });
});
