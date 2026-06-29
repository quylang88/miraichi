import { afterEach, describe, expect, it, vi } from 'vitest';
import { getMatchFeed } from './match-feed-service.js';

describe('web match feed service', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns a ready state from the API gateway payload', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      sourceProviderId: 'api-football',
      mode: 'date',
      fetchedAt: '2026-06-29T00:00:00.000Z',
      cache: { status: 'miss', ttlSeconds: 900 },
      quota: { dailyLimit: 100, consumedToday: 1, remainingToday: 99 },
      matches: [
        {
          id: 'api-football-fixture-1',
          sourceProviderId: 'api-football',
          providerFixtureId: '1',
          competitionId: 'api-football-league-1',
          competitionName: 'FIFA World Cup',
          seasonId: 'api-football-season-2026',
          round: 'Group Stage - 1',
          status: 'scheduled',
          statusLabel: 'Not Started',
          kickoffTime: '2026-06-29T10:00:00.000Z',
          homeTeam: { id: 'api-football-team-1', name: 'Japan' },
          awayTeam: { id: 'api-football-team-2', name: 'Vietnam' },
          score: null,
          venueName: 'Tokyo Stadium',
          elapsedMinute: null
        }
      ],
      warnings: []
    }), { status: 200 })));

    await expect(getMatchFeed('2026-06-29')).resolves.toMatchObject({
      status: 'ready',
      date: '2026-06-29',
      matches: [{ homeTeam: { name: 'Japan' }, awayTeam: { name: 'Vietnam' } }]
    });
  });

  it('returns empty and unavailable states without using hardcoded mock matches', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      sourceProviderId: 'api-football',
      mode: 'date',
      fetchedAt: '2026-06-29T00:00:00.000Z',
      cache: { status: 'miss', ttlSeconds: 900 },
      quota: { dailyLimit: 100, consumedToday: 1, remainingToday: 99 },
      matches: [],
      warnings: ['no_fixtures_for_date']
    }), { status: 200 })));

    await expect(getMatchFeed('2026-06-29')).resolves.toEqual({
      status: 'empty',
      date: '2026-06-29',
      warnings: ['no_fixtures_for_date']
    });

    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      error: {
        code: 'api_football_key_missing',
        message: 'API_FOOTBALL_KEY is required for API-Football match feed.'
      }
    }), { status: 503 })));

    await expect(getMatchFeed('2026-06-29')).resolves.toEqual({
      status: 'unavailable',
      date: '2026-06-29',
      reason: 'API_FOOTBALL_KEY is required for API-Football match feed.',
      warnings: ['api_football_key_missing']
    });
  });
});
