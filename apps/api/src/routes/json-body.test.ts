import { describe, expect, it } from 'vitest';
import { parseJsonObjectBody, readNestedStringField, readStringField } from './json-body.js';

describe('json-body helpers', () => {
  it('parses empty request bodies as empty objects', () => {
    expect(parseJsonObjectBody('   ')).toEqual({});
  });

  it('rejects malformed JSON and non-object payloads', () => {
    expect(() => parseJsonObjectBody('{bad-json')).toThrow('Invalid JSON request body');
    expect(() => parseJsonObjectBody('[]')).toThrow('JSON request body must be an object');
  });

  it('reads string fields through unknown-safe helpers', () => {
    const payload = parseJsonObjectBody(JSON.stringify({
      matchId: 'match-alpha-001',
      trace: { workerRunId: 'run-alpha-001' }
    }));

    expect(readStringField(payload, 'matchId', 'unknown-match')).toBe('match-alpha-001');
    expect(readStringField(payload, 'missing', 'fallback')).toBe('fallback');
    expect(readNestedStringField(payload, 'trace', 'workerRunId', 'unknown-run')).toBe('run-alpha-001');
  });
});
