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
      allowGatedEndpoints: false
    });
  });
});

describe('sportmonks endpoint catalog', () => {
  it('contains broad allowed endpoint families and gated risky families', () => {
    const catalog = buildSportmonksEndpointCatalog();
    expect(catalog.map((item) => item.endpointKey)).toEqual(expect.arrayContaining([
      'types.all',
      'states.all',
      'countries.all',
      'leagues.all',
      'seasons.all',
      'teams.all',
      'players.all',
      'venues.all',
      'fixtures.all',
      'fixtures.enrichedById',
      'standings.all'
    ]));
    expect(catalog.filter((item) => item.capturePolicy === 'gated').map((item) => item.group).sort()).toEqual([
      'livescores',
      'news',
      'odds',
      'predictions',
      'xg'
    ]);
  });
});
