import { describe, expect, it } from 'vitest';
import {
  sanitizeLiveRefreshErrorCode,
  toProviderNeutralLiveMatchSnapshot,
  validateLiveMatchSnapshot
} from './live-match-contracts.js';
import { liveSnapshotFixture } from '../../../../tests/fixtures/live-match-snapshot.js';

describe('provider-neutral live match contracts', () => {
  it('validates a normalized live snapshot and strips provider locator evidence for public output', () => {
    expect(validateLiveMatchSnapshot(liveSnapshotFixture)).toEqual({ ok: true });
    const output = toProviderNeutralLiveMatchSnapshot(liveSnapshotFixture);
    expect(output.matches[0]?.sourceRefs).toEqual([{ sourceId: 'sportscore', observedAt: '2026-09-02T12:00:00.000Z' }]);
    expect(JSON.stringify(output)).not.toContain('provider-live-slug');
    expect(JSON.stringify(output)).not.toContain('sourceUrl');
  });

  it('rejects invalid live minutes, scores, lifecycle combinations, and provider-owned canonical fields', () => {
    expect(validateLiveMatchSnapshot({
      ...liveSnapshotFixture,
      matches: [{ ...liveSnapshotFixture.matches[0]!, elapsedMinute: -1 }]
    }).ok).toBe(false);
    expect(validateLiveMatchSnapshot({
      ...liveSnapshotFixture,
      matches: [{ ...liveSnapshotFixture.matches[0]!, score: { home: -1, away: 0 } }]
    }).ok).toBe(false);
    expect(validateLiveMatchSnapshot({
      ...liveSnapshotFixture,
      matches: [{ ...liveSnapshotFixture.matches[0]!, status: 'completed', elapsedMinute: 80 }]
    }).ok).toBe(false);
    expect(validateLiveMatchSnapshot({
      ...liveSnapshotFixture,
      matches: [{ ...liveSnapshotFixture.matches[0]!, sourceProviderId: 'sportscore' }]
    }).ok).toBe(false);
  });

  it('allows only stable sanitized refresh error codes', () => {
    expect(sanitizeLiveRefreshErrorCode('upstream_timeout')).toBe('upstream_timeout');
    expect(sanitizeLiveRefreshErrorCode('postgresql://secret@db.example')).toBe('internal_error');
    expect(sanitizeLiveRefreshErrorCode(undefined)).toBe('internal_error');
  });
});
