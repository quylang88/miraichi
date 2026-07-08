import { describe, expect, it, vi } from 'vitest';
import {
  createSportmonksClient,
  parseSportmonksRateLimit,
  type SportmonksHttpResponse
} from './client.js';

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): SportmonksHttpResponse {
  return {
    status,
    headers: {
      get(name: string) {
        return headers[name.toLowerCase()] ?? null;
      }
    },
    json: async () => body,
    text: async () => JSON.stringify(body)
  };
}

describe('sportmonks http client', () => {
  it('adds the API token internally and preserves caller query params', async () => {
    const requestedUrls: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      requestedUrls.push(url);
      return jsonResponse(200, {
        data: [{ id: 1 }],
        rate_limit: {
          requested_entity: 'Fixture',
          remaining: 99,
          resets_in_seconds: 60
        }
      });
    });

    const client = createSportmonksClient({
      apiBaseUrl: 'https://api.sportmonks.com/v3/football',
      apiToken: 'secret-token',
      fetchImpl,
      wait: async () => undefined
    });

    const result = await client.get('/fixtures', { include: 'scores;participants', page: '2' });

    expect(result.ok).toBe(true);
    expect(requestedUrls).toHaveLength(1);

    const url = new URL(requestedUrls[0] ?? '');
    expect(url.pathname).toBe('/v3/football/fixtures');
    expect(url.searchParams.get('api_token')).toBe('secret-token');
    expect(url.searchParams.get('include')).toBe('scores;participants');
    expect(url.searchParams.get('page')).toBe('2');

    if (result.ok) {
      expect(result.rateLimit).toEqual({
        requestedEntity: 'Fixture',
        remaining: 99,
        resetsInSeconds: 60
      });
    }
  });

  it('uses absolute Sportmonks endpoint URLs without prefixing the football base URL', async () => {
    const requestedUrls: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      requestedUrls.push(url);
      return jsonResponse(200, { data: [{ id: 1 }] });
    });

    const client = createSportmonksClient({
      apiBaseUrl: 'https://api.sportmonks.com/v3/football',
      apiToken: 'secret-token',
      fetchImpl,
      wait: async () => undefined
    });

    await client.get('https://api.sportmonks.com/v3/odds/markets', { page: '1' });

    expect(requestedUrls).toHaveLength(1);
    const url = new URL(requestedUrls[0] ?? '');
    expect(url.origin).toBe('https://api.sportmonks.com');
    expect(url.pathname).toBe('/v3/odds/markets');
    expect(url.searchParams.get('api_token')).toBe('secret-token');
    expect(url.searchParams.get('page')).toBe('1');
  });

  it('classifies inaccessible endpoints as unavailable without leaking token details', async () => {
    const client = createSportmonksClient({
      apiBaseUrl: 'https://api.sportmonks.com/v3/football',
      apiToken: 'secret-token',
      fetchImpl: async () => jsonResponse(403, { message: 'Forbidden' }),
      wait: async () => undefined
    });

    const result = await client.get('/fixtures');

    expect(result).toMatchObject({
      ok: false,
      status: 'unavailable',
      statusCode: 403
    });
    if (!result.ok) {
      expect(result.message).not.toContain('secret-token');
    }
  });

  it('classifies rate limiting separately from permanent endpoint unavailability', async () => {
    const client = createSportmonksClient({
      apiBaseUrl: 'https://api.sportmonks.com/v3/football',
      apiToken: 'secret-token',
      fetchImpl: async () => jsonResponse(429, { message: 'Too Many Requests' }, { 'retry-after': '30' }),
      wait: async () => undefined
    });

    await expect(client.get('/fixtures')).resolves.toMatchObject({
      ok: false,
      status: 'rate_limited',
      statusCode: 429,
      rateLimit: { resetsInSeconds: 30 }
    });
  });

  it('retries transient server failures before returning success', async () => {
    const wait = vi.fn(async () => undefined);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(502, { message: 'Bad Gateway' }))
      .mockResolvedValueOnce(jsonResponse(503, { message: 'Service Unavailable' }))
      .mockResolvedValueOnce(jsonResponse(200, { data: [{ id: 1 }] }));

    const client = createSportmonksClient({
      apiBaseUrl: 'https://api.sportmonks.com/v3/football',
      apiToken: 'secret-token',
      fetchImpl,
      wait
    });

    await expect(client.get('/fixtures')).resolves.toMatchObject({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledTimes(2);
  });

  it('detects subscription errors disguised as 200 OK and classifies them as unavailable', async () => {
    const subscriptionErrorBody = {
      message: "No result(s) found matching your request. Either the query did not return any results or you don't have access to it via your current subscription."
    };

    const client = createSportmonksClient({
      apiBaseUrl: 'https://api.sportmonks.com/v3/football',
      apiToken: 'secret-token',
      fetchImpl: async () => jsonResponse(200, subscriptionErrorBody),
      wait: async () => undefined
    });

    const result = await client.get('/fixtures');

    expect(result).toMatchObject({
      ok: false,
      status: 'unavailable',
      statusCode: 403,
      message: expect.stringContaining('subscription')
    });
  });

  it('detects subscription errors nested in error object disguised as 200 OK', async () => {
    const nestedErrorBody = {
      error: {
        message: "No result(s) found matching your request. Either the query did not return any results or you don't have access to it via your current subscription."
      }
    };

    const client = createSportmonksClient({
      apiBaseUrl: 'https://api.sportmonks.com/v3/football',
      apiToken: 'secret-token',
      fetchImpl: async () => jsonResponse(200, nestedErrorBody),
      wait: async () => undefined
    });

    const result = await client.get('/fixtures');

    expect(result).toMatchObject({
      ok: false,
      status: 'unavailable',
      statusCode: 403,
      message: expect.stringContaining('subscription')
    });
  });

  it('aborts the request and retries/fails when requestTimeoutMs is exceeded', async () => {
    const wait = vi.fn(async () => undefined);
    const fetchImpl = vi.fn(async (url: string, init?: any) => {
      // Simulate a hung connection by waiting indefinitely (or a long time)
      await new Promise((resolve, reject) => {
        if (init?.signal) {
          init.signal.addEventListener('abort', () => {
            reject(new DOMException('The user aborted a request.', 'AbortError'));
          });
        }
      });
      return jsonResponse(200, { data: [] });
    });

    const client = createSportmonksClient({
      apiBaseUrl: 'https://api.sportmonks.com/v3/football',
      apiToken: 'secret-token',
      fetchImpl,
      wait,
      requestTimeoutMs: 20, // 20ms timeout for testing
      maxRetries: 1 // Only 1 retry to speed up test
    });

    const result = await client.get('/fixtures');

    expect(result.ok).toBe(false);
    expect(result.status).toBe('failed');
    expect(fetchImpl).toHaveBeenCalledTimes(2); // Initial try + 1 retry
  });

  it('parses Sportmonks rate-limit snapshots from response bodies and headers', () => {
    expect(parseSportmonksRateLimit({
      body: {
        rate_limit: {
          requested_entity: 'Team',
          remaining: 1999,
          resets_in_seconds: 3600
        }
      },
      headers: {
        get: () => null
      }
    })).toEqual({
      requestedEntity: 'Team',
      remaining: 1999,
      resetsInSeconds: 3600
    });

    expect(parseSportmonksRateLimit({
      body: {},
      headers: {
        get(name: string) {
          return name.toLowerCase() === 'retry-after' ? '15' : null;
        }
      }
    })).toEqual({ resetsInSeconds: 15 });
  });
});
