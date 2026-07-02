// Endpoint catalog tests are co-located in config.test.ts.
// This file ensures the endpoint-catalog module is independently importable.
import { describe, expect, it } from 'vitest';
import { buildSportmonksEndpointCatalog } from './endpoint-catalog.js';

describe('buildSportmonksEndpointCatalog', () => {
  it('exports a callable function that returns an array', () => {
    expect(Array.isArray(buildSportmonksEndpointCatalog())).toBe(true);
  });
});
