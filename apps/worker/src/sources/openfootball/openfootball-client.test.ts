import { OPENFOOTBALL_SOURCE_REGISTRY } from '@miraichi/config';
import { describe, expect, it } from 'vitest';
import {
  fetchOpenFootballSource,
  OpenFootballFetchError,
  type OpenFootballClientDependencies
} from './openfootball-client.js';

const source = OPENFOOTBALL_SOURCE_REGISTRY[0]!;
const sourceText = '= English Premier League 2026/27\n';

function response(
  body: BodyInit | null,
  options: { status?: number; headers?: HeadersInit; url?: string } = {}
): Response {
  const result = new Response(body, {
    status: options.status ?? 200,
    ...(options.headers === undefined ? {} : { headers: options.headers })
  });

  if (options.url !== undefined) {
    Object.defineProperty(result, 'url', { value: options.url });
  }

  return result;
}

function dependencies(fetchFn: typeof fetch, sleeps: number[] = []): OpenFootballClientDependencies {
  return {
    fetchFn,
    sleep: async (milliseconds) => {
      sleeps.push(milliseconds);
    },
    now: () => new Date('2026-08-01T12:00:00.000Z')
  };
}

async function expectFetchError(
  promise: Promise<unknown>,
  code: OpenFootballFetchError['code'],
  attemptCount: number
): Promise<void> {
  await expect(promise).rejects.toMatchObject({ code, attemptCount });
}

describe('fetchOpenFootballSource', () => {
  it('captures allowlisted plain UTF-8 text with conditional request metadata', async () => {
    let request: Request | undefined;
    const result = await fetchOpenFootballSource(
      { source, conditional: { etag: '"etag-v1"', lastModified: 'Fri, 31 Jul 2026 12:00:00 GMT' } },
      dependencies(async (input) => {
        request = input instanceof Request ? input : new Request(input);
        return response(sourceText, {
          headers: {
            'content-type': 'text/plain; charset=utf-8',
            etag: '"etag-v2"',
            'last-modified': 'Sat, 01 Aug 2026 11:00:00 GMT'
          }
        });
      })
    );

    expect(request).toBeDefined();
    expect(request!.headers.get('user-agent')).toBe('Miraichi-OpenFootball-Worker/1.0');
    expect(request!.headers.get('if-none-match')).toBe('"etag-v1"');
    expect(request!.headers.get('if-modified-since')).toBe('Fri, 31 Jul 2026 12:00:00 GMT');
    expect(request!.headers.get('authorization')).toBeNull();
    expect(request!.headers.get('cookie')).toBeNull();
    expect(request!.signal).toBeInstanceOf(AbortSignal);
    expect(result).toMatchObject({
      status: 'changed',
      text: '= English Premier League 2026/27\n',
      byteCount: 33,
      contentType: 'text/plain; charset=utf-8'
    });
    expect(result).toMatchObject({
      fetchedAt: '2026-08-01T12:00:00.000Z',
      urlPath: '/openfootball/england/master/2026-27/1-premierleague.txt',
      etag: '"etag-v2"',
      lastModified: 'Sat, 01 Aug 2026 11:00:00 GMT'
    });
  });

  it('returns not_modified for 304 without reading a body', async () => {
    const result = await fetchOpenFootballSource(
      { source, conditional: { etag: '"etag-v1"' } },
      dependencies(async () => response(null, { status: 304, headers: { etag: '"etag-v1"' } }))
    );

    expect(result).toMatchObject({
      status: 'not_modified',
      fetchedAt: '2026-08-01T12:00:00.000Z',
      urlPath: '/openfootball/england/master/2026-27/1-premierleague.txt',
      etag: '"etag-v1"'
    });
  });

  it('retries a network failure at most three times with bounded backoff', async () => {
    let attempts = 0;
    const sleeps: number[] = [];
    const fetchFn: typeof fetch = async () => {
      attempts += 1;
      throw new TypeError('network offline');
    };

    await expectFetchError(
      fetchOpenFootballSource({ source }, dependencies(fetchFn, sleeps)),
      'network_failed',
      3
    );

    expect(attempts).toBe(3);
    expect(sleeps).toEqual([500, 1_500]);
  });

  it('retries server errors at most three times with bounded backoff', async () => {
    let attempts = 0;
    const sleeps: number[] = [];
    const fetchFn: typeof fetch = async () => {
      attempts += 1;
      return response(null, { status: 503 });
    };

    await expectFetchError(
      fetchOpenFootballSource({ source }, dependencies(fetchFn, sleeps)),
      'http_server_error',
      3
    );

    expect(attempts).toBe(3);
    expect(sleeps).toEqual([500, 1_500]);
  });

  it('uses parsed Retry-After before retrying a rate-limited source', async () => {
    let attempts = 0;
    const sleeps: number[] = [];
    const fetchFn: typeof fetch = async () => {
      attempts += 1;
      if (attempts === 1) {
        return response(null, { status: 429, headers: { 'retry-after': '2' } });
      }
      return response(sourceText, { headers: { 'content-type': 'text/plain' } });
    };

    const result = await fetchOpenFootballSource({ source }, dependencies(fetchFn, sleeps));

    expect(result.status).toBe('changed');
    expect(attempts).toBe(2);
    expect(sleeps).toEqual([2_000]);
  });

  it('does not retry a Retry-After value above sixty seconds', async () => {
    let attempts = 0;
    const fetchFn: typeof fetch = async () => {
      attempts += 1;
      return response(null, { status: 429, headers: { 'retry-after': '61' } });
    };

    await expectFetchError(fetchOpenFootballSource({ source }, dependencies(fetchFn)), 'retry_after_too_long', 1);
    expect(attempts).toBe(1);
  });

  it.each([
    ['404', () => response(null, { status: 404 }), 'source_unavailable'],
    ['HTML content', () => response('<html />', { headers: { 'content-type': 'text/html' } }), 'invalid_content_type'],
    ['oversized Content-Length', () => response(null, { headers: { 'content-type': 'text/plain', 'content-length': '11' } }), 'payload_too_large'],
    ['oversized body', () => response('01234567890', { headers: { 'content-type': 'text/plain' } }), 'payload_too_large'],
    ['invalid UTF-8', () => response(new Uint8Array([0xc3, 0x28]), { headers: { 'content-type': 'text/plain' } }), 'invalid_utf8'],
    ['redirect outside allowlist', () => response(sourceText, { headers: { 'content-type': 'text/plain' }, url: 'https://example.com/source.txt' }), 'redirect_outside_allowlist']
  ] as const)('throws %s after one attempt', async (_case, makeResponse, code) => {
    let attempts = 0;
    const constrainedSource = _case.includes('oversized') ? { ...source, maxPayloadBytes: 10 } : source;
    const fetchFn: typeof fetch = async () => {
      attempts += 1;
      return makeResponse();
    };

    await expectFetchError(fetchOpenFootballSource({ source: constrainedSource }, dependencies(fetchFn)), code, 1);
    expect(attempts).toBe(1);
  });
});
