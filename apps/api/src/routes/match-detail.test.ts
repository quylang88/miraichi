import { describe, expect, it } from 'vitest';
import { handleMatchDetail } from './match-detail.js';
import type { MatchSnapshotRepository } from '../repositories/match-snapshot-repository.js';
import type { LocalMatch, LocalMatchDetail } from '@miraichi/shared';

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
    sourceId: 'api-football',
    sourceMatchId: '123456',
    sourceUrl: 'https://v3.football.api-sports.io/fixtures?id=123456',
    importedAt: '2026-07-01T00:00:00.000Z'
  }],
  updatedAt: '2026-07-01T00:00:00.000Z'
};

describe('match detail route', () => {
  it('returns LocalMatchDetail for valid id', async () => {
    const response = responseMock();
    const mockRepo = {
      findById: async (id: string) => {
        expect(id).toBe('match-world-cup-2026-group-a-mexico-south-africa-2026-06-11');
        return mockMatch;
      }
    } as unknown as MatchSnapshotRepository;

    await handleMatchDetail(
      { url: `/api/v1/matches/detail?id=${mockMatch.id}`, method: 'GET' } as import('http').IncomingMessage,
      response as unknown as import('http').ServerResponse,
      { repository: mockRepo }
    );

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as LocalMatchDetail;
    expect(body.match.id).toBe(mockMatch.id);
    expect(body.match.sourceRefs).toEqual([{
      sourceId: 'api-football',
      importedAt: '2026-07-01T00:00:00.000Z'
    }]);
    expect(body.events).toEqual([]);
    expect(body.notes).toContain('Serving match store detail does not include live event telemetry.');
  });

  it('returns 400 if id is missing', async () => {
    const response = responseMock();

    await handleMatchDetail(
      { url: '/api/v1/matches/detail', method: 'GET' } as import('http').IncomingMessage,
      response as unknown as import('http').ServerResponse
    );

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('match_id_required');
  });

  it('returns 400 with legacy_provider_id_not_supported for api-football-fixture- prefix', async () => {
    const response = responseMock();

    await handleMatchDetail(
      { url: '/api/v1/matches/detail?id=api-football-fixture-123', method: 'GET' } as import('http').IncomingMessage,
      response as unknown as import('http').ServerResponse
    );

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('legacy_provider_id_not_supported');
  });

  it('returns 404 if match is not found in the serving match store', async () => {
    const response = responseMock();
    const mockRepo = {
      findById: async () => null
    } as unknown as MatchSnapshotRepository;

    await handleMatchDetail(
      { url: '/api/v1/matches/detail?id=non-existent-id', method: 'GET' } as import('http').IncomingMessage,
      response as unknown as import('http').ServerResponse,
      { repository: mockRepo }
    );

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('match_not_found');
  });
});
