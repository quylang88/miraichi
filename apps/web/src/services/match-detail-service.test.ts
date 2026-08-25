import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchMatchDetail } from './match-detail-service.js';
import type { LocalMatchDetail, LocalMatch } from '@miraichi/shared';

// Mock buildApiUrl
vi.mock('../config/client-env.js', () => ({
  buildApiUrl: vi.fn((path: string) => `http://localhost:3000${path}`)
}));

const mockMatch: LocalMatch = {
  id: 'match-1',
  competition: { id: 'comp-1', name: 'Comp', type: 'club', season: '2023' },
  kickoffUtc: '2023-01-01T00:00:00Z',
  status: 'completed',
  homeTeam: { id: 'team-1', name: 'Team A' },
  awayTeam: { id: 'team-2', name: 'Team B' },
  score: { home: 1, away: 0 },
  sourceRefs: [],
  updatedAt: '2023-01-01T02:00:00Z'
};

const mockDetail: LocalMatchDetail = {
  match: mockMatch,
  status: 'completed',
  elapsedMinute: 90,
  events: [
    { minute: 10, type: 'goal', label: 'Goal' }
  ],
  updatedAt: '2023-01-01T02:00:00Z'
};

describe('fetchMatchDetail', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns ready state for valid 200 cached detail', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockDetail
    });

    const result = await fetchMatchDetail('match-1');
    expect(result).toEqual({
      status: 'ready',
      detail: mockDetail
    });
    // Check it called the mocked buildApiUrl format
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:3000/api/v1/matches/detail?id=match-1');
  });

  it('returns pending state for 202 with retryAfter', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      json: async () => ({
        status: 'pending',
        code: 'detail_pending',
        message: 'Pending',
        match: mockMatch,
        retryAfterSeconds: 120
      })
    });

    const result = await fetchMatchDetail('match-1');
    expect(result).toEqual({
      status: 'pending',
      match: mockMatch,
      retryAfterSeconds: 120
    });
  });

  it('rejects malformed pending payloads instead of trusting an unvalidated match', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      json: async () => ({
        status: 'pending',
        match: { ...mockMatch, id: '' },
        retryAfterSeconds: -1
      })
    });

    await expect(fetchMatchDetail('match-1')).resolves.toEqual({
      status: 'unavailable',
      match: null,
      warnings: ['detail_request_failed']
    });
  });

  it('rejects a 200 payload pretending to be a pending response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'pending',
        match: mockMatch,
        retryAfterSeconds: 150
      })
    });

    await expect(fetchMatchDetail('match-1')).resolves.toEqual({
      status: 'unavailable',
      match: null,
      warnings: ['detail_request_failed']
    });
  });

  it('keeps a valid scheduled basic response ready without inventing live data', async () => {
    const scheduledMatch = { ...mockMatch, status: 'scheduled' as const, score: { home: null, away: null } };
    const scheduledDetail: LocalMatchDetail = {
      match: scheduledMatch,
      status: 'scheduled',
      elapsedMinute: null,
      events: [],
      notes: ['Serving match store detail does not include live event telemetry.'],
      updatedAt: '2023-01-01T00:00:00Z'
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => scheduledDetail
    });

    const result = await fetchMatchDetail('match-1');
    expect(result).toEqual({ status: 'ready', detail: scheduledDetail });
  });

  it('returns unavailable for 404', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: { code: 'match_not_found' } })
    });

    const result = await fetchMatchDetail('match-1');
    expect(result).toEqual({
      status: 'unavailable',
      match: null,
      warnings: ['match_not_found']
    });
  });

  it('returns unavailable for network errors', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network Error'));

    const result = await fetchMatchDetail('match-1');
    expect(result).toEqual({
      status: 'unavailable',
      match: null,
      warnings: ['detail_request_failed']
    });
  });

  it('rejects payloads containing provider-leaking fields', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ...mockDetail,
        providerFixtureId: '12345'
      })
    });

    const result = await fetchMatchDetail('match-1');
    expect(result).toEqual({
      status: 'unavailable',
      match: null,
      warnings: ['detail_request_failed']
    });
  });

  it('rejects provider-leaking fields regardless of key casing', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ...mockDetail,
        ProviderFixtureID: '12345'
      })
    });

    await expect(fetchMatchDetail('match-1')).resolves.toEqual({
      status: 'unavailable',
      match: null,
      warnings: ['detail_request_failed']
    });
  });

  it('forwards an abort signal so navigation can cancel an in-flight request', async () => {
    const controller = new AbortController();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockDetail
    });

    await fetchMatchDetail('match-1', { signal: controller.signal });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/matches/detail?id=match-1',
      { signal: controller.signal }
    );
  });
});
