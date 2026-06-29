import { describe, expect, it } from 'vitest';
import { createDailyQuotaGuard, createMatchdayCache } from './matchday-cache.js';

describe('matchday cache', () => {
  it('returns hits until the TTL expires', () => {
    let nowMs = Date.parse('2026-06-29T00:00:00Z');
    const cache = createMatchdayCache<{ value: string }>({
      ttlSeconds: 60,
      now: () => new Date(nowMs)
    });

    expect(cache.get('date:2026-06-29')).toBeNull();
    cache.set('date:2026-06-29', { value: 'cached' });
    expect(cache.get('date:2026-06-29')).toEqual({ value: 'cached' });

    nowMs += 61_000;
    expect(cache.get('date:2026-06-29')).toBeNull();
  });
});

describe('daily quota guard', () => {
  it('allows calls until the daily limit and resets on UTC date boundary', () => {
    let nowMs = Date.parse('2026-06-29T23:59:00Z');
    const quota = createDailyQuotaGuard({
      dailyLimit: 2,
      now: () => new Date(nowMs)
    });

    expect(quota.snapshot()).toEqual({ dailyLimit: 2, consumedToday: 0, remainingToday: 2 });
    expect(quota.tryConsume()).toEqual({ allowed: true, snapshot: { dailyLimit: 2, consumedToday: 1, remainingToday: 1 } });
    expect(quota.tryConsume()).toEqual({ allowed: true, snapshot: { dailyLimit: 2, consumedToday: 2, remainingToday: 0 } });
    expect(quota.tryConsume()).toEqual({ allowed: false, snapshot: { dailyLimit: 2, consumedToday: 2, remainingToday: 0 } });

    nowMs = Date.parse('2026-06-30T00:01:00Z');
    expect(quota.tryConsume()).toEqual({ allowed: true, snapshot: { dailyLimit: 2, consumedToday: 1, remainingToday: 1 } });
  });
});
