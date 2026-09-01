import { describe, expect, it } from 'vitest';
import { handleMatches } from './matches.js';
import type { MatchSnapshotRepository } from '../repositories/match-snapshot-repository.js';
import type { LocalMatch, LocalMatchFeedResponse, LocalMatchSnapshotQuery } from '@miraichi/shared';

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

const mockMatch: LocalMatch = {
  id: 'match-world-cup-2026-group-a-mexico-south-africa-2026-06-11',
  competition: {
    id: 'world-cup-2026',
    name: 'FIFA World Cup',
    type: 'national-team',
    season: '2026'
  },
  kickoffUtc: '2026-06-11T19:00:00.000Z',
  status: 'scheduled',
  homeTeam: { id: 'team-mexico', name: 'Mexico' },
  awayTeam: { id: 'team-safrica', name: 'South Africa' },
  score: { home: null, away: null },
  sourceRefs: [{
    sourceId: 'sportscore',
    sourceMatchId: 'private-provider-slug',
    sourceUrl: 'https://sportscore.com/private-provider-slug',
    importedAt: '2026-07-01T00:00:00.000Z'
  }],
  updatedAt: '2026-07-01T00:00:00.000Z'
};

const mockFeedResponse: LocalMatchFeedResponse = {
  matches: [mockMatch],
  snapshot: {
    snapshotId: 'test-snapshot',
    generatedAt: '2026-07-01T00:00:00.000Z',
    importedAt: '2026-07-01T00:00:00.000Z',
    matchCount: 1,
    competitions: [
      { id: 'world-cup-2026', name: 'FIFA World Cup', seasons: ['2026'], matchCount: 1 }
    ],
    sources: [{
      sourceId: 'sportscore',
      sourceMatchId: 'private-provider-slug',
      sourceUrl: 'https://sportscore.com/private-provider-slug',
      importedAt: '2026-07-01T00:00:00.000Z'
    }, {
      sourceId: 'sportscore',
      sourceMatchId: 'newer-private-provider-slug',
      sourceUrl: 'https://sportscore.com/newer-private-provider-slug',
      importedAt: '2026-07-01T01:00:00.000Z'
    }],
    freshness: 'fresh',
    warnings: []
  }
};

describe('matches route', () => {
  it('returns a local match feed response', async () => {
    const response = responseMock();
    const mockRepo = {
      listMatches: async () => mockFeedResponse
    } as unknown as MatchSnapshotRepository;

    await handleMatches(
      { url: '/api/v1/matches', method: 'GET' } as import('http').IncomingMessage,
      response as unknown as import('http').ServerResponse,
      { repository: mockRepo }
    );

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.matches).toEqual([{
      ...mockMatch,
      sourceRefs: [{ sourceId: 'sportscore', importedAt: '2026-07-01T00:00:00.000Z' }]
    }]);
    expect(body.snapshot.snapshotId).toBe('test-snapshot');
    expect(body.snapshot.sources).toEqual([
      { sourceId: 'sportscore', importedAt: '2026-07-01T01:00:00.000Z' }
    ]);

    // Assert absence of provider-specific cache/quota structures.
    expect(body.quota).toBeUndefined();
    expect(body.cache).toBeUndefined();
    expect(body.sourceProviderId).toBeUndefined();
    expect(body.matches[0].providerFixtureId).toBeUndefined();
    expect(response.body).not.toContain('private-provider-slug');
    expect(response.body).not.toContain('newer-private-provider-slug');
    expect(response.body).not.toContain('sourceUrl');
  });

  it('filters by date and timezone when provided', async () => {
    const response = responseMock();
    let calledQuery: LocalMatchSnapshotQuery | null = null;
    const mockRepo = {
      listMatches: async (query: LocalMatchSnapshotQuery) => {
        calledQuery = query;
        return mockFeedResponse;
      }
    } as unknown as MatchSnapshotRepository;

    await handleMatches(
      { url: '/api/v1/matches?date=2026-09-01&timezone=Asia/Ho_Chi_Minh', method: 'GET' } as import('http').IncomingMessage,
      response as unknown as import('http').ServerResponse,
      { repository: mockRepo }
    );

    expect(response.statusCode).toBe(200);
    expect(calledQuery).toEqual({
      date: '2026-09-01',
      timezone: 'Asia/Ho_Chi_Minh',
      competitionId: undefined,
      status: undefined
    });
  });

  it('rejects invalid date format', async () => {
    const response = responseMock();

    await handleMatches(
      { url: '/api/v1/matches?date=not-a-date', method: 'GET' } as import('http').IncomingMessage,
      response as unknown as import('http').ServerResponse
    );

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error.code).toBe('invalid_date');
  });

  it('rejects status in_play', async () => {
    const response = responseMock();

    await handleMatches(
      { url: '/api/v1/matches?status=in_play', method: 'GET' } as import('http').IncomingMessage,
      response as unknown as import('http').ServerResponse
    );

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error.code).toBe('unsupported_match_status');
  });

  it('returns 503 when serving match store is missing', async () => {
    const response = responseMock();
    const mockRepo = {
      listMatches: async () => {
        const error = new Error('Serving match store manifest not found');
        const errObj = error as unknown as { code: string; statusCode: number };
        errObj.code = 'serving_match_store_missing';
        errObj.statusCode = 503;
        throw error;
      }
    } as unknown as MatchSnapshotRepository;

    await handleMatches(
      { url: '/api/v1/matches', method: 'GET' } as import('http').IncomingMessage,
      response as unknown as import('http').ServerResponse,
      { repository: mockRepo }
    );

    expect(response.statusCode).toBe(503);
    expect(JSON.parse(response.body).error.code).toBe('serving_match_store_missing');
  });

  it('returns 500 when serving match store is invalid', async () => {
    const response = responseMock();
    const mockRepo = {
      listMatches: async () => {
        const error = new Error('Malformed serving match store');
        const errObj = error as unknown as { code: string; statusCode: number };
        errObj.code = 'serving_match_store_invalid';
        errObj.statusCode = 500;
        throw error;
      }
    } as unknown as MatchSnapshotRepository;

    await handleMatches(
      { url: '/api/v1/matches', method: 'GET' } as import('http').IncomingMessage,
      response as unknown as import('http').ServerResponse,
      { repository: mockRepo }
    );

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body).error.code).toBe('serving_match_store_invalid');
  });
});
