import { describe, expect, it } from 'vitest';
import {
  normalizeNodePostgresParameters,
  postgresJson
} from './postgres-parameters.js';

describe('Postgres JSON parameters', () => {
  it('serializes only branded JSON parameters for node-postgres', () => {
    const payload = { state: 'ready', values: [1, 2] };
    expect(normalizeNodePostgresParameters([
      postgresJson(payload),
      '{"legitimate":"text"}',
      7
    ])).toEqual([
      JSON.stringify(payload),
      '{"legitimate":"text"}',
      7
    ]);
  });
});
