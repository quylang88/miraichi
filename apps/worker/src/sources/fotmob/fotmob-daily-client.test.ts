import { describe, expect, it, vi } from 'vitest';
import { FotMobAccessBlockedError } from './fotmob-season-client.js';
import { FotMobDailyClient } from './fotmob-daily-client.js';

function validPayload() {
  return {
    date: '20260831',
    leagues: [{
      id: 47,
      name: 'Competition Alpha',
      matches: [{
        id: 501,
        home: { id: 1, name: 'Home', score: 2 },
        away: { id: 2, name: 'Away', score: 1 },
        status: {
          utcTime: '2026-08-31T12:00:00.000Z',
          finished: true,
          started: true,
          cancelled: false,
          scoreStr: '2 - 1'
        }
      }]
    }]
  };
}

describe('FotMob unofficial daily client', () => {
  it('uses the exact global-date endpoint and forwards an ETag without retrying', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(validPayload()), {
      status: 200,
      headers: { etag: 'W/"daily"', 'content-type': 'application/json' }
    }));
    const client = new FotMobDailyClient({ fetchFn });

    const result = await client.getDailyMatches({
      date: '2026-08-31',
      timeZone: 'Asia/Tokyo',
      ownerCountryCode: 'JPN',
      etag: 'W/"old"'
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(String(url)).toBe(
      'https://www.fotmob.com/api/data/matches?date=20260831&timezone=Asia%2FTokyo&ccode3=JPN'
    );
    expect(init).toMatchObject({
      method: 'GET',
      headers: { Accept: 'application/json', 'If-None-Match': 'W/"old"' }
    });
    expect(result).toMatchObject({
      status: 'modified',
      etag: 'W/"daily"',
      payload: { date: '20260831', leagues: [{ id: 47 }] }
    });
  });

  it('returns not_modified without parsing a body', async () => {
    const client = new FotMobDailyClient({
      fetchFn: vi.fn(async () => new Response(null, {
        status: 304,
        headers: { etag: 'W/"daily"' }
      }))
    });

    await expect(client.getDailyMatches({
      date: '2026-08-31',
      timeZone: 'Asia/Tokyo',
      ownerCountryCode: 'JPN',
      etag: 'W/"daily"'
    })).resolves.toEqual({ status: 'not_modified', etag: 'W/"daily"' });
  });

  it.each([403, 429])('raises a run-blocking error for HTTP %s', async (status) => {
    const client = new FotMobDailyClient({
      fetchFn: vi.fn(async () => new Response('blocked', { status }))
    });

    const error = await client.getDailyMatches({
      date: '2026-08-31',
      timeZone: 'Asia/Tokyo',
      ownerCountryCode: 'JPN'
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(FotMobAccessBlockedError);
    expect(error).toMatchObject({ status });
  });

  it('rejects unsafe request values before network I/O', async () => {
    const fetchFn = vi.fn();
    const client = new FotMobDailyClient({ fetchFn });

    await expect(client.getDailyMatches({
      date: '2026-02-30',
      timeZone: '../Tokyo',
      ownerCountryCode: 'jpn'
    })).rejects.toThrow(/date/iu);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('rejects an invalid partial envelope', async () => {
    const client = new FotMobDailyClient({
      fetchFn: vi.fn(async () => new Response(JSON.stringify({ date: '20260831', leagues: [{}] }), {
        status: 200
      }))
    });

    await expect(client.getDailyMatches({
      date: '2026-08-31',
      timeZone: 'Asia/Tokyo',
      ownerCountryCode: 'JPN'
    })).rejects.toThrow('Invalid FotMob daily payload');
  });

  it('bounds the complete response body', async () => {
    const client = new FotMobDailyClient({
      maxResponseBytes: 10,
      fetchFn: vi.fn(async () => new Response(JSON.stringify(validPayload()), { status: 200 }))
    });

    await expect(client.getDailyMatches({
      date: '2026-08-31',
      timeZone: 'Asia/Tokyo',
      ownerCountryCode: 'JPN'
    })).rejects.toThrow('size limit');
  });

  it('times out a request that never settles', async () => {
    vi.useFakeTimers();
    try {
      const client = new FotMobDailyClient({
        timeoutMs: 25,
        fetchFn: vi.fn((_url, init) => new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }))
      });
      const request = client.getDailyMatches({
        date: '2026-08-31',
        timeZone: 'Asia/Tokyo',
        ownerCountryCode: 'JPN'
      });
      const expectation = expect(request).rejects.toThrow('timed out');
      await vi.advanceTimersByTimeAsync(25);
      await expectation;
    } finally {
      vi.useRealTimers();
    }
  });
});
