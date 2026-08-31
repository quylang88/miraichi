import { describe, expect, it, vi } from 'vitest';
import {
  FOTMOB_DATA_ORIGIN,
  FotMobAccessBlockedError,
  FotMobSeasonClient
} from './fotmob-season-client.js';

function validPayload() {
  return {
    details: { id: 47, name: 'Competition Alpha', selectedSeason: '2026/2027' },
    fixtures: {
      allMatches: [{
        id: 501,
        round: '1',
        home: { id: 1, name: 'Home' },
        away: { id: 2, name: 'Away' },
        status: {
          utcTime: '2026-08-15T14:00:00.000Z',
          finished: false,
          started: false,
          cancelled: false
        }
      }]
    }
  };
}

describe('FotMob unofficial season client', () => {
  it('uses only the exact public season endpoint and forwards an ETag', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(validPayload()), {
      status: 200,
      headers: { etag: '"season-47"', 'content-type': 'application/json' }
    }));
    const client = new FotMobSeasonClient({ fetchFn });

    const result = await client.getSeasonMatches({
      externalCompetitionId: 47,
      externalCountryCode: 'ENG',
      providerSeason: '2026/2027',
      etag: '"old"'
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(String(url)).toBe(
      `${FOTMOB_DATA_ORIGIN}/leagues?id=47&ccode3=ENG&season=2026%2F2027`
    );
    expect(init).toMatchObject({
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'If-None-Match': '"old"'
      }
    });
    expect(result).toMatchObject({
      status: 'modified',
      etag: '"season-47"',
      payload: { details: { selectedSeason: '2026/2027' } }
    });
  });

  it('returns not_modified without parsing a body', async () => {
    const fetchFn = vi.fn(async () => new Response(null, {
      status: 304,
      headers: { etag: '"season-47"' }
    }));
    const client = new FotMobSeasonClient({ fetchFn });

    await expect(client.getSeasonMatches({
      externalCompetitionId: 47,
      externalCountryCode: 'ENG',
      providerSeason: '2026/2027',
      etag: '"season-47"'
    })).resolves.toEqual({ status: 'not_modified', etag: '"season-47"' });
  });

  it.each([403, 429])('raises a run-blocking error for HTTP %s', async (status) => {
    const client = new FotMobSeasonClient({
      fetchFn: vi.fn(async () => new Response('blocked', { status }))
    });

    const error = await client.getSeasonMatches({
      externalCompetitionId: 47,
      externalCountryCode: 'ENG',
      providerSeason: '2026/2027'
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(FotMobAccessBlockedError);
    expect(error).toMatchObject({ status });
  });

  it('rejects unsafe request values before network I/O', async () => {
    const fetchFn = vi.fn();
    const client = new FotMobSeasonClient({ fetchFn });

    await expect(client.getSeasonMatches({
      externalCompetitionId: 0,
      externalCountryCode: 'eng',
      providerSeason: '../2026'
    })).rejects.toThrow('positive integer');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('rejects an invalid partial envelope', async () => {
    const client = new FotMobSeasonClient({
      fetchFn: vi.fn(async () => new Response(JSON.stringify({
        details: { selectedSeason: '2026/2027' },
        fixtures: {}
      }), { status: 200 }))
    });

    await expect(client.getSeasonMatches({
      externalCompetitionId: 47,
      externalCountryCode: 'ENG',
      providerSeason: '2026/2027'
    })).rejects.toThrow('Invalid FotMob season payload');
  });

  it('bounds the complete response body', async () => {
    const client = new FotMobSeasonClient({
      maxResponseBytes: 10,
      fetchFn: vi.fn(async () => new Response(JSON.stringify(validPayload()), { status: 200 }))
    });

    await expect(client.getSeasonMatches({
      externalCompetitionId: 47,
      externalCountryCode: 'ENG',
      providerSeason: '2026/2027'
    })).rejects.toThrow('size limit');
  });

  it('times out a request that never settles', async () => {
    vi.useFakeTimers();
    try {
      const client = new FotMobSeasonClient({
        timeoutMs: 25,
        fetchFn: vi.fn((_url, init) => new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }))
      });
      const request = client.getSeasonMatches({
        externalCompetitionId: 47,
        externalCountryCode: 'ENG',
        providerSeason: '2026/2027'
      });
      const expectation = expect(request).rejects.toThrow('timed out');
      await vi.advanceTimersByTimeAsync(25);
      await expectation;
    } finally {
      vi.useRealTimers();
    }
  });
});
