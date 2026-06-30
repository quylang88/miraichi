import { describe, expect, it, vi } from 'vitest';
import {
  ApiFootballProviderError,
  createApiFootballClient,
  normalizeApiFootballFixture,
  readApiFootballConfig,
  type ApiFootballFixture
} from './api-football-client.js';

const fixture: ApiFootballFixture = {
  fixture: {
    id: 120001,
    date: '2026-06-29T10:00:00+00:00',
    timestamp: 1782727200,
    venue: { id: 900, name: 'Tokyo Stadium', city: 'Tokyo' },
    status: { long: 'Not Started', short: 'NS', elapsed: null }
  },
  league: {
    id: 1,
    name: 'FIFA World Cup',
    country: 'World',
    season: 2026,
    round: 'Group Stage - 1'
  },
  teams: {
    home: { id: 100, name: 'Japan' },
    away: { id: 200, name: 'Vietnam' }
  },
  goals: { home: null, away: null },
  score: {
    halftime: { home: null, away: null },
    fulltime: { home: null, away: null }
  }
};

describe('API-Football config', () => {
  it('requires the provider key to be supplied by environment only', () => {
    expect(() => readApiFootballConfig({})).toThrow('API_FOOTBALL_KEY is required for API-Football match feed.');

    expect(readApiFootballConfig({
      API_FOOTBALL_KEY: 'owner-key',
      API_FOOTBALL_DAILY_LIMIT: '50'
    })).toEqual({
      apiKey: 'owner-key',
      baseUrl: 'https://v3.football.api-sports.io',
      dailyLimit: 50
    });
  });
});

describe('API-Football normalization', () => {
  it('normalizes a scheduled fixture into a competition-agnostic app match', () => {
    expect(normalizeApiFootballFixture(fixture)).toEqual({
      id: 'api-football-fixture-120001',
      sourceProviderId: 'api-football',
      providerFixtureId: '120001',
      competitionId: 'api-football-league-1',
      competitionName: 'FIFA World Cup',
      seasonId: 'api-football-season-2026',
      round: 'Group Stage - 1',
      status: 'scheduled',
      statusLabel: 'Not Started',
      kickoffTime: '2026-06-29T10:00:00.000Z',
      homeTeam: {
        id: 'api-football-team-100',
        name: 'Japan'
      },
      awayTeam: {
        id: 'api-football-team-200',
        name: 'Vietnam'
      },
      score: null,
      venueName: 'Tokyo Stadium',
      elapsedMinute: null
    });
  });

  it('normalizes live and completed statuses without adding prediction fields', () => {
    const live = normalizeApiFootballFixture({
      ...fixture,
      fixture: { ...fixture.fixture, status: { long: 'Second Half', short: '2H', elapsed: 61 } },
      goals: { home: 1, away: 0 }
    });
    const complete = normalizeApiFootballFixture({
      ...fixture,
      fixture: { ...fixture.fixture, status: { long: 'Match Finished', short: 'FT', elapsed: 90 } },
      goals: { home: 2, away: 2 }
    });

    expect(live.status).toBe('in_play');
    expect(live.score).toEqual({ home: 1, away: 0 });
    expect(live).not.toHaveProperty('predictionOutcome');
    expect(complete.status).toBe('completed');
    expect(complete.score).toEqual({ home: 2, away: 2 });
  });
});

