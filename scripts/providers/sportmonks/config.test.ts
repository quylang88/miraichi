import { describe, expect, it } from 'vitest';
import { readSportmonksCaptureConfig } from './config.js';
import { buildSportmonksEndpointCatalog } from './endpoint-catalog.js';

describe('sportmonks provider config', () => {
  it('requires a token but keeps root provider-neutral', () => {
    expect(() => readSportmonksCaptureConfig({})).toThrow('SPORTMONKS_API_TOKEN is required');
    expect(readSportmonksCaptureConfig({
      SPORTMONKS_API_TOKEN: 'token',
      PROVIDER_CAPTURE_ROOT: 'apps/api/data'
    })).toMatchObject({
      provider: 'sportmonks',
      captureRoot: 'apps/api/data',
      allowLiveEndpoints: false
    });
  });
});

describe('sportmonks endpoint catalog', () => {
  it('contains broad endpoint families and marks only live feeds as live', () => {
    const catalog = buildSportmonksEndpointCatalog();
    expect(catalog.map((item) => item.endpointKey)).toEqual(expect.arrayContaining([
      'types.all',
      'continents.all',
      'states.all',
      'countries.all',
      'leagues.all',
      'seasons.all',
      'teams.all',
      'players.all',
      'venues.all',
      'fixtures.all',
      'fixtures.enrichedById',
      'standings.all',
      'fixtures.latestUpdated',
      'players.latestUpdated',
      'odds.prematch.all',
      'predictions.probabilities',
      'news.prematch',
      'news.prematch.upcoming',
      'expected.fixtures',
      'expected.lineups',
      'transferRumours.all',
      'teamOfWeek.all'
    ]));
    expect(catalog.filter((item) => item.isLive === true).map((item) => item.endpointKey).sort()).toEqual([
      'livescores.all',
      'odds.inplay.all'
    ]);
  });
});
