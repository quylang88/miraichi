import { describe, expect, it } from 'vitest';
import { emptyResponse, errorResponse, jsonResponse } from './web-http.js';

describe('web api http responses', () => {
  it('returns JSON with an explicit status and preserves repeated cookies', async () => {
    const response = jsonResponse({ status: 'ok' }, {
      status: 201,
      headers: { 'x-miraichi-test': 'passed' },
      cookies: ['owner=one; Path=/', 'refresh=two; Path=/']
    });

    expect(response.status).toBe(201);
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(response.headers.get('x-miraichi-test')).toBe('passed');
    expect(response.headers.getSetCookie()).toEqual([
      'owner=one; Path=/',
      'refresh=two; Path=/'
    ]);
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
  });

  it('returns a structured error without leaking unrelated details', async () => {
    const response = errorResponse(401, 'owner_auth_required', 'Authentication is required.');

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'owner_auth_required',
        message: 'Authentication is required.'
      }
    });
  });

  it('returns an empty response with explicit headers', async () => {
    const response = emptyResponse(204, {
      'cache-control': 'no-store'
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).toBe('');
  });
});