describe('API-Football HTTP client', () => {
  it('fetches date fixtures with the provider header and parses response payloads', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      get: 'fixtures',
      parameters: { date: '2026-06-29', timezone: 'UTC' },
      errors: [],
      results: 1,
      paging: { current: 1, total: 1 },
      response: [fixture]
    }), { status: 200 }));

    const client = createApiFootballClient({
      config: { apiKey: 'owner-key', baseUrl: 'https://v3.football.api-sports.io', dailyLimit: 100 },
      fetcher
    });

    const result = await client.fetchFixturesByDate('2026-06-29');

    expect(fetcher).toHaveBeenCalledWith(
      'https://v3.football.api-sports.io/fixtures?date=2026-06-29&timezone=UTC',
      expect.objectContaining({
        headers: { 'x-apisports-key': 'owner-key' }
      })
    );
    expect(result.matches).toHaveLength(1);
    expect(result.warnings).toEqual([]);
  });

  it('throws typed errors for provider HTTP failures and invalid payloads', async () => {
    const failingClient = createApiFootballClient({
      config: { apiKey: 'owner-key', baseUrl: 'https://v3.football.api-sports.io', dailyLimit: 100 },
      fetcher: async () => new Response('Bad gateway', { status: 502 })
    });
    await expect(failingClient.fetchFixturesByDate('2026-06-29')).rejects.toMatchObject({
      code: 'api_football_provider_error',
      statusCode: 502
    });

    const invalidClient = createApiFootballClient({
      config: { apiKey: 'owner-key', baseUrl: 'https://v3.football.api-sports.io', dailyLimit: 100 },
      fetcher: async () => new Response(JSON.stringify({ response: [{}] }), { status: 200 })
    });
    await expect(invalidClient.fetchFixturesByDate('2026-06-29')).rejects.toBeInstanceOf(ApiFootballProviderError);
    await expect(invalidClient.fetchFixturesByDate('2026-06-29')).rejects.toMatchObject({
      code: 'api_football_invalid_payload'
    });

    const errorClient = createApiFootballClient({
      config: { apiKey: 'owner-key', baseUrl: 'https://v3.football.api-sports.io', dailyLimit: 100 },
      fetcher: async () => new Response(JSON.stringify({
        errors: { rateLimit: 'Too many requests' },
        response: []
      }), { status: 200 })
    });
    await expect(errorClient.fetchFixturesByDate('2026-06-29')).rejects.toMatchObject({
      code: 'api_football_api_error',
      message: 'API-Football returned errors: rateLimit: Too many requests'
    });
  });

  it('fetchFixtureDetail returns mock data when apiKey is mock or dummy', async () => {
    const client = createApiFootballClient({
      config: { apiKey: 'mock', baseUrl: 'https://v3.football.api-sports.io', dailyLimit: 100 }
    });

    const result = await client.fetchFixtureDetail('123');
    expect(result.match.providerFixtureId).toBe('123');
    expect(result.referee).toBe('Michael Oliver');
    expect(result.events.length).toBeGreaterThan(0);
    expect(result.events[0].type).toBe('Goal');
  });

  it('fetchFixtureDetail fetches real detail when apiKey is valid', async () => {
    const rawFixtureDetail = {
      ...fixture,
      fixture: {
        ...fixture.fixture,
        referee: 'Michael Oliver'
      },
      score: {
        halftime: { home: 1, away: 0 },
        fulltime: { home: 2, away: 1 },
        extratime: { home: null, away: null },
        penalty: { home: null, away: null }
      },
      events: [
        {
          time: { elapsed: 12, extra: null },
          team: { id: 100, name: 'Japan' },
          player: { id: 101, name: 'K. Minamino' },
          assist: { id: 102, name: 'J. Ito' },
          type: 'Goal',
          detail: 'Normal Goal',
          comments: null
        }
      ]
    };

    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      response: [rawFixtureDetail]
    }), { status: 200 }));

    const client = createApiFootballClient({
      config: { apiKey: 'owner-key', baseUrl: 'https://v3.football.api-sports.io', dailyLimit: 100 },
      fetcher
    });

    const result = await client.fetchFixtureDetail('123');
    expect(fetcher).toHaveBeenCalledWith(
      'https://v3.football.api-sports.io/fixtures?id=123',
      expect.objectContaining({
        headers: { 'x-apisports-key': 'owner-key' }
      })
    );
    expect(result.match.providerFixtureId).toBe('120001');
    expect(result.referee).toBe('Michael Oliver');
    expect(result.events.length).toBe(1);
    expect(result.events[0].player.name).toBe('K. Minamino');
  });
});
