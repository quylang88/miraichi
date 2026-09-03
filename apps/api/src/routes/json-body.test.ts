import { describe, expect, it } from 'vitest';
import {
  JsonBodyError,
  parseJsonObjectBody,
  readJsonObjectRequest,
  readNestedStringField,
  readStringField
} from './json-body.js';

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

  it('reads a Web Request JSON object', async () => {
    const request = new Request('https://miraichi.test/api/v1/bets', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ betId: 'bet-alpha-001' })
    });

    await expect(readJsonObjectRequest(request)).resolves.toEqual({ betId: 'bet-alpha-001' });
  });

  it('rejects an explicitly unsupported request media type', async () => {
    const request = new Request('https://miraichi.test/api/v1/bets', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: '{}'
    });

    await expect(readJsonObjectRequest(request)).rejects.toMatchObject({
      code: 'unsupported_media_type',
      status: 415
    } satisfies Partial<JsonBodyError>);
  });

  it('rejects a request body above the configured byte ceiling before parsing', async () => {
    const request = new Request('https://miraichi.test/api/v1/bets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: 'too-large' })
    });

    await expect(readJsonObjectRequest(request, { maxBytes: 8 })).rejects.toMatchObject({
      code: 'request_body_too_large',
      status: 413
    } satisfies Partial<JsonBodyError>);
  });

  it('classifies malformed and non-object Web JSON bodies', async () => {
    const malformed = new Request('https://miraichi.test/api/v1/bets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{bad-json'
    });
    const array = new Request('https://miraichi.test/api/v1/bets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '[]'
    });

    await expect(readJsonObjectRequest(malformed)).rejects.toMatchObject({
      code: 'invalid_json_body',
      status: 400
    } satisfies Partial<JsonBodyError>);
    await expect(readJsonObjectRequest(array)).rejects.toMatchObject({
      code: 'json_object_required',
      status: 400
    } satisfies Partial<JsonBodyError>);
  });
});
