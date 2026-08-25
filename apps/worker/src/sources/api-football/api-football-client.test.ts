import { describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ApiFootballClient,
  ApiFootballHttpError,
  type ApiFootballApiResponse,
  type ApiFootballFixtureItem
} from './api-football-client.js';
import { ApiFootballUsageLedger } from './api-football-usage-ledger.js';

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

describe('ApiFootballClient', () => {
  it('requires an explicit durable ledger location', () => {
    expect(() => new ApiFootballClient({ apiKey: 'test-api-key' })).toThrow(
      'api_football_ledger_path_missing'
    );
  });

  it('requires explicit API_FOOTBALL_KEY and fails without calling fetch or touching quota', async () => {
    const originalEnv = process.env.API_FOOTBALL_KEY;
    const originalRapidEnv = process.env.RAPIDAPI_KEY;
    delete process.env.API_FOOTBALL_KEY;
    delete process.env.RAPIDAPI_KEY;

    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-client-key-'));
    const ledgerPath = join(tempDir, 'usage-ledger.json');

    try {
      const mockFetch = vi.fn();
      const ledger = new ApiFootballUsageLedger({ storagePath: ledgerPath });
      const client = new ApiFootballClient({
        apiKey: '',
        fetchFn: mockFetch as unknown as typeof fetch,
        ledger
      });

      await expect(client.fetchFixturesByDate('2026-08-25')).rejects.toThrow('api_football_key_missing');
      expect(mockFetch).not.toHaveBeenCalled();

      const state = await ledger.getState();
      expect(state.dailyUsage.reserved).toBe(0);
    } finally {
      if (originalEnv !== undefined) process.env.API_FOOTBALL_KEY = originalEnv;
      if (originalRapidEnv !== undefined) process.env.RAPIDAPI_KEY = originalRapidEnv;
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('fetches season fixtures with authentication headers and reconciles headers', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-client-season-'));
    const ledgerPath = join(tempDir, 'usage-ledger.json');

    try {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({
          'x-ratelimit-requests-limit': '100',
          'x-ratelimit-requests-remaining': '99'
        }),
        json: async () => MOCK_RESPONSE
      });

      const ledger = new ApiFootballUsageLedger({ storagePath: ledgerPath });
      const client = new ApiFootballClient({
        apiKey: 'test-api-key',
        fetchFn: mockFetch as unknown as typeof fetch,
        ledger
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

      const state = await ledger.getState();
      expect(state.dailyUsage.reserved).toBe(1);
      expect(state.dailyUsage.confirmed).toBe(1);
      expect(state.lastReportedHeader.limit).toBe(100);
      expect(state.lastReportedHeader.remaining).toBe(99);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('fetches fixtures by date', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-client-date-'));
    const ledgerPath = join(tempDir, 'usage-ledger.json');

    try {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ ...MOCK_RESPONSE, parameters: { date: '2026-08-25' } })
      });

      const ledger = new ApiFootballUsageLedger({ storagePath: ledgerPath });
      const client = new ApiFootballClient({
        apiKey: 'test-api-key',
        fetchFn: mockFetch as unknown as typeof fetch,
        ledger
      });
      const result = await client.fetchFixturesByDate('2026-08-25');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://v3.football.api-sports.io/fixtures?date=2026-08-25',
        expect.anything()
      );
      expect(result.response.length).toBe(1);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('fetches fixtures in batch by ids', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-client-batch-'));
    const ledgerPath = join(tempDir, 'usage-ledger.json');

    try {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ ...MOCK_RESPONSE, parameters: { ids: '1001-1002-1003' } })
      });

      const ledger = new ApiFootballUsageLedger({ storagePath: ledgerPath });
      const client = new ApiFootballClient({
        apiKey: 'test-api-key',
        fetchFn: mockFetch as unknown as typeof fetch,
        ledger
      });
      await client.fetchFixturesByIds([1001, 1002, 1003]);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://v3.football.api-sports.io/fixtures?ids=1001-1002-1003',
        expect.anything()
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('short-circuits empty batch ids with 0 external requests and 0 quota reservations', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-client-empty-'));
    const ledgerPath = join(tempDir, 'usage-ledger.json');

    try {
      const mockFetch = vi.fn();
      const ledger = new ApiFootballUsageLedger({ storagePath: ledgerPath });
      const client = new ApiFootballClient({
        apiKey: 'test-api-key',
        fetchFn: mockFetch as unknown as typeof fetch,
        ledger
      });

      const result = await client.fetchFixturesByIds([]);
      expect(result.response).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
      expect((await ledger.getState()).dailyUsage.reserved).toBe(0);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('persists reservation when fetch throws a network error', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-client-net-err-'));
    const ledgerPath = join(tempDir, 'usage-ledger.json');

    try {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network connection timeout'));
      const ledger = new ApiFootballUsageLedger({ storagePath: ledgerPath });
      const client = new ApiFootballClient({
        apiKey: 'test-api-key',
        fetchFn: mockFetch as unknown as typeof fetch,
        ledger
      });

      await expect(client.fetchFixturesByDate('2026-08-25')).rejects.toThrow('Network connection timeout');
      const state = await ledger.getState();
      expect(state.dailyUsage.reserved).toBe(1);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('fails closed when provider-header reconciliation cannot be persisted', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-client-reconcile-fail-'));
    const ledgerPath = join(tempDir, 'usage-ledger.json');

    try {
      const ledger = new ApiFootballUsageLedger({ storagePath: ledgerPath });
      vi.spyOn(ledger, 'reconcileHeaders').mockRejectedValue(new Error('ledger_write_failed'));
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({
          'x-ratelimit-requests-limit': '100',
          'x-ratelimit-requests-remaining': '99'
        }),
        json: async () => MOCK_RESPONSE
      });
      const client = new ApiFootballClient({
        apiKey: 'test-api-key',
        fetchFn: mockFetch as unknown as typeof fetch,
        ledger
      });

      await expect(client.fetchFixturesByDate('2026-08-25')).rejects.toThrow('ledger_write_failed');
      expect((await ledger.getState()).dailyUsage.reserved).toBe(1);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('throws ApiFootballHttpError on non-ok HTTP response or provider API errors while reconciling headers', async () => {
    const tempDir429 = await mkdtemp(join(tmpdir(), 'miraichi-client-429-'));
    const ledgerPath429 = join(tempDir429, 'usage-ledger.json');

    const tempDirApiErr = await mkdtemp(join(tmpdir(), 'miraichi-client-apierr-'));
    const ledgerPathApiErr = join(tempDirApiErr, 'usage-ledger.json');

    try {
      const ledger429 = new ApiFootballUsageLedger({ storagePath: ledgerPath429 });
      const mockFetch429 = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Headers({
          'x-ratelimit-requests-limit': '100',
          'x-ratelimit-requests-remaining': '0'
        }),
        text: async () => 'Rate limit exceeded'
      });

      const client429 = new ApiFootballClient({
        apiKey: 'test-api-key',
        fetchFn: mockFetch429 as unknown as typeof fetch,
        ledger: ledger429
      });
      await expect(client429.fetchFixturesByDate('2026-08-25')).rejects.toThrow(ApiFootballHttpError);

      const stateAfter429 = await ledger429.getState();
      expect(stateAfter429.dailyUsage.confirmed).toBe(100);

      const ledgerApiErr = new ApiFootballUsageLedger({ storagePath: ledgerPathApiErr });
      const mockFetchApiError = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ get: 'fixtures', parameters: {}, errors: { token: 'Invalid token' }, results: 0, response: [] })
      });

      const clientApiError = new ApiFootballClient({
        apiKey: 'test-api-key',
        fetchFn: mockFetchApiError as unknown as typeof fetch,
        ledger: ledgerApiErr
      });
      await expect(clientApiError.fetchFixturesByDate('2026-08-25')).rejects.toThrow(ApiFootballHttpError);
    } finally {
      await rm(tempDir429, { recursive: true, force: true });
      await rm(tempDirApiErr, { recursive: true, force: true });
    }
  });

  it('correctly receives and returns fixtures with embedded events and statistics via fetchFixturesByIds', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-client-detail-batch-'));
    const ledgerPath = join(tempDir, 'usage-ledger.json');

    try {
      const richFixture: ApiFootballFixtureItem = {
        ...MOCK_FIXTURE,
        events: [
          {
            time: { elapsed: 23, extra: null },
            team: { id: 33, name: 'Manchester United', logo: 'https://media.api-sports.io/football/teams/33.png' },
            player: { id: 900, name: 'B. Fernandes' },
            assist: { id: 901, name: 'M. Rashford' },
            type: 'Goal',
            detail: 'Normal Goal',
            comments: null
          },
          {
            time: { elapsed: 90, extra: 2 },
            team: { id: 40, name: 'Liverpool' },
            player: { id: 902, name: 'V. van Dijk' },
            assist: { id: null, name: null },
            type: 'Card',
            detail: 'Yellow Card',
            comments: 'Foul'
          }
        ],
        statistics: [
          {
            team: { id: 33, name: 'Manchester United', logo: 'https://media.api-sports.io/football/teams/33.png' },
            statistics: [
              { type: 'Shots on Goal', value: 6 },
              { type: 'Ball Possession', value: '52%' },
              { type: 'expected_goals', value: null }
            ]
          },
          {
            team: { id: 40, name: 'Liverpool' },
            statistics: [
              { type: 'Shots on Goal', value: 4 },
              { type: 'Ball Possession', value: '48%' }
            ]
          }
        ]
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({
          'x-ratelimit-requests-limit': '100',
          'x-ratelimit-requests-remaining': '99'
        }),
        json: async () => ({
          get: 'fixtures',
          parameters: { ids: '1001' },
          errors: [],
          results: 1,
          response: [richFixture]
        })
      });

      const ledger = new ApiFootballUsageLedger({ storagePath: ledgerPath });
      const client = new ApiFootballClient({
        apiKey: 'test-api-key',
        fetchFn: mockFetch as unknown as typeof fetch,
        ledger
      });

      const result = await client.fetchFixturesByIds([1001]);
      expect(result.results).toBe(1);
      expect(result.response).toHaveLength(1);
      const item = result.response[0]!;
      expect(item.fixture.id).toBe(1001);
      expect(item.events).toHaveLength(2);
      expect(item.events?.[0]).toEqual({
        time: { elapsed: 23, extra: null },
        team: { id: 33, name: 'Manchester United', logo: 'https://media.api-sports.io/football/teams/33.png' },
        player: { id: 900, name: 'B. Fernandes' },
        assist: { id: 901, name: 'M. Rashford' },
        type: 'Goal',
        detail: 'Normal Goal',
        comments: null
      });
      expect(item.events?.[1]?.type).toBe('Card');
      expect(item.statistics).toHaveLength(2);
      expect(item.statistics?.[0]?.team.name).toBe('Manchester United');
      expect(item.statistics?.[0]?.statistics).toEqual([
        { type: 'Shots on Goal', value: 6 },
        { type: 'Ball Possession', value: '52%' },
        { type: 'expected_goals', value: null }
      ]);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('correctly receives and returns fixtures with embedded events and statistics via fetchSeasonFixtures', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-client-detail-season-'));
    const ledgerPath = join(tempDir, 'usage-ledger.json');

    try {
      const richFixture: ApiFootballFixtureItem = {
        ...MOCK_FIXTURE,
        events: [
          {
            time: { elapsed: 45, extra: null },
            team: { id: 33, name: 'Manchester United' },
            player: { id: 900, name: 'B. Fernandes' },
            assist: { id: null, name: null },
            type: 'Goal',
            detail: 'Penalty'
          }
        ],
        statistics: [
          {
            team: { id: 33, name: 'Manchester United' },
            statistics: [{ type: 'Fouls', value: 12 }]
          }
        ]
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          get: 'fixtures',
          parameters: { league: '39', season: '2026' },
          errors: [],
          results: 1,
          response: [richFixture]
        })
      });

      const ledger = new ApiFootballUsageLedger({ storagePath: ledgerPath });
      const client = new ApiFootballClient({
        apiKey: 'test-api-key',
        fetchFn: mockFetch as unknown as typeof fetch,
        ledger
      });

      const result = await client.fetchSeasonFixtures(39, 2026);
      expect(result.results).toBe(1);
      expect(result.response[0]?.events).toHaveLength(1);
      expect(result.response[0]?.statistics).toHaveLength(1);
      expect(result.response[0]?.events?.[0]?.detail).toBe('Penalty');
      expect(result.response[0]?.statistics?.[0]?.statistics[0]?.value).toBe(12);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
