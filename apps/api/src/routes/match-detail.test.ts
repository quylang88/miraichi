import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import type { IncomingMessage, ServerResponse } from 'http';
import { handleMatchDetail } from './match-detail.js';
import type { MatchSnapshotRepository } from '../repositories/match-snapshot-repository.js';
import { LocalMatchDetailStore } from '../repositories/local-match-detail-store.js';
import { MatchDetailRefreshQueue } from '../repositories/match-detail-refresh-queue.js';
import {
  toProviderNeutralLocalMatch,
  validateLocalMatchDetail,
  type LocalMatch,
  type LocalMatchDetail
} from '@miraichi/shared';

function createMockResponse() {
  return {
    statusCode: 0,
    headers: undefined as Record<string, string> | undefined,
    body: '',
    setHeader(name: string, value: string) {
      if (!this.headers) this.headers = {};
      this.headers[name] = value;
    },
    writeHead(statusCode: number, headers?: Record<string, string>) {
      this.statusCode = statusCode;
      if (headers) {
        this.headers = { ...(this.headers ?? {}), ...headers };
      }
    },
    end(body?: unknown) {
      this.body = typeof body === 'string' ? body : '';
    }
  };
}

const mockCompletedMatch: LocalMatch = {
  id: 'match-custom-league-2026-team-alpha-team-beta-2026-06-11',
  competition: {
    id: 'custom-league-2026',
    name: 'Custom League 2026',
    type: 'club',
    season: '2026'
  },
  kickoffUtc: '2026-06-11T19:00:00.000Z',
  status: 'completed',
  homeTeam: { id: 'team-alpha', name: 'Alpha FC' },
  awayTeam: { id: 'team-beta', name: 'Beta United' },
  score: { home: 2, away: 1 },
  sourceRefs: [{
    sourceId: 'manual-snapshot',
    sourceMatchId: '987654',
    sourceUrl: 'https://provider.invalid/fixtures?id=987654',
    importedAt: '2026-07-01T00:00:00.000Z'
  }],
  updatedAt: '2026-07-01T00:00:00.000Z'
};

const mockScheduledMatch: LocalMatch = {
  id: 'match-custom-league-2026-team-gamma-team-delta-2026-06-12',
  competition: {
    id: 'custom-league-2026',
    name: 'Custom League 2026',
    type: 'club',
    season: '2026'
  },
  kickoffUtc: '2026-06-12T19:00:00.000Z',
  status: 'scheduled',
  homeTeam: { id: 'team-gamma', name: 'Gamma FC' },
  awayTeam: { id: 'team-delta', name: 'Delta United' },
  score: { home: null, away: null },
  sourceRefs: [{
    sourceId: 'manual-snapshot',
    sourceMatchId: '987655',
    sourceUrl: 'https://provider.invalid/fixtures?id=987655',
    importedAt: '2026-07-01T00:00:00.000Z'
  }],
  updatedAt: '2026-07-01T00:00:00.000Z'
};

const mockPostponedMatch: LocalMatch = {
  ...mockScheduledMatch,
  id: 'match-custom-league-2026-team-epsilon-team-zeta-2026-06-13',
  status: 'postponed'
};

const mockCancelledMatch: LocalMatch = {
  ...mockScheduledMatch,
  id: 'match-custom-league-2026-team-eta-team-theta-2026-06-14',
  status: 'cancelled'
};

const mockUnknownMatch: LocalMatch = {
  ...mockScheduledMatch,
  id: 'match-custom-league-2026-team-iota-team-kappa-2026-06-15',
  status: 'unknown'
};

