import { describe, expect, it, vi } from 'vitest';
import {
  OpenFootballClient,
  OPENFOOTBALL_SOURCE_ORIGIN
} from './openfootball-client.js';

describe('OpenFootball client', () => {
  it('constructs exact raw GitHub URL and parses valid season JSON payload', async () => {
    const mockPayload = {
      name: 'English Premier League 2026/27',
      matches: [
        {
          round: 'Matchday 1',
          date: '2026-08-15',
          time: '15:00',
          team1: 'Arsenal FC',
          team2: 'Chelsea FC',
          score: {
            ht: [1, 0],
            ft: [2, 1]
          }
        }
      ]
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({
        etag: '"test-etag-123"'
      }),
      text: () => Promise.resolve(JSON.stringify(mockPayload))
    });

    const client = new OpenFootballClient({ fetchFn: fetchMock as unknown as typeof fetch });
    const response = await client.getSeasonMatches({
      season: '2026-27',
      file: 'en.1.json'
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `${OPENFOOTBALL_SOURCE_ORIGIN}/2026-27/en.1.json`,
      expect.objectContaining({
        method: 'GET'
      })
    );

    expect(response.status).toBe('modified');
    if (response.status !== 'modified') throw new Error('Expected modified response.');
    expect(response.etag).toBe('"test-etag-123"');
    expect(response.payload.name).toBe('English Premier League 2026/27');
    expect(response.payload.matches).toHaveLength(1);
    expect(response.payload.matches[0]!.team1).toBe('Arsenal FC');
  });

  it('treats a conditional 304 as a successful not-modified response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 304,
      statusText: 'Not Modified',
      headers: new Headers({ etag: '"etag-1"' }),
      text: vi.fn()
    });
    const client = new OpenFootballClient({ fetchFn: fetchMock as unknown as typeof fetch });
    await expect(client.getSeasonMatches({
      season: '2026-27',
      file: 'en.1.json',
      etag: '"etag-1"'
    })).resolves.toEqual({
      status: 'not_modified',
      season: '2026-27',
      file: 'en.1.json',
      etag: '"etag-1"'
    });
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: expect.objectContaining({ 'If-None-Match': '"etag-1"' })
    });
  });

  it('rejects invalid JSON envelope or missing matches array', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: () => Promise.resolve(JSON.stringify({ invalid: true }))
    });

    const client = new OpenFootballClient({ fetchFn: fetchMock as unknown as typeof fetch });
    await expect(client.getSeasonMatches({
      season: '2026-27',
      file: 'en.1.json'
    })).rejects.toThrow('Invalid OpenFootball season payload.');
  });

  it('rejects a partial season envelope instead of silently dropping malformed rows', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: () => Promise.resolve(JSON.stringify({
        name: 'Partial season',
        matches: [
          { date: '2026-08-21', team1: 'A', team2: 'B' },
          { date: '2026-08-22', team1: 'Missing Away' }
        ]
      }))
    });
    const client = new OpenFootballClient({ fetchFn: fetchMock as unknown as typeof fetch });
    await expect(client.getSeasonMatches({
      season: '2026-27',
      file: 'en.1.json'
    })).rejects.toThrow(/matches\[1\]/iu);
  });

  it('handles HTTP error status properly', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: new Headers(),
      text: () => Promise.resolve('404: Not Found')
    });

    const client = new OpenFootballClient({ fetchFn: fetchMock as unknown as typeof fetch });
    await expect(client.getSeasonMatches({
      season: '2026-27',
      file: 'non-existent.json'
    })).rejects.toThrow('OpenFootball HTTP 404');
  });

  it('rejects unsafe path segments and times out while reading the response body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      text: () => new Promise((resolve) => setTimeout(() => resolve(JSON.stringify({
        name: 'late',
        matches: []
      })), 50))
    });
    const client = new OpenFootballClient({
      fetchFn: fetchMock as unknown as typeof fetch,
      timeoutMs: 5
    });
    await expect(client.getSeasonMatches({
      season: '../2026-27',
      file: 'en.1.json'
    })).rejects.toThrow(/season/iu);
    await expect(client.getSeasonMatches({
      season: '2026-27',
      file: '../en.1.json'
    })).rejects.toThrow(/file/iu);
    await expect(client.getSeasonMatches({
      season: '2026-27',
      file: 'en.1.json'
    })).rejects.toThrow(/timed out/iu);
  });
});
