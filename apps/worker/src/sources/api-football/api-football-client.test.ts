import { describe, expect, it, vi } from 'vitest';
import {
  ApiFootballClient,
  ApiFootballHttpError,
  ApiFootballQuotaExceededError,
  DailyQuotaGuard,
  type ApiFootballApiResponse,
  type ApiFootballFixtureItem
} from './api-football-client.js';

const MOCK_FIXTURE: ApiFootballFixtureItem = {
  fixture: {
    id: 1001,
    referee: 'Michael Oliver',
    timezone: 'UTC',
    date: '2026-08-25T19:00:00+00:00',
    timestamp: 1787684400,
    status: { long: 'Match Finished', short: 'FT', elapsed: 90 }
  },
  league: {
    id: 39,
    name: 'Premier League',
    country: 'England',
    season: 2026,
    round: 'Regular Season - 1'
  },
  teams: {
    home: { id: 33, name: 'Manchester United', winner: true },
    away: { id: 40, name: 'Liverpool', winner: false }
  },
  goals: { home: 2, away: 1 },
  score: {
    halftime: { home: 1, away: 0 },
    fulltime: { home: 2, away: 1 },
    extratime: { home: null, away: null },
    penalty: { home: null, away: null }
  }
};

const MOCK_RESPONSE: ApiFootballApiResponse<ApiFootballFixtureItem> = {
  get: 'fixtures',
  parameters: { league: '39', season: '2026' },
  errors: [],
  results: 1,
  response: [MOCK_FIXTURE]
};

describe('DailyQuotaGuard', () => {
  it('tracks daily request count and enforces hard ceiling of 85', () => {
    const guard = new DailyQuotaGuard({ hardCeiling: 3, totalLimit: 5 });
    expect(guard.canRequest()).toBe(true);
    expect(guard.getRemainingQuota()).toBe(3);

    guard.recordRequest();
    guard.recordRequest();
    guard.recordRequest();

    expect(guard.canRequest()).toBe(false);
    expect(guard.getRemainingQuota()).toBe(0);
    expect(() => guard.recordRequest()).toThrow(ApiFootballQuotaExceededError);

    // Emergency request allows spending from the reserve budget
    expect(guard.canRequest(true)).toBe(true);
    guard.recordRequest(true);
    expect(guard.getState().usedToday).toBe(4);
  });

  it('resets daily usage upon day rotation (UTC)', () => {
    let mockTime = new Date('2026-08-25T23:59:00.000Z');
    const guard = new DailyQuotaGuard({ now: () => mockTime, hardCeiling: 2 });

    guard.recordRequest();
    guard.recordRequest();
    expect(guard.canRequest()).toBe(false);

    // Next day arrives
    mockTime = new Date('2026-08-26T00:01:00.000Z');
    expect(guard.canRequest(false, mockTime)).toBe(true);
    expect(guard.getState(mockTime).usedToday).toBe(0);
  });
});

describe('ApiFootballClient', () => {
  it('fetches season fixtures with authentication headers', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => MOCK_RESPONSE
    });

    const client = new ApiFootballClient({
      apiKey: 'test-api-key',
      fetchFn: mockFetch as unknown as typeof fetch
    });

    const result = await client.fetchSeasonFixtures(39, 2026);
    expect(result.results).toBe(1);
    expect(result.response[0]?.fixture.id).toBe(1001);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://v3.football.api-sports.io/fixtures?league=39&season=2026',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ 'x-apisports-key': 'test-api-key' })
      })
    );
    expect(client.quotaGuard.getState().usedToday).toBe(1);
  });

  it('fetches fixtures by date', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ...MOCK_RESPONSE, parameters: { date: '2026-08-25' } })
    });

    const client = new ApiFootballClient({ fetchFn: mockFetch as unknown as typeof fetch });
    const result = await client.fetchFixturesByDate('2026-08-25');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://v3.football.api-sports.io/fixtures?date=2026-08-25',
      expect.anything()
    );
    expect(result.response.length).toBe(1);
  });

  it('fetches fixtures in batch by ids', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ...MOCK_RESPONSE, parameters: { ids: '1001-1002-1003' } })
    });

    const client = new ApiFootballClient({ fetchFn: mockFetch as unknown as typeof fetch });
    await client.fetchFixturesByIds([1001, 1002, 1003]);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://v3.football.api-sports.io/fixtures?ids=1001-1002-1003',
      expect.anything()
    );
  });

  it('short-circuits empty batch ids with 0 external requests', async () => {
    const mockFetch = vi.fn();
    const client = new ApiFootballClient({ fetchFn: mockFetch as unknown as typeof fetch });

    const result = await client.fetchFixturesByIds([]);
    expect(result.response).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(client.quotaGuard.getState().usedToday).toBe(0);
  });

  it('throws ApiFootballHttpError on non-ok HTTP response or provider API errors', async () => {
    const mockFetch429 = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      text: async () => 'Rate limit exceeded'
    });

    const client429 = new ApiFootballClient({ fetchFn: mockFetch429 as unknown as typeof fetch });
    await expect(client429.fetchFixturesByDate('2026-08-25')).rejects.toThrow(ApiFootballHttpError);

    const mockFetchApiError = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ get: 'fixtures', parameters: {}, errors: { token: 'Invalid token' }, results: 0, response: [] })
    });

    const clientApiError = new ApiFootballClient({ fetchFn: mockFetchApiError as unknown as typeof fetch });
    await expect(clientApiError.fetchFixturesByDate('2026-08-25')).rejects.toThrow(ApiFootballHttpError);
  });
});
