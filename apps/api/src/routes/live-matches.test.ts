import { describe, expect, it, vi } from 'vitest';
import { liveSnapshotFixture } from '../../../../tests/fixtures/live-match-snapshot.js';
import { handleLiveMatches } from './live-matches.js';

function request(method: string, url: string) {
  return { method, url, headers: {} };
}

function response() {
  return {
    statusCode: 0,
    headers: {} as Record<string, string>,
    body: '',
    setHeader(name: string, value: string) { this.headers[name] = value; },
    writeHead(code: number, headers?: Record<string, string>) { this.statusCode = code; Object.assign(this.headers, headers ?? {}); },
    end(body?: unknown) { this.body = String(body ?? ''); }
  };
}

const refreshState = {
  status: 'succeeded' as const,
  reason: 'visible' as const,
  lastAttemptAt: liveSnapshotFixture.generatedAt,
  lastSuccessAt: liveSnapshotFixture.generatedAt,
  lastCompletedAt: liveSnapshotFixture.generatedAt,
  lastErrorCode: null,
  lease: null
};

describe('live match routes', () => {
  it('serves last-good provider-neutral live data without triggering refresh or exposing lease/provider locators', async () => {
    const coordinator = {
      read: vi.fn(async () => ({ outcome: 'fresh' as const, snapshot: liveSnapshotFixture, state: refreshState })),
      refresh: vi.fn()
    };
    const out = response();
    await handleLiveMatches(request('GET', '/api/v1/live') as never, out as never, { coordinator: coordinator as never });
    expect(out.statusCode).toBe(200);
    const payload = JSON.parse(out.body);
    expect(payload.snapshot.matches[0].sourceRefs).toEqual([{ sourceId: 'sportscore', observedAt: liveSnapshotFixture.generatedAt }]);
    expect(out.body).not.toContain('provider-live-slug');
    expect(out.body).not.toContain('leaseId');
    expect(coordinator.refresh).not.toHaveBeenCalled();
  });

  it('accepts only the three explicit refresh reasons and returns refresh outcome', async () => {
    const coordinator = {
      read: vi.fn(),
      refresh: vi.fn(async () => ({ outcome: 'refreshed' as const, snapshot: liveSnapshotFixture, state: refreshState }))
    };
    const invalid = response();
    await handleLiveMatches(request('POST', '/api/v1/live/refresh?reason=poll-every-second') as never, invalid as never, { coordinator: coordinator as never });
    expect(invalid.statusCode).toBe(400);
    expect(coordinator.refresh).not.toHaveBeenCalled();

    const valid = response();
    await handleLiveMatches(request('POST', '/api/v1/live/refresh?reason=manual') as never, valid as never, { coordinator: coordinator as never });
    expect(valid.statusCode).toBe(200);
    expect(coordinator.refresh).toHaveBeenCalledWith('manual');
    expect(JSON.parse(valid.body).refresh.outcome).toBe('refreshed');
  });

  it('returns unavailable only when refresh fails without any last-good snapshot', async () => {
    const coordinator = {
      read: vi.fn(),
      refresh: vi.fn(async () => ({ outcome: 'failed' as const, snapshot: null, state: { ...refreshState, status: 'failed', lastErrorCode: 'upstream_timeout' } }))
    };
    const out = response();
    await handleLiveMatches(request('POST', '/api/v1/live/refresh?reason=visible') as never, out as never, { coordinator: coordinator as never });
    expect(out.statusCode).toBe(503);
    expect(out.body).not.toContain('secret');
  });
});
