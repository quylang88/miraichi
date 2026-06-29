import { describe, expect, it } from 'vitest';
import { handleMatches, type MatchFeedResponse } from './matches.js';
import type { AppMatch } from '../providers/api-football-client.js';

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

const match: AppMatch = {
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
};

describe('matches route', () => {
  it('returns a normalized provider-backed match feed', async () => {
    const response = responseMock();

    await handleMatches(
      { url: '/api/v1/matches?date=2026-06-29', method: 'GET' } as import('http').IncomingMessage,
      response as unknown as import('http').ServerResponse,
      {
        loadMatches: async () => ({
          sourceProviderId: 'api-football',
          mode: 'date',
          fetchedAt: '2026-06-29T00:00:00.000Z',
          cache: { status: 'miss', ttlSeconds: 900 },
          quota: { dailyLimit: 100, consumedToday: 1, remainingToday: 99 },
          matches: [match],
          warnings: []
        })
      }
    );

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as MatchFeedResponse;
    expect(body.matches).toEqual([match]);
    expect(body.cache.status).toBe('miss');
  });

  it('uses a structured error instead of mock fallback when provider setup fails', async () => {
    const response = responseMock();

    await handleMatches(
      { url: '/api/v1/matches?date=2026-06-29', method: 'GET' } as import('http').IncomingMessage,
      response as unknown as import('http').ServerResponse,
      {
        loadMatches: async () => {
          const error = new Error('API_FOOTBALL_KEY is required for API-Football match feed.');
          Object.assign(error, { code: 'api_football_key_missing', statusCode: 503 });
          throw error;
        }
      }
    );

    expect(response.statusCode).toBe(503);
    expect(JSON.parse(response.body)).toEqual({
      error: {
        code: 'api_football_key_missing',
        message: 'API_FOOTBALL_KEY is required for API-Football match feed.'
      }
    });
  });

  it('rejects unsafe date query values', async () => {
    const response = responseMock();

    await handleMatches(
      { url: '/api/v1/matches?date=not-a-date', method: 'GET' } as import('http').IncomingMessage,
      response as unknown as import('http').ServerResponse,
      { loadMatches: async () => { throw new Error('should not be called'); } }
    );

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error.code).toBe('invalid_match_date');
  });
});
