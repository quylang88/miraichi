import { describe, expect, it } from 'vitest';
import { handleMatchDetail, type MatchDetailResponse } from './match-detail.js';

function responseMock() {
  return {
    statusCode: 0,
    headers: undefined as Record<string, string> | undefined,
    body: '',
    setHeader() {},
    writeHead(statusCode: number, headers?: Record<string, string>) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(body?: unknown) {
      this.body = typeof body === 'string' ? body : '';
    }
  };
}

describe('match detail route', () => {
  it('throws 400 if id is missing', async () => {
    const response = responseMock();

    await handleMatchDetail(
      { url: '/api/v1/matches/detail', method: 'GET' } as import('http').IncomingMessage,
      response as unknown as import('http').ServerResponse,
      {
        loadDetail: async () => {
          throw new Error('should not be called');
        }
      }
    );

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('missing_match_id');
  });

  it('returns a normalized provider-backed match detail and events', async () => {
    const response = responseMock();

    const mockDetail: MatchDetailResponse = {
      match: {
        id: 'api-football-fixture-123',
        sourceProviderId: 'api-football',
        providerFixtureId: '123',
        competitionId: 'api-football-league-1',
        competitionName: 'FIFA World Cup',
        seasonId: 'api-football-season-2026',
        round: 'Group Stage - 1',
        status: 'completed',
        statusLabel: 'Match Finished',
        kickoffTime: '2026-06-29T10:00:00.000Z',
        homeTeam: { id: 'api-football-team-1', name: 'Japan' },
        awayTeam: { id: 'api-football-team-2', name: 'Vietnam' },
        score: { home: 2, away: 1 },
        venueName: 'Tokyo Stadium',
        elapsedMinute: 90
      },
      referee: 'Michael Oliver',
      score: {
        halftime: { home: 1, away: 0 },
        fulltime: { home: 2, away: 1 },
        extratime: { home: null, away: null },
        penalty: { home: null, away: null }
      },
      events: [
        {
          time: { elapsed: 12, extra: null },
          team: { id: 'api-football-team-1', name: 'Japan' },
          player: { id: 'api-football-player-101', name: 'K. Minamino' },
          assist: { id: 'api-football-player-102', name: 'J. Ito' },
          type: 'Goal',
          detail: 'Normal Goal',
          comments: null
        }
      ]
    };

    await handleMatchDetail(
      { url: '/api/v1/matches/detail?id=123', method: 'GET' } as import('http').IncomingMessage,
      response as unknown as import('http').ServerResponse,
      {
        loadDetail: async (id) => {
          expect(id).toBe('123');
          return mockDetail;
        }
      }
    );

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as MatchDetailResponse;
    expect(body.match.id).toBe('api-football-fixture-123');
    expect(body.referee).toBe('Michael Oliver');
    expect(body.events.length).toBe(1);
    expect(body.events[0].player.name).toBe('K. Minamino');
  });

  it('handles client/provider errors cleanly', async () => {
    const response = responseMock();

    await handleMatchDetail(
      { url: '/api/v1/matches/detail?id=123', method: 'GET' } as import('http').IncomingMessage,
      response as unknown as import('http').ServerResponse,
      {
        loadDetail: async () => {
          const error = new Error('API-Football returned HTTP 502.');
          Object.assign(error, { code: 'api_football_provider_error', statusCode: 502 });
          throw error;
        }
      }
    );

    expect(response.statusCode).toBe(502);
    expect(JSON.parse(response.body)).toEqual({
      error: {
        code: 'api_football_provider_error',
        message: 'API-Football returned HTTP 502.'
      }
    });
  });

  it('falls back to mock data if key is missing', async () => {
    const response = responseMock();
    const originalKey = process.env.API_FOOTBALL_KEY;
    delete process.env.API_FOOTBALL_KEY;

    try {
      await handleMatchDetail(
        { url: '/api/v1/matches/detail?id=123', method: 'GET' } as import('http').IncomingMessage,
        response as unknown as import('http').ServerResponse
      );

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.match.providerFixtureId).toBe('123');
      expect(body.referee).toBe('Michael Oliver');
    } finally {
      process.env.API_FOOTBALL_KEY = originalKey;
    }
  });
});
