import { describe, expect, it, vi } from 'vitest';
import { liveSnapshotFixture } from '../../../../tests/fixtures/live-match-snapshot.js';
import { toProviderNeutralLiveMatchSnapshot } from '@miraichi/shared';
import { refreshLiveMatches } from './live-match-service.js';

function response(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

const publicSnapshot = toProviderNeutralLiveMatchSnapshot(liveSnapshotFixture);
const completeSnapshot = {
  ...publicSnapshot,
  coverage: { ...publicSnapshot.coverage, upstreamCount: 1, mappedCount: 1 },
  warnings: []
};

describe('live match web service', () => {
  it('uses the same-origin owner API and returns a validated provider-neutral snapshot', async () => {
    const fetcher = vi.fn(async () => response({
      snapshot: completeSnapshot,
      refresh: {
        outcome: 'refreshed', status: 'succeeded', reason: 'visible',
        lastAttemptAt: completeSnapshot.generatedAt, lastSuccessAt: completeSnapshot.generatedAt,
        lastCompletedAt: completeSnapshot.generatedAt, lastErrorCode: null, refreshing: false
      }
    }));

    const result = await refreshLiveMatches('visible', fetcher);
    expect(fetcher).toHaveBeenCalledWith('/api/v1/live/refresh?reason=visible', {
      method: 'POST', credentials: 'include', headers: { Accept: 'application/json' }
    });
    expect(result).toMatchObject({ status: 'ready', stale: false, partial: false });
    if (result.status === 'ready') {
      expect(result.snapshot.matches[0]?.sourceRefs[0]).toEqual({
        sourceId: 'sportscore', observedAt: completeSnapshot.generatedAt
      });
    }
  });

  it('marks last-good data stale and partial when the refresh failed with coverage warnings', async () => {
    const fetcher = vi.fn(async () => response({
      snapshot: {
        ...publicSnapshot,
        coverage: { ...publicSnapshot.coverage, upstreamCount: 8, mappedCount: 1 },
        warnings: ['unmapped_match']
      },
      refresh: {
        outcome: 'failed', status: 'failed', reason: 'visible',
        lastAttemptAt: publicSnapshot.generatedAt, lastSuccessAt: publicSnapshot.generatedAt,
        lastCompletedAt: publicSnapshot.generatedAt, lastErrorCode: 'upstream_timeout', refreshing: false
      }
    }));
    expect(await refreshLiveMatches('visible', fetcher)).toMatchObject({
      status: 'ready', stale: true, partial: true, warningCode: 'upstream_timeout'
    });
  });

  it('rejects invalid or provider-locator-bearing payloads and handles unavailable HTTP', async () => {
    const leaked = structuredClone(publicSnapshot) as unknown as { matches: Array<Record<string, unknown>> };
    (leaked.matches[0]!.sourceRefs as Array<Record<string, unknown>>)[0]!.sourceMatchId = 'private-slug';
    const leakedResult = await refreshLiveMatches('manual', async () => response({ snapshot: leaked, refresh: {} }));
    expect(leakedResult).toMatchObject({ status: 'unavailable', reason: 'invalid_live_payload' });

    const unavailable = await refreshLiveMatches('manual', async () => response({ error: {} }, 503));
    expect(unavailable).toEqual({ status: 'unavailable', reason: 'live_data_unavailable' });
  });
});
