import { describe, expect, it } from 'vitest';
import { parseSportmonksExpectedCaptureArgs } from './capture-sportmonks-expected-data.js';

describe('sportmonks expected capture CLI args', () => {
  it('parses endpoint, include, and pagination controls', () => {
    expect(parseSportmonksExpectedCaptureArgs([
      '--endpoint=expected.fixtures',
      '--endpoint=expected.lineups',
      '--max-pages=25',
      '--no-include-relations'
    ])).toEqual({
      endpointKeys: ['expected.fixtures', 'expected.lineups'],
      includeRelations: false,
      maxPagesPerEndpoint: 25
    });
  });
});