describe('match detail route', () => {
  let tempDir: string;
  let detailStore: LocalMatchDetailStore;
  let queue: MatchDetailRefreshQueue;
  let mockRepo: MatchSnapshotRepository;
  let matchesMap: Map<string, LocalMatch>;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'miraichi-match-detail-test-'));
    detailStore = new LocalMatchDetailStore({ dataRoot: tempDir });
    queue = new MatchDetailRefreshQueue({ dataRoot: tempDir });

    matchesMap = new Map<string, LocalMatch>([
      [mockCompletedMatch.id, mockCompletedMatch],
      [mockScheduledMatch.id, mockScheduledMatch],
      [mockPostponedMatch.id, mockPostponedMatch],
      [mockCancelledMatch.id, mockCancelledMatch],
      [mockUnknownMatch.id, mockUnknownMatch]
    ]);

    mockRepo = {
      findById: async (id: string) => matchesMap.get(id) ?? null,
      listMatches: vi.fn(),
      getStatus: vi.fn()
    };
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Validation & missing parameters', () => {
    it('returns 400 if id parameter is missing', async () => {
      const response = createMockResponse();

      await handleMatchDetail(
        { url: '/api/v1/matches/detail', method: 'GET' } as IncomingMessage,
        response as unknown as ServerResponse,
        { repository: mockRepo, detailStore, queue, dataRoot: tempDir }
      );

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('match_id_required');
      expect(body.error.message).toBe('id parameter is required.');
    });

    it('returns 400 if id parameter is empty or whitespace', async () => {
      const response = createMockResponse();

      await handleMatchDetail(
        { url: '/api/v1/matches/detail?id=%20%20%20', method: 'GET' } as IncomingMessage,
        response as unknown as ServerResponse,
        { repository: mockRepo, detailStore, queue, dataRoot: tempDir }
      );

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('match_id_required');
    });

    it('returns 404 if match is not found in the serving match store', async () => {
      const response = createMockResponse();

      await handleMatchDetail(
        { url: '/api/v1/matches/detail?id=match-non-existent-999', method: 'GET' } as IncomingMessage,
        response as unknown as ServerResponse,
        { repository: mockRepo, detailStore, queue, dataRoot: tempDir }
      );

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('match_not_found');
      expect(await queue.size()).toBe(0);
    });
  });

  describe('Case A: Cached detail exists', () => {
    it('returns HTTP 200 with sanitized cached detail and does not enqueue', async () => {
      const cachedDetailPayload: LocalMatchDetail = {
        match: toProviderNeutralLocalMatch(mockCompletedMatch),
        status: 'completed',
        elapsedMinute: 90,
        referee: 'Referee Smith',
        scoreBreakdown: {
          halftime: { home: 1, away: 0 },
          fulltime: { home: 2, away: 1 },
          extratime: { home: null, away: null },
          penalty: { home: null, away: null }
        },
        events: [
          {
            minute: 23,
            teamId: 'team-alpha',
            type: 'goal',
            player: 'Striker A',
            assist: 'Midfielder B',
            label: 'Goal: Striker A (23\')'
          },
          {
            minute: 75,
            teamId: 'team-beta',
            type: 'goal',
            player: 'Striker B',
            assist: null,
            label: 'Goal: Striker B (75\')'
          }
        ],
        teamStats: [
          {
            teamId: 'team-alpha',
            teamName: 'Alpha FC',
            cornerKicks: 5,
            yellowCards: 2,
            redCards: 0,
            totalShots: 12,
            shotsOnGoal: 6,
            possessionPercentage: 55
          },
          {
            teamId: 'team-beta',
            teamName: 'Beta United',
            cornerKicks: 3,
            yellowCards: 1,
            redCards: 0,
            totalShots: 8,
            shotsOnGoal: 4,
            possessionPercentage: 45
          }
        ],
        warnings: ['statistics_partial'],
        notes: ['Historical match detail captured'],
        updatedAt: '2026-07-02T12:00:00.000Z'
      };

      await detailStore.upsertDetail(cachedDetailPayload);

      const response = createMockResponse();
      await handleMatchDetail(
        { url: `/api/v1/matches/detail?id=${mockCompletedMatch.id}`, method: 'GET' } as IncomingMessage,
        response as unknown as ServerResponse,
        { repository: mockRepo, detailStore, queue, dataRoot: tempDir }
      );

      expect(response.statusCode).toBe(200);
      expect(response.headers?.['Content-Type']).toBe('application/json');

      const body = JSON.parse(response.body) as LocalMatchDetail;
      expect(body.match.id).toBe(mockCompletedMatch.id);
      expect(body.status).toBe('completed');
      expect(body.elapsedMinute).toBe(90);
      expect(body.referee).toBe('Referee Smith');
      expect(body.events).toHaveLength(2);
      expect(body.teamStats).toHaveLength(2);
      expect(body.warnings).toEqual(['statistics_partial']);
      expect(body.notes).toEqual(['Historical match detail captured']);

      // Check provider neutralization on match object
      expect(body.match.sourceRefs).toEqual([{
        sourceId: 'manual-snapshot',
        importedAt: '2026-07-01T00:00:00.000Z'
      }]);
      expect(response.body).not.toContain('https://v3.football.api-sports.io');
      expect(response.body).not.toContain('987654');

      // Validates according to strict LocalMatchDetail schema
      const validation = validateLocalMatchDetail(body);
      expect(validation.ok).toBe(true);

      // Queue was never touched
      expect(await queue.size()).toBe(0);
    });
  });

  describe('Case B: Scheduled and non-terminal match without cached detail', () => {
    it('returns HTTP 200 with basic factual detail without enqueueing', async () => {
      const response = createMockResponse();

      await handleMatchDetail(
        { url: `/api/v1/matches/detail?id=${mockScheduledMatch.id}`, method: 'GET' } as IncomingMessage,
        response as unknown as ServerResponse,
        { repository: mockRepo, detailStore, queue, dataRoot: tempDir }
      );

      expect(response.statusCode).toBe(200);
      expect(response.headers?.['Content-Type']).toBe('application/json');

      const body = JSON.parse(response.body) as LocalMatchDetail;
      expect(body.match.id).toBe(mockScheduledMatch.id);
      expect(body.status).toBe('scheduled');
      expect(body.elapsedMinute).toBeNull();
      expect(body.events).toEqual([]);
      expect(body.notes).toContain('Serving match store detail does not include live event telemetry.');
      expect(body.updatedAt).toBe(mockScheduledMatch.updatedAt);

      // Provider neutralized
      expect(body.match.sourceRefs).toEqual([{
        sourceId: 'manual-snapshot',
        importedAt: '2026-07-01T00:00:00.000Z'
      }]);
      expect(response.body).not.toContain('https://v3.football.api-sports.io');
      expect(response.body).not.toContain('987655');

      const validation = validateLocalMatchDetail(body);
      expect(validation.ok).toBe(true);

      // Queue was NOT enqueued
      expect(await queue.size()).toBe(0);
    });

    it('returns HTTP 200 for unknown non-terminal status without enqueueing', async () => {
      const response = createMockResponse();

      await handleMatchDetail(
        { url: `/api/v1/matches/detail?id=${mockUnknownMatch.id}`, method: 'GET' } as IncomingMessage,
        response as unknown as ServerResponse,
        { repository: mockRepo, detailStore, queue, dataRoot: tempDir }
      );

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as LocalMatchDetail;
      expect(body.status).toBe('unknown');
      expect(body.events).toEqual([]);
      expect(await queue.size()).toBe(0);
    });
  });

  describe('Case C: Completed, postponed, or cancelled match without cached detail', () => {
    it('enqueues canonical match ID and returns HTTP 202 with scheduler-aligned Retry-After', async () => {
      const response = createMockResponse();

      await handleMatchDetail(
        { url: `/api/v1/matches/detail?id=${mockCompletedMatch.id}`, method: 'GET' } as IncomingMessage,
        response as unknown as ServerResponse,
        { repository: mockRepo, detailStore, queue, dataRoot: tempDir }
      );

      expect(response.statusCode).toBe(202);
      expect(response.headers?.['Content-Type']).toBe('application/json');
      expect(response.headers?.['Retry-After']).toBe('150');

      const body = JSON.parse(response.body);
      expect(body.status).toBe('pending');
      expect(body.code).toBe('detail_pending');
      expect(body.message).toBe('Match detail is being fetched in the background.');
      expect(body.retryAfterSeconds).toBe(150);
      expect(body.match.id).toBe(mockCompletedMatch.id);
      expect(body.match.sourceRefs).toEqual([{
        sourceId: 'manual-snapshot',
        importedAt: '2026-07-01T00:00:00.000Z'
      }]);

      // Verify queue item
      expect(await queue.size()).toBe(1);
      const queuedItem = await queue.getItem(mockCompletedMatch.id);
      expect(queuedItem).not.toBeNull();
      expect(queuedItem?.matchId).toBe(mockCompletedMatch.id);
      expect(queuedItem?.status).toBe('pending');
    });

    it('returns basic detail without enqueueing for postponed match', async () => {
      const response = createMockResponse();

      await handleMatchDetail(
        { url: `/api/v1/matches/detail?id=${mockPostponedMatch.id}`, method: 'GET' } as IncomingMessage,
        response as unknown as ServerResponse,
        { repository: mockRepo, detailStore, queue, dataRoot: tempDir }
      );

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as LocalMatchDetail;
      expect(body.status).toBe('postponed');
      expect(body.events).toEqual([]);
      expect(await queue.getItem(mockPostponedMatch.id)).toBeNull();
    });

    it('returns basic detail without enqueueing for cancelled match', async () => {
      const response = createMockResponse();

      await handleMatchDetail(
        { url: `/api/v1/matches/detail?id=${mockCancelledMatch.id}`, method: 'GET' } as IncomingMessage,
        response as unknown as ServerResponse,
        { repository: mockRepo, detailStore, queue, dataRoot: tempDir }
      );

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as LocalMatchDetail;
      expect(body.status).toBe('cancelled');
      expect(body.events).toEqual([]);
      expect(await queue.getItem(mockCancelledMatch.id)).toBeNull();
    });
  });

  describe('Duplicate requests and coalescing', () => {
    it('coalesces duplicate pending requests into a single queue entry', async () => {
      const response1 = createMockResponse();
      const response2 = createMockResponse();

      await handleMatchDetail(
        { url: `/api/v1/matches/detail?id=${mockCompletedMatch.id}`, method: 'GET' } as IncomingMessage,
        response1 as unknown as ServerResponse,
        { repository: mockRepo, detailStore, queue, dataRoot: tempDir }
      );

      await handleMatchDetail(
        { url: `/api/v1/matches/detail?id=${mockCompletedMatch.id}`, method: 'GET' } as IncomingMessage,
        response2 as unknown as ServerResponse,
        { repository: mockRepo, detailStore, queue, dataRoot: tempDir }
      );

      expect(response1.statusCode).toBe(202);
      expect(response2.statusCode).toBe(202);

      expect(await queue.size()).toBe(1);
      const item = await queue.getItem(mockCompletedMatch.id);
      expect(item?.attempts).toBe(0);
      expect(item?.status).toBe('pending');
    });

    it('returns a stable 503 instead of an endless 202 after bounded retries are exhausted', async () => {
      await queue.enqueue(mockCompletedMatch.id, { maxAttempts: 1 });
      await queue.markProcessing([mockCompletedMatch.id]);
      await queue.markFailed([mockCompletedMatch.id], 'provider_request_failed');

      const response = createMockResponse();
      await handleMatchDetail(
        { url: `/api/v1/matches/detail?id=${mockCompletedMatch.id}`, method: 'GET' } as IncomingMessage,
        response as unknown as ServerResponse,
        { repository: mockRepo, detailStore, queue, dataRoot: tempDir }
      );

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.body);
      expect(body.error).toEqual({
        code: 'detail_unavailable',
        message: 'Match detail is currently unavailable.'
      });
    });
  });

  describe('Security and provider secret containment', () => {
    it('never leaks provider secrets, URLs, or raw fixture IDs in 200, 202, or error responses', async () => {
      const secretKey = 'secret-api-key-999888';
      process.env.PRIVATE_PROVIDER_TEST_KEY = secretKey;

      const matchWithSecrets: LocalMatch = {
        ...mockCompletedMatch,
        id: 'match-generic-containment-check-001',
        sourceRefs: [{
          sourceId: 'manual-snapshot',
          sourceMatchId: 'fixture-secret-999',
          sourceUrl: `https://provider.invalid/fixtures?id=fixture-secret-999&key=${secretKey}`,
          importedAt: '2026-07-01T00:00:00.000Z'
        }]
      };
      matchesMap.set(matchWithSecrets.id, matchWithSecrets);

      // Test 202 response
      const response202 = createMockResponse();
      await handleMatchDetail(
        { url: `/api/v1/matches/detail?id=${matchWithSecrets.id}`, method: 'GET' } as IncomingMessage,
        response202 as unknown as ServerResponse,
        { repository: mockRepo, detailStore, queue, dataRoot: tempDir }
      );
      expect(response202.body).not.toContain(secretKey);
      expect(response202.body).not.toContain('https://provider.invalid');
      expect(response202.body).not.toContain('fixture-secret-999');

      // Test 200 cached response
      await detailStore.upsertDetail({
        match: toProviderNeutralLocalMatch(matchWithSecrets),
        status: 'completed',
        elapsedMinute: 90,
        events: [],
        updatedAt: '2026-07-02T00:00:00.000Z'
      });

      const response200 = createMockResponse();
      await handleMatchDetail(
        { url: `/api/v1/matches/detail?id=${matchWithSecrets.id}`, method: 'GET' } as IncomingMessage,
        response200 as unknown as ServerResponse,
        { repository: mockRepo, detailStore, queue, dataRoot: tempDir }
      );
      expect(response200.body).not.toContain(secretKey);
      expect(response200.body).not.toContain('https://provider.invalid');
      expect(response200.body).not.toContain('fixture-secret-999');

      delete process.env.PRIVATE_PROVIDER_TEST_KEY;
    });
  });

  describe('Error handling', () => {
    it('returns 500 when repository throws an error', async () => {
      const failingRepo = {
        findById: async () => {
          throw new Error('https://provider.invalid key=secret-api-key-123 fixture=987654');
        },
        listMatches: vi.fn(),
        getStatus: vi.fn()
      } as unknown as MatchSnapshotRepository;

      const response = createMockResponse();
      await handleMatchDetail(
        { url: `/api/v1/matches/detail?id=${mockCompletedMatch.id}`, method: 'GET' } as IncomingMessage,
        response as unknown as ServerResponse,
        { repository: failingRepo, detailStore, queue, dataRoot: tempDir }
      );

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('match_detail_route_error');
      expect(body.error.message).toBe('Failed to load match detail.');
      expect(response.body).not.toContain('secret-api-key-123');
      expect(response.body).not.toContain('v3.football.api-sports.io');
      expect(response.body).not.toContain('987654');
    });

    it('returns custom status code when error contains statusCode property', async () => {
      const failingRepo = {
        findById: async () => {
          const err = new Error('Custom service unavailable') as Error & { statusCode: number; code: string };
          err.statusCode = 503;
          err.code = 'custom_unavailable';
          throw err;
        },
        listMatches: vi.fn(),
        getStatus: vi.fn()
      } as unknown as MatchSnapshotRepository;

      const response = createMockResponse();
      await handleMatchDetail(
        { url: `/api/v1/matches/detail?id=${mockCompletedMatch.id}`, method: 'GET' } as IncomingMessage,
        response as unknown as ServerResponse,
        { repository: failingRepo, detailStore, queue, dataRoot: tempDir }
      );

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('match_detail_unavailable');
      expect(body.error.message).toBe('Match detail service is temporarily unavailable.');
    });
  });
});
